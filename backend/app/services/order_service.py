from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.messaging import publisher
from app.db import models
from app.schemas.order import OrderCreate


def _serialize_item(item: models.OrderItem) -> dict:
    return {
        "id": item.id,
        "product_id": item.product_id,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "line_total": float(item.line_total),
    }


def _serialize_order(order: models.Order) -> dict:
    return {
        "id": order.id,
        "tenant_id": order.tenant_id,
        "created_by_user_id": order.created_by_user_id,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "items": [_serialize_item(item) for item in order.items],
    }


async def list_orders(db: AsyncSession, tenant_id: str) -> list[dict]:
    stmt = (
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(models.Order.tenant_id == tenant_id)
        .order_by(models.Order.created_at.desc())
    )
    orders = (await db.scalars(stmt)).all()
    return [_serialize_order(order) for order in orders]


async def get_order(db: AsyncSession, tenant_id: str, order_id: str) -> dict:
    stmt = (
        select(models.Order)
        .options(selectinload(models.Order.items))
        .where(
            models.Order.id == order_id,
            models.Order.tenant_id == tenant_id,
        )
    )
    order = await db.scalar(stmt)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return _serialize_order(order)


async def create_order(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: OrderCreate,
) -> dict:
    product_quantities: dict[str, int] = {}
    for item in payload.items:
        product_quantities[item.product_id] = (
            product_quantities.get(item.product_id, 0)
            + item.quantity
        )

    product_ids = list(product_quantities.keys())

    products = (
        await db.scalars(
            select(models.Product).where(
                models.Product.tenant_id == tenant_id,
                models.Product.id.in_(product_ids),
                models.Product.is_active.is_(True),
            )
        )
    ).all()
    products_by_id = {product.id: product for product in products}

    if len(products_by_id) != len(product_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more products are invalid",
        )

    inventories = (
        await db.scalars(
            select(models.Inventory).where(
                models.Inventory.tenant_id == tenant_id,
                models.Inventory.product_id.in_(product_ids),
            )
        )
    ).all()
    inventory_by_product_id = {
        inventory.product_id: inventory for inventory in inventories
    }

    for product_id, requested_qty in product_quantities.items():
        inventory = inventory_by_product_id.get(product_id)
        if inventory is None or inventory.quantity < requested_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Not enough stock for product {product_id}",
            )

    order = models.Order(tenant_id=tenant_id, created_by_user_id=user_id)
    db.add(order)
    await db.flush()

    total = Decimal("0")

    for item in payload.items:
        product = products_by_id[item.product_id]
        inventory = inventory_by_product_id[item.product_id]

        line_total = Decimal(product.unit_price) * item.quantity
        inventory.quantity -= item.quantity

        db.add(
            models.OrderItem(
                tenant_id=tenant_id,
                order_id=order.id,
                product_id=product.id,
                quantity=item.quantity,
                unit_price=product.unit_price,
                line_total=line_total,
            )
        )
        total += line_total

    order.total_amount = total

    await db.commit()

    created = await get_order(db, tenant_id, order.id)
    await publisher.publish_order_created(
        {
            "event": "order.created",
            "tenant_id": tenant_id,
            "order_id": order.id,
            "created_by_user_id": user_id,
            "total_amount": float(total),
        }
    )
    return created
