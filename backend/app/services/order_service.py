from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.messaging import publisher
from app.core.timeutil import as_utc
from app.db import models
from app.schemas.order import OrderCreate
from app.services import audit_service
from app.services.product_service import invalidate_catalog_cache

_ORDER_LOADERS = (
    selectinload(models.Order.items).selectinload(models.OrderItem.product),
    selectinload(models.Order.created_by),
)


def _serialize_item(item: models.OrderItem) -> dict:
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product.name,
        "product_sku": item.product.sku,
        "quantity": item.quantity,
        "unit_price": float(item.unit_price),
        "line_total": float(item.line_total),
    }


def _serialize_order(order: models.Order) -> dict:
    creator = order.created_by
    return {
        "id": order.id,
        "number": order.number,
        "tenant_id": order.tenant_id,
        "created_by_user_id": order.created_by_user_id,
        "created_by_email": creator.email if creator else None,
        "created_by_name": creator.full_name if creator else None,
        "customer_name": order.customer_name,
        "status": order.status,
        "total_amount": float(order.total_amount),
        "item_count": sum(item.quantity for item in order.items),
        "created_at": as_utc(order.created_at),
        "updated_at": as_utc(order.updated_at),
        "items": [_serialize_item(item) for item in order.items],
    }


async def list_orders(
    db: AsyncSession,
    tenant_id: str,
    status_filter: str | None = None,
    limit: int = 200,
) -> list[dict]:
    stmt = (
        select(models.Order)
        .options(*_ORDER_LOADERS)
        .where(models.Order.tenant_id == tenant_id)
        .order_by(models.Order.created_at.desc(), models.Order.number.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(models.Order.status == status_filter)
    orders = (await db.scalars(stmt)).all()
    return [_serialize_order(order) for order in orders]


async def _load_order(
    db: AsyncSession,
    tenant_id: str,
    order_id: str,
) -> models.Order:
    order = await db.scalar(
        select(models.Order)
        .options(*_ORDER_LOADERS)
        .where(
            models.Order.id == order_id,
            models.Order.tenant_id == tenant_id,
        )
        .execution_options(populate_existing=True)
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    return order


async def get_order(db: AsyncSession, tenant_id: str, order_id: str) -> dict:
    return _serialize_order(await _load_order(db, tenant_id, order_id))


async def _next_order_number(db: AsyncSession, tenant_id: str) -> int:
    """Hand out the next per-tenant order number.

    The tenant row is locked for the rest of the transaction, so two
    concurrent checkouts can never receive the same number.
    """
    tenant = await db.scalar(
        select(models.Tenant)
        .where(models.Tenant.id == tenant_id)
        .with_for_update()
    )
    tenant.order_seq += 1
    return tenant.order_seq


async def create_order(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payload: OrderCreate,
) -> dict:
    # Merge duplicate lines so each product is validated and written once.
    product_quantities: dict[str, int] = {}
    for item in payload.items:
        product_quantities[item.product_id] = (
            product_quantities.get(item.product_id, 0) + item.quantity
        )
    product_ids = list(product_quantities)

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
            detail="One or more products are unavailable",
        )

    # Lock the stock rows (in a stable order, to avoid deadlocks) so the
    # availability check and the decrement happen atomically.
    inventories = (
        await db.scalars(
            select(models.Inventory)
            .where(
                models.Inventory.tenant_id == tenant_id,
                models.Inventory.product_id.in_(product_ids),
            )
            .order_by(models.Inventory.product_id)
            .with_for_update()
        )
    ).all()
    inventory_by_product_id = {
        inventory.product_id: inventory for inventory in inventories
    }

    for product_id, requested_qty in product_quantities.items():
        inventory = inventory_by_product_id.get(product_id)
        available = inventory.quantity if inventory else 0
        if available < requested_qty:
            name = products_by_id[product_id].name
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Not enough stock for {name}: "
                    f"{available} available, {requested_qty} requested"
                ),
            )

    order = models.Order(
        tenant_id=tenant_id,
        created_by_user_id=user_id,
        customer_name=payload.customer_name,
        number=await _next_order_number(db, tenant_id),
    )
    db.add(order)
    await db.flush()

    total = Decimal("0")
    for product_id, quantity in product_quantities.items():
        product = products_by_id[product_id]
        line_total = Decimal(product.unit_price) * quantity
        inventory_by_product_id[product_id].quantity -= quantity
        db.add(
            models.OrderItem(
                tenant_id=tenant_id,
                order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_price=product.unit_price,
                line_total=line_total,
            )
        )
        total += line_total

    order.total_amount = total

    audit_service.record(
        db,
        tenant_id=tenant_id,
        actor_user_id=user_id,
        event_type="order.placed",
        resource_type="order",
        resource_id=order.id,
        summary=f"Placed order #{order.number}",
        number=order.number,
        total_amount=float(total),
    )

    await db.commit()
    await invalidate_catalog_cache(tenant_id, product_ids)

    created = await get_order(db, tenant_id, order.id)
    await publisher.publish_order_created(
        {
            "event": "order.created",
            "tenant_id": tenant_id,
            "order_id": order.id,
            "order_number": order.number,
            "created_by_user_id": user_id,
            "total_amount": float(total),
        }
    )
    return created


async def _transition(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    order_id: str,
    target: models.OrderStatus,
) -> dict:
    order = await _load_order(db, tenant_id, order_id)

    if order.status != models.OrderStatus.PLACED.value:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order #{order.number} is already {order.status}",
        )

    product_ids: list[str] = []
    if target is models.OrderStatus.CANCELLED:
        # Cancelling returns the reserved units to stock.
        product_ids = [item.product_id for item in order.items]
        inventories = (
            await db.scalars(
                select(models.Inventory)
                .where(
                    models.Inventory.tenant_id == tenant_id,
                    models.Inventory.product_id.in_(product_ids),
                )
                .order_by(models.Inventory.product_id)
                .with_for_update()
            )
        ).all()
        inventory_by_product_id = {inv.product_id: inv for inv in inventories}
        for item in order.items:
            inventory = inventory_by_product_id.get(item.product_id)
            if inventory is not None:
                inventory.quantity += item.quantity

    order.status = target.value
    verb = "Cancelled" if target is models.OrderStatus.CANCELLED else "Fulfilled"
    audit_service.record(
        db,
        tenant_id=tenant_id,
        actor_user_id=user_id,
        event_type=f"order.{target.value}",
        resource_type="order",
        resource_id=order.id,
        summary=f"{verb} order #{order.number}",
        number=order.number,
    )

    await db.commit()
    if product_ids:
        await invalidate_catalog_cache(tenant_id, product_ids)
    return await get_order(db, tenant_id, order_id)


async def cancel_order(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    order_id: str,
) -> dict:
    return await _transition(
        db, tenant_id, user_id, order_id, models.OrderStatus.CANCELLED
    )


async def fulfill_order(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    order_id: str,
) -> dict:
    return await _transition(
        db, tenant_id, user_id, order_id, models.OrderStatus.FULFILLED
    )
