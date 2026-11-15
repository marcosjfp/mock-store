from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import models
from app.schemas.inventory import InventoryUpdate
from app.services import audit_service
from app.services.product_service import invalidate_catalog_cache


def _serialize_inventory(record: models.Inventory) -> dict:
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "product_id": record.product_id,
        "quantity": record.quantity,
        "reorder_level": record.reorder_level,
    }


async def _get_product_or_404(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
) -> models.Product:
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
    return product


async def get_inventory_by_product(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
) -> dict:
    await _get_product_or_404(db, tenant_id, product_id)

    inventory = await db.scalar(
        select(models.Inventory).where(
            models.Inventory.tenant_id == tenant_id,
            models.Inventory.product_id == product_id,
        )
    )

    if inventory is None:
        inventory = models.Inventory(
            tenant_id=tenant_id,
            product_id=product_id,
            quantity=0,
            reorder_level=0,
        )
        db.add(inventory)
        await db.commit()
        await db.refresh(inventory)

    return _serialize_inventory(inventory)


async def update_inventory(
    db: AsyncSession,
    tenant_id: str,
    actor_user_id: str,
    product_id: str,
    payload: InventoryUpdate,
) -> dict:
    product = await _get_product_or_404(db, tenant_id, product_id)

    inventory = await db.scalar(
        select(models.Inventory)
        .where(
            models.Inventory.tenant_id == tenant_id,
            models.Inventory.product_id == product_id,
        )
        .with_for_update()
    )
    if inventory is None:
        inventory = models.Inventory(
            tenant_id=tenant_id,
            product_id=product_id,
            quantity=0,
            reorder_level=0,
        )
        db.add(inventory)

    previous_quantity = inventory.quantity
    previous_reorder = inventory.reorder_level
    inventory.quantity = payload.quantity
    inventory.reorder_level = payload.reorder_level

    if (previous_quantity, previous_reorder) != (
        payload.quantity,
        payload.reorder_level,
    ):
        delta = payload.quantity - previous_quantity
        if delta:
            summary = (
                f"Adjusted stock for {product.name}: "
                f"{previous_quantity} → {payload.quantity}"
            )
        else:
            summary = (
                f"Changed reorder point for {product.name} to "
                f"{payload.reorder_level}"
            )
        audit_service.record(
            db,
            tenant_id=tenant_id,
            actor_user_id=actor_user_id,
            event_type="inventory.adjusted",
            resource_type="inventory",
            resource_id=product_id,
            summary=summary,
            delta=delta,
            quantity=payload.quantity,
            reorder_level=payload.reorder_level,
        )

    await db.commit()
    await db.refresh(inventory)
    await invalidate_catalog_cache(tenant_id, [product_id])

    return _serialize_inventory(inventory)
