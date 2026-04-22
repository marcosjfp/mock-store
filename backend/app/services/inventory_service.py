from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_client
from app.db import models
from app.schemas.inventory import InventoryUpdate


def _serialize_inventory(record: models.Inventory) -> dict:
    return {
        "id": record.id,
        "tenant_id": record.tenant_id,
        "product_id": record.product_id,
        "quantity": record.quantity,
        "reorder_level": record.reorder_level,
    }


async def get_inventory_by_product(
    db: AsyncSession,
    tenant_id: str,
    product_id: str,
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
    product_id: str,
    payload: InventoryUpdate,
) -> dict:
    inventory = await db.scalar(
        select(models.Inventory).where(
            models.Inventory.tenant_id == tenant_id,
            models.Inventory.product_id == product_id,
        )
    )

    if inventory is None:
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
        inventory = models.Inventory(tenant_id=tenant_id, product_id=product_id)
        db.add(inventory)

    inventory.quantity = payload.quantity
    inventory.reorder_level = payload.reorder_level

    await db.commit()
    await db.refresh(inventory)

    await cache_client.delete_pattern(f"tenant:{tenant_id}:products*")
    await cache_client.delete_pattern(
        f"tenant:{tenant_id}:product:{product_id}"
    )

    return _serialize_inventory(inventory)
