"""Seed a realistic demo workspace.

    python scripts/seed_demo.py           # create the demo tenant if missing
    python scripts/seed_demo.py --reset   # wipe and rebuild the demo tenant

The data is generated from a fixed random seed, so every run produces the
same catalog, team and two months of order history (relative to today).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, select

PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if PROJECT_ROOT not in sys.path:
    sys.path.append(PROJECT_ROOT)

from app.core.security import hash_password  # noqa: E402
from app.db import models  # noqa: E402
from app.db.session import AsyncSessionLocal  # noqa: E402

DEMO_TENANT_SLUG = os.getenv("DEMO_TENANT_SLUG", "rail-byte")
DEMO_TENANT_NAME = os.getenv("DEMO_TENANT_NAME", "Rail Byte Components")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "StrongPass123!")
HISTORY_DAYS = 60

TEAM = [
    ("owner@railbyte.com", "Marina Costa", "owner"),
    ("manager@railbyte.com", "Daniel Okafor", "manager"),
    ("staff@railbyte.com", "Priya Nair", "staff"),
    ("lucas@railbyte.com", "Lucas Ferreira", "staff"),
    ("hana@railbyte.com", "Hana Kobayashi", "manager"),
]

# sku, name, category, price, stock, reorder level, popularity weight, description
CATALOG = [
    ("CPU-7800X3D", "AMD Ryzen 7 7800X3D", "CPU", "389.00", 25, 8, 10,
     "8-core AM5 gaming processor with 3D V-Cache."),
    ("CPU-9700X", "AMD Ryzen 7 9700X", "CPU", "329.00", 18, 6, 6,
     "8-core Zen 5 desktop processor, 65W."),
    ("CPU-14600K", "Intel Core i5-14600K", "CPU", "299.00", 4, 6, 7,
     "14-core unlocked LGA1700 processor."),
    ("CPU-14900K", "Intel Core i9-14900K", "CPU", "549.00", 9, 4, 3,
     "24-core flagship desktop processor."),
    ("GPU-4070S", "NVIDIA GeForce RTX 4070 Super", "GPU", "619.00", 12, 5, 9,
     "12GB GDDR6 graphics card for 1440p gaming."),
    ("GPU-4080S", "NVIDIA GeForce RTX 4080 Super", "GPU", "999.00", 3, 4, 4,
     "16GB GDDR6X graphics card for 4K gaming."),
    ("GPU-7800XT", "AMD Radeon RX 7800 XT", "GPU", "499.00", 14, 5, 6,
     "16GB graphics card with strong 1440p value."),
    ("GPU-4060", "NVIDIA GeForce RTX 4060", "GPU", "299.00", 0, 6, 8,
     "8GB entry-level card for 1080p gaming."),
    ("RAM-32-DDR5", "Corsair Vengeance 32GB DDR5-6000", "Memory", "159.00", 40, 12, 10,
     "2x16GB CL30 kit tuned for AM5."),
    ("RAM-64-DDR5", "G.Skill Trident Z5 64GB DDR5-6400", "Memory", "239.00", 16, 6, 4,
     "2x32GB CL32 kit for workstations."),
    ("RAM-16-DDR4", "Kingston Fury 16GB DDR4-3200", "Memory", "45.00", 62, 15, 6,
     "2x8GB kit for budget builds."),
    ("SSD-990-2TB", "Samsung 990 Pro 2TB NVMe", "Storage", "179.00", 33, 10, 9,
     "PCIe 4.0 M.2 drive, 7,450 MB/s reads."),
    ("SSD-SN850-1TB", "WD Black SN850X 1TB NVMe", "Storage", "89.00", 48, 12, 8,
     "PCIe 4.0 M.2 drive for gaming."),
    ("HDD-IW-8TB", "Seagate IronWolf 8TB NAS HDD", "Storage", "189.00", 7, 8, 3,
     "7200 RPM CMR drive built for NAS."),
    ("MB-B650-TMH", "MSI MAG B650 Tomahawk WiFi", "Motherboard", "199.00", 15, 5, 7,
     "AM5 ATX board with WiFi 6E."),
    ("MB-Z790-AOR", "Gigabyte Z790 Aorus Elite AX", "Motherboard", "249.00", 11, 4, 4,
     "LGA1700 ATX board with DDR5 support."),
    ("MB-X870-ROG", "ASUS ROG Strix X870-E Gaming", "Motherboard", "459.00", 5, 3, 2,
     "Flagship AM5 board with USB4 and WiFi 7."),
    ("PSU-RM850X", "Corsair RM850x 850W 80+ Gold", "Power", "139.00", 22, 8, 7,
     "Fully modular ATX 3.1 power supply."),
    ("PSU-FOCUS-750", "Seasonic Focus GX-750", "Power", "109.00", 2, 6, 5,
     "750W fully modular 80+ Gold supply."),
    ("COOL-NH-D15", "Noctua NH-D15 chromax.black", "Cooling", "119.00", 17, 5, 5,
     "Dual-tower air cooler with two 140mm fans."),
    ("COOL-LF3-360", "Arctic Liquid Freezer III 360", "Cooling", "99.00", 20, 6, 6,
     "360mm all-in-one liquid cooler."),
    ("COOL-P12-5PK", "Arctic P12 PWM 120mm (5-pack)", "Cooling", "29.00", 55, 15, 6,
     "Pressure-optimised case fans, five pack."),
    ("CASE-NORTH", "Fractal Design North", "Case", "139.00", 9, 4, 5,
     "Mid-tower with real walnut front panel."),
    ("CASE-O11-EVO", "Lian Li O11 Dynamic EVO", "Case", "159.00", 6, 4, 4,
     "Dual-chamber showcase mid-tower."),
    ("CASE-H5-FLOW", "NZXT H5 Flow", "Case", "89.00", 13, 5, 5,
     "Compact airflow mid-tower."),
    ("KB-K2-PRO", "Keychron K2 Pro Mechanical Keyboard", "Peripherals", "99.00", 24, 8, 5,
     "75% wireless hot-swappable keyboard."),
    ("MS-GPX-2", "Logitech G Pro X Superlight 2", "Peripherals", "149.00", 19, 6, 5,
     "60g wireless esports mouse."),
    ("MON-27-QHD", "LG UltraGear 27\" QHD 165Hz", "Peripherals", "329.00", 8, 4, 3,
     "27-inch 1440p IPS gaming monitor."),
]

ARCHIVED = (
    "GPU-3060TI", "NVIDIA GeForce RTX 3060 Ti", "GPU", "329.00", 0, 0,
    "Discontinued — superseded by the RTX 4060 family.",
)

CUSTOMERS = [
    "Northwind Studio", "Atlas Robotics", "Pixel Forge Games", "Blue Harbor Labs",
    "Kestrel Analytics", "Orbit Media", "Lumen Architects", "Cedar & Pine Design",
    "Vertex Engineering", "Sunline Logistics", "Maple Street Cafe", "Halcyon Health",
    "Tidewater Schools", "Ironclad Security", "Aurora Biotech", "Quill Publishing",
    "Ana Ribeiro", "Tom Becker", "Sofia Lindqvist", "Kwame Mensah", "Yuki Tanaka",
    "Elena Petrova", "Carlos Mendes", "Amelia Wright",
]


async def _wipe_tenant(db, tenant_id: str) -> None:
    for model in (
        models.AuditLog,
        models.OrderItem,
        models.Order,
        models.Inventory,
        models.Product,
        models.User,
    ):
        await db.execute(delete(model).where(model.tenant_id == tenant_id))
    await db.execute(delete(models.Tenant).where(models.Tenant.id == tenant_id))
    await db.flush()


def _audit(tenant_id, actor_id, event_type, resource_type, resource_id, when, summary, **details):
    return models.AuditLog(
        tenant_id=tenant_id,
        actor_user_id=actor_id,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=resource_id,
        details=json.dumps({"summary": summary, **details}),
        created_at=when,
    )


async def seed_demo_data(reset: bool = False) -> str:
    rng = random.Random(7)
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=HISTORY_DAYS)

    async with AsyncSessionLocal() as db:
        tenant = await db.scalar(
            select(models.Tenant).where(models.Tenant.slug == DEMO_TENANT_SLUG)
        )
        if tenant is not None:
            has_orders = await db.scalar(
                select(models.Order.id)
                .where(models.Order.tenant_id == tenant.id)
                .limit(1)
            )
            if has_orders and not reset:
                return (
                    f"Tenant '{DEMO_TENANT_SLUG}' already has data — "
                    "pass --reset to rebuild it."
                )
            await _wipe_tenant(db, tenant.id)

        tenant = models.Tenant(
            name=DEMO_TENANT_NAME,
            slug=DEMO_TENANT_SLUG,
            created_at=start,
        )
        db.add(tenant)
        await db.flush()

        password_hash = hash_password(DEMO_PASSWORD)
        users: dict[str, models.User] = {}
        for index, (email, full_name, role) in enumerate(TEAM):
            joined = start + timedelta(days=index * 6, hours=index)
            user = models.User(
                tenant_id=tenant.id,
                email=email,
                full_name=full_name,
                hashed_password=password_hash,
                role=role,
                created_at=joined,
            )
            db.add(user)
            users[email] = user
        await db.flush()

        owner = users["owner@railbyte.com"]
        manager = users["manager@railbyte.com"]
        sellers = [users[email] for email, _, _ in TEAM]
        for email, _, role in TEAM[1:]:
            db.add(
                _audit(
                    tenant.id, owner.id, "member.invited", "member",
                    users[email].id, users[email].created_at,
                    f"Added {email} as {role}", role=role,
                )
            )

        products: list[models.Product] = []
        weights: list[int] = []
        for index, (sku, name, category, price, stock, reorder, weight, desc) in enumerate(CATALOG):
            created = start + timedelta(hours=2 + index * 3)
            product = models.Product(
                tenant_id=tenant.id,
                sku=sku,
                name=name,
                category=category,
                description=desc,
                unit_price=Decimal(price),
                created_at=created,
            )
            product.inventory = models.Inventory(
                tenant_id=tenant.id,
                quantity=stock,
                reorder_level=reorder,
            )
            db.add(product)
            products.append(product)
            weights.append(weight)

        sku, name, category, price, stock, reorder, desc = ARCHIVED
        archived = models.Product(
            tenant_id=tenant.id, sku=sku, name=name, category=category,
            description=desc, unit_price=Decimal(price), is_active=False,
            created_at=start,
        )
        archived.inventory = models.Inventory(
            tenant_id=tenant.id, quantity=stock, reorder_level=reorder,
        )
        db.add(archived)
        await db.flush()

        for product in products:
            db.add(
                _audit(
                    tenant.id, manager.id, "product.created", "product",
                    product.id, product.created_at,
                    f"Added {product.name} to the catalog", sku=product.sku,
                )
            )

        # Order history: volume ramps up over time, dips on weekends.
        number = tenant.order_seq
        for day_offset in range(HISTORY_DAYS, -1, -1):
            day = now - timedelta(days=day_offset)
            progress = 1 - day_offset / HISTORY_DAYS
            expected = 1.6 + 3.2 * progress
            if day.weekday() >= 5:
                expected *= 0.55
            count = max(0, round(rng.gauss(expected, 1.1)))

            for _ in range(count):
                placed_at = day.replace(
                    hour=rng.randint(8, 19),
                    minute=rng.randint(0, 59),
                    second=rng.randint(0, 59),
                    microsecond=0,
                )
                if placed_at > now:
                    placed_at = now - timedelta(minutes=rng.randint(5, 240))

                line_count = rng.choices([1, 2, 3, 4], weights=[45, 30, 17, 8])[0]
                picked: dict[str, models.Product] = {}
                while len(picked) < line_count:
                    choice = rng.choices(products, weights=weights)[0]
                    picked[choice.id] = choice

                age = now - placed_at
                roll = rng.random()
                if roll < 0.07:
                    order_status = models.OrderStatus.CANCELLED.value
                elif age < timedelta(hours=30) or (age < timedelta(days=4) and roll < 0.3):
                    order_status = models.OrderStatus.PLACED.value
                else:
                    order_status = models.OrderStatus.FULFILLED.value

                seller = rng.choice(sellers)
                number += 1
                order = models.Order(
                    tenant_id=tenant.id,
                    created_by_user_id=seller.id,
                    number=number,
                    customer_name=rng.choice(CUSTOMERS),
                    status=order_status,
                    created_at=placed_at,
                    updated_at=placed_at,
                )
                db.add(order)
                await db.flush()

                total = Decimal("0")
                for product in picked.values():
                    cheap = product.unit_price < 100
                    quantity = rng.choices(
                        [1, 2, 3, 4], weights=[50, 28, 14, 8] if cheap else [78, 16, 5, 1]
                    )[0]
                    line_total = product.unit_price * quantity
                    total += line_total
                    db.add(
                        models.OrderItem(
                            tenant_id=tenant.id,
                            order_id=order.id,
                            product_id=product.id,
                            quantity=quantity,
                            unit_price=product.unit_price,
                            line_total=line_total,
                        )
                    )
                order.total_amount = total

                db.add(
                    _audit(
                        tenant.id, seller.id, "order.placed", "order", order.id,
                        placed_at, f"Placed order #{number}",
                        number=number, total_amount=float(total),
                    )
                )
                if order_status != models.OrderStatus.PLACED.value:
                    closed_at = min(
                        now, placed_at + timedelta(hours=rng.randint(2, 40))
                    )
                    order.updated_at = closed_at
                    verb = (
                        "Cancelled"
                        if order_status == models.OrderStatus.CANCELLED.value
                        else "Fulfilled"
                    )
                    db.add(
                        _audit(
                            tenant.id,
                            manager.id if verb == "Cancelled" else seller.id,
                            f"order.{order_status}", "order", order.id,
                            closed_at, f"{verb} order #{number}", number=number,
                        )
                    )

        tenant.order_seq = number

        # A few recent stock movements so the activity feed tells a story.
        for hours_ago, sku, before, after in (
            (50, "RAM-32-DDR5", 12, 40),
            (27, "SSD-990-2TB", 9, 33),
            (6, "COOL-P12-5PK", 20, 55),
        ):
            product = next(p for p in products if p.sku == sku)
            db.add(
                _audit(
                    tenant.id, manager.id, "inventory.adjusted", "inventory",
                    product.id, now - timedelta(hours=hours_ago),
                    f"Adjusted stock for {product.name}: {before} → {after}",
                    delta=after - before, quantity=after,
                )
            )

        await db.commit()
        return (
            f"Seeded '{DEMO_TENANT_SLUG}': {len(products) + 1} products, "
            f"{len(TEAM)} users, {number - 1000} orders."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="rebuild the demo tenant")
    args = parser.parse_args()
    print(asyncio.run(seed_demo_data(reset=args.reset)))
