from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_client
from app.core.config import get_settings
from app.db import models
from app.schemas.product import ProductCreate, ProductUpdate


def _product_key(tenant_id: str, product_id: str) -> str:
    return f"tenant:{tenant_id}:product:{product_id}"


def _products_key(tenant_id: str) -> str:
    return f"tenant:{tenant_id}:products"


def _serialize_product(product: models.Product) -> dict:
    return {
        "id": product.id,
        "tenant_id": product.tenant_id,
        "sku": product.sku,
        "name": product.name,
        "description": product.description,
        "unit_price": float(product.unit_price),
        "is_active": product.is_active,
    }


async def list_products(db: AsyncSession, tenant_id: str) -> list[dict]:
    cache_key = _products_key(tenant_id)
    cached = await cache_client.get_json(cache_key)
    if cached is not None:
        return cached

    stmt = (
        select(models.Product)
        .where(models.Product.tenant_id == tenant_id)
        .order_by(models.Product.name.asc())
    )
    products = (await db.scalars(stmt)).all()
    serialized = [_serialize_product(product) for product in products]

    settings = get_settings()
    await cache_client.set_json(
        cache_key,
        serialized,
        ttl_seconds=settings.CACHE_TTL_SECONDS,
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

    product = await db.scalar(
        select(models.Product).where(
            models.Product.id == product_id,
            models.Product.tenant_id == tenant_id,
        )
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    settings = get_settings()
    await cache_client.set_json(
        cache_key,
        _serialize_product(product),
        ttl_seconds=settings.CACHE_TTL_SECONDS,
    )
    return _serialize_product(product)


async def create_product(
    db: AsyncSession,
    tenant_id: str,
    payload: ProductCreate,
) -> dict:
    product = models.Product(
        tenant_id=tenant_id,
        sku=payload.sku,
        name=payload.name,
        description=payload.description,
        unit_price=Decimal(str(payload.unit_price)),
    )
    db.add(product)
    await db.flush()

    inventory = models.Inventory(
        tenant_id=tenant_id,
        product_id=product.id,
        quantity=0,
        reorder_level=0,
    )
    db.add(inventory)

    await db.commit()
    await db.refresh(product)

    await cache_client.delete_pattern(f"tenant:{tenant_id}:products*")
    return _serialize_product(product)


async def update_product(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
    payload: ProductUpdate,
) -> dict:
    product = await db.scalar(
        select(models.Product).where(
            models.Product.id == product_id,
            models.Product.tenant_id == tenant_id,
        )
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    if payload.sku is not None:
        product.sku = payload.sku
    if payload.name is not None:
        product.name = payload.name
    if payload.description is not None:
        product.description = payload.description
    if payload.unit_price is not None:
        product.unit_price = Decimal(str(payload.unit_price))
    if payload.is_active is not None:
        product.is_active = payload.is_active

    await db.commit()
    await db.refresh(product)

    await cache_client.delete_pattern(f"tenant:{tenant_id}:products*")
    await cache_client.delete_pattern(
        f"tenant:{tenant_id}:product:{product_id}"
    )

    return _serialize_product(product)


async def delete_product(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
) -> None:
    product = await db.scalar(
        select(models.Product).where(
            models.Product.id == product_id,
            models.Product.tenant_id == tenant_id,
        )
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    await db.delete(product)
    await db.commit()

    await cache_client.delete_pattern(f"tenant:{tenant_id}:products*")
    await cache_client.delete_pattern(
        f"tenant:{tenant_id}:product:{product_id}"
    )
