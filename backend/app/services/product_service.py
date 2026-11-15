from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.cache import cache_client
from app.core.config import get_settings
from app.core.timeutil import as_utc
from app.db import models
from app.schemas.product import ProductCreate, ProductUpdate
from app.services import audit_service


def _product_key(tenant_id: str, product_id: str) -> str:
    return f"tenant:{tenant_id}:product:{product_id}"


def _products_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:products"


async def invalidate_catalog_cache(
    tenant_id: str,
    product_ids: list[str] | None = None,
) -> None:
    """Drop cached catalog reads after anything that changes price or stock."""
    await cache_client.delete_value(_products_key(tenant_id))
    for product_id in product_ids or []:
        await cache_client.delete_value(_product_key(tenant_id, product_id))


def stock_status(quantity: int, reorder_level: int) -> str:
    if quantity <= 0:
        return "out_of_stock"
    if quantity <= reorder_level:
        return "low_stock"
    return "in_stock"


def _serialize_product(product: models.Product) -> dict:
    inventory = product.inventory
    quantity = inventory.quantity if inventory else 0
    reorder_level = inventory.reorder_level if inventory else 0
    created_at = as_utc(product.created_at)
    return {
        "id": product.id,
        "tenant_id": product.tenant_id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "category": product.category,
        "unit_price": float(product.unit_price),
        "is_active": product.is_active,
        "quantity": quantity,
        "reorder_level": reorder_level,
        "stock_status": stock_status(quantity, reorder_level),
        "created_at": created_at.isoformat() if created_at else None,
    }


async def _load_product(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
) -> models.Product:
    product = await db.scalar(
        select(models.Product)
        .options(selectinload(models.Product.inventory))
        .where(
            models.Product.id == product_id,
            models.Product.tenant_id == tenant_id,
        )
        .execution_options(populate_existing=True)
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )
    return product


async def _ensure_sku_available(
    db: AsyncSession,
    tenant_id: str,
    sku: str,
    exclude_product_id: str | None = None,
) -> None:
    stmt = select(models.Product.id).where(
        models.Product.tenant_id == tenant_id,
        func.lower(models.Product.sku) == sku.lower(),
    )
    if exclude_product_id:
        stmt = stmt.where(models.Product.id != exclude_product_id)
    if await db.scalar(stmt) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"SKU '{sku}' is already in use",
        )


async def list_products(db: AsyncSession, tenant_id: str) -> list[dict]:
    cache_key = _products_key(tenant_id)
    cached = await cache_client.get_json(cache_key)
    if cached is not None:
        return cached

    # One query for products + one for their inventory rows (no N+1).
    stmt = (
        select(models.Product)
        .options(selectinload(models.Product.inventory))
        .where(models.Product.tenant_id == tenant_id)
        .order_by(models.Product.name.asc())
    )
    products = (await db.scalars(stmt)).all()
    serialized = [_serialize_product(product) for product in products]

    await cache_client.set_json(
        cache_key,
        serialized,
        ttl_seconds=get_settings().CACHE_TTL_SECONDS,
    )
    return serialized


async def get_product_or_404(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
) -> dict:
    cache_key = _product_key(tenant_id, product_id)
    cached = await cache_client.get_json(cache_key)
    if cached is not None:
        return cached

    serialized = _serialize_product(await _load_product(db, tenant_id, product_id))
    await cache_client.set_json(
        cache_key,
        serialized,
        ttl_seconds=get_settings().CACHE_TTL_SECONDS,
    )
    return serialized


async def create_product(
    db: AsyncSession,
    tenant_id: str,
    actor_user_id: str,
    payload: ProductCreate,
) -> dict:
    sku = payload.sku.strip()
    await _ensure_sku_available(db, tenant_id, sku)

    product = models.Product(
        tenant_id=tenant_id,
        sku=sku,
        name=payload.name.strip(),
        description=payload.description,
        category=payload.category,
        unit_price=Decimal(str(payload.unit_price)),
    )
    product.inventory = models.Inventory(
        tenant_id=tenant_id,
        quantity=payload.quantity,
        reorder_level=payload.reorder_level,
    )
    db.add(product)
    await db.flush()

    audit_service.record(
        db,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        event_type="product.created",
        resource_type="product",
        resource_id=product.id,
        summary=f"Added {product.name} to the catalog",
        sku=product.sku,
    )

    try:
        await db.commit()
    except IntegrityError as exc:  # lost a race on the unique SKU constraint
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"SKU '{sku}' is already in use",
        ) from exc

    await invalidate_catalog_cache(tenant_id)
    return _serialize_product(await _load_product(db, tenant_id, product.id))


async def update_product(
    db: AsyncSession,
    tenant_id: str,
    actor_user_id: str,
    product_id: str,
    payload: ProductUpdate,
) -> dict:
    product = await _load_product(db, tenant_id, product_id)

    # Only touch fields the client actually sent, so `description: null`
    # clears the description while an omitted field leaves it alone.
    changes = payload.model_dump(exclude_unset=True)
    for required in ("sku", "name", "category", "unit_price", "is_active"):
        if required in changes and changes[required] is None:
            changes.pop(required)

    if "sku" in changes:
        changes["sku"] = changes["sku"].strip()
        await _ensure_sku_available(db, tenant_id, changes["sku"], product.id)
    if "unit_price" in changes:
        changes["unit_price"] = Decimal(str(changes["unit_price"]))

    changed_fields = [
        field for field, value in changes.items() if getattr(product, field) != value
    ]
    for field in changed_fields:
        setattr(product, field, changes[field])

    if changed_fields:
        if changed_fields == ["is_active"]:
            event = "product.restored" if product.is_active else "product.archived"
            verb = "Restored" if product.is_active else "Archived"
            summary = f"{verb} {product.name}"
        else:
            event = "product.updated"
            summary = f"Updated {product.name}"
        audit_service.record(
            db,
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            event_type=event,
            resource_type="product",
            resource_id=product.id,
            summary=summary,
            fields=changed_fields,
        )
        await db.commit()
        await invalidate_catalog_cache(tenant_id, [product_id])

    return _serialize_product(await _load_product(db, tenant_id, product_id))


async def delete_product(
    db: AsyncSession,
    tenant_id: str,
    actor_user_id: str,
    product_id: str,
) -> None:
    product = await _load_product(db, tenant_id, product_id)

    has_orders = await db.scalar(
        select(models.OrderItem.id)
        .where(models.OrderItem.product_id == product_id)
        .limit(1)
    )
    if has_orders is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "This product appears on existing orders and cannot be deleted. "
                "Archive it instead."
            ),
        )

    audit_service.record(
        db,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        event_type="product.deleted",
        resource_type="product",
        resource_id=product.id,
        summary=f"Deleted {product.name}",
        sku=product.sku,
    )
    await db.delete(product)
    await db.commit()
    await invalidate_catalog_cache(tenant_id, [product_id])
