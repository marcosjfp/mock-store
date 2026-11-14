from collections import defaultdict
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.timeutil import as_utc, utcnow
from app.db import models
from app.services.product_service import stock_status

TOP_PRODUCTS_LIMIT = 5
LOW_STOCK_LIMIT = 8


def _metric(current: float, previous: float) -> dict:
    change = None
    if previous:
        change = round((current - previous) / previous * 100, 1)
    return {
        "value": round(current, 2),
        "previous": round(previous, 2),
        "change_pct": change,
    }


async def get_summary(db: AsyncSession, tenant_id: str, days: int) -> dict:
    """Sales and stock overview for the last `days` days (UTC day buckets).

    Each headline metric is compared against the preceding window of the same
    length. Cancelled orders are excluded from revenue figures.
    """
    today = utcnow().date()
    window_start = today - timedelta(days=days - 1)
    previous_start = window_start - timedelta(days=days)

    order_rows = (
        await db.execute(
            select(
                models.Order.id,
                models.Order.created_at,
                models.Order.total_amount,
                models.Order.status,
            ).where(models.Order.tenant_id == tenant_id)
        )
    ).all()

    series = {
        window_start + timedelta(days=offset): {"revenue": 0.0, "orders": 0}
        for offset in range(days)
    }
    current_ids: set[str] = set()
    previous_ids: set[str] = set()
    revenue = previous_revenue = 0.0
    cancelled = open_orders = 0

    for order_id, created_at, total_amount, order_status in order_rows:
        if order_status == models.OrderStatus.PLACED.value:
            open_orders += 1
        day = as_utc(created_at).date()
        if day < previous_start or day > today:
            continue
        in_current = day >= window_start
        if order_status == models.OrderStatus.CANCELLED.value:
            cancelled += int(in_current)
            continue
        amount = float(total_amount)
        if in_current:
            current_ids.add(order_id)
            revenue += amount
            series[day]["revenue"] += amount
            series[day]["orders"] += 1
        else:
            previous_ids.add(order_id)
            previous_revenue += amount

    item_rows = (
        await db.execute(
            select(
                models.OrderItem.order_id,
                models.OrderItem.product_id,
                models.OrderItem.quantity,
                models.OrderItem.line_total,
            ).where(models.OrderItem.tenant_id == tenant_id)
        )
    ).all()

    products = (
        await db.scalars(
            select(models.Product)
            .options(selectinload(models.Product.inventory))
            .where(models.Product.tenant_id == tenant_id)
        )
    ).all()
    products_by_id = {product.id: product for product in products}

    units = previous_units = 0
    by_product: dict[str, dict] = defaultdict(lambda: {"units": 0, "revenue": 0.0})
    by_category: dict[str, dict] = defaultdict(lambda: {"units": 0, "revenue": 0.0})

    for order_id, product_id, quantity, line_total in item_rows:
        if order_id in previous_ids:
            previous_units += quantity
            continue
        if order_id not in current_ids:
            continue
        units += quantity
        by_product[product_id]["units"] += quantity
        by_product[product_id]["revenue"] += float(line_total)
        product = products_by_id.get(product_id)
        category = product.category if product else "Other"
        by_category[category]["units"] += quantity
        by_category[category]["revenue"] += float(line_total)

    top_products = [
        {
            "product_id": product_id,
            "name": products_by_id[product_id].name,
            "sku": products_by_id[product_id].sku,
            "category": products_by_id[product_id].category,
            "units": stats["units"],
            "revenue": round(stats["revenue"], 2),
        }
        for product_id, stats in sorted(
            by_product.items(),
            key=lambda pair: pair[1]["revenue"],
            reverse=True,
        )
        if product_id in products_by_id
    ][:TOP_PRODUCTS_LIMIT]

    categories = [
        {
            "category": category,
            "revenue": round(stats["revenue"], 2),
            "units": stats["units"],
        }
        for category, stats in sorted(
            by_category.items(),
            key=lambda pair: pair[1]["revenue"],
            reverse=True,
        )
    ]

    health = {
        "active_products": 0,
        "total_units": 0,
        "stock_value": 0.0,
        "in_stock": 0,
        "low_stock": 0,
        "out_of_stock": 0,
    }
    low_stock: list[dict] = []
    for product in products:
        if not product.is_active:
            continue
        quantity = product.inventory.quantity if product.inventory else 0
        reorder = product.inventory.reorder_level if product.inventory else 0
        state = stock_status(quantity, reorder)
        health["active_products"] += 1
        health["total_units"] += quantity
        health["stock_value"] += quantity * float(product.unit_price)
        health[state] += 1
        if state != "in_stock":
            low_stock.append(
                {
                    "product_id": product.id,
                    "name": product.name,
                    "sku": product.sku,
                    "category": product.category,
                    "quantity": quantity,
                    "reorder_level": reorder,
                }
            )
    health["stock_value"] = round(health["stock_value"], 2)
    low_stock.sort(key=lambda item: (item["quantity"], item["name"]))

    order_count = len(current_ids)
    previous_count = len(previous_ids)

    return {
        "days": days,
        "revenue": _metric(revenue, previous_revenue),
        "orders": _metric(order_count, previous_count),
        "average_order_value": _metric(
            revenue / order_count if order_count else 0.0,
            previous_revenue / previous_count if previous_count else 0.0,
        ),
        "units_sold": _metric(units, previous_units),
        "cancelled_orders": cancelled,
        "open_orders": open_orders,
        "series": [
            {
                "date": day.isoformat(),
                "revenue": round(point["revenue"], 2),
                "orders": point["orders"],
            }
            for day, point in series.items()
        ],
        "top_products": top_products,
        "categories": categories,
        "inventory": health,
        "low_stock": low_stock[:LOW_STOCK_LIMIT],
    }
