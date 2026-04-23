from __future__ import annotations

import asyncio
import sys
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select


def _load_dependencies():
    project_root = str(Path(__file__).resolve().parent.parent)
    if project_root not in sys.path:
        sys.path.append(project_root)

    from app.core.security import hash_password
    from app.db import models
    from app.db.session import AsyncSessionLocal

    return hash_password, models, AsyncSessionLocal


async def seed_demo_data() -> None:
    hash_password, models, AsyncSessionLocal = _load_dependencies()

    async with AsyncSessionLocal() as db:
        tenant = await db.scalar(
            select(models.Tenant).where(models.Tenant.slug == "rail-byte-demo")
        )
        if tenant is None:
            tenant = models.Tenant(
                name="Rail Byte Components",
                slug="rail-byte-demo",
            )
            db.add(tenant)
            await db.flush()

        users = {
            "owner@railbyte.com": models.UserRole.OWNER.value,
            "manager@railbyte.com": models.UserRole.MANAGER.value,
            "staff@railbyte.com": models.UserRole.STAFF.value,
        }
        for email, role in users.items():
            existing_user = await db.scalar(
                select(models.User).where(
                    models.User.tenant_id == tenant.id,
                    models.User.email == email,
                )
            )
            if existing_user is None:
                db.add(
                    models.User(
                        tenant_id=tenant.id,
                        email=email,
                        hashed_password=hash_password("StrongPass123!"),
                        role=role,
                    )
                )

        await db.flush()

        sample_products = [
            (
                "CPU-7800X3D",
                "AMD Ryzen 7 7800X3D",
                "8-core gaming CPU optimized for low-latency frame times",
                Decimal("389.00"),
                24,
                6,
            ),
            (
                "CPU-7600",
                "AMD Ryzen 5 7600",
                "6-core value CPU for mainstream gaming builds",
                Decimal("229.00"),
                30,
                8,
            ),
            (
                "GPU-4070S",
                "NVIDIA RTX 4070 Super",
                "Efficient 1440p GPU with DLSS and ray tracing",
                Decimal("619.00"),
                14,
                4,
            ),
            (
                "GPU-4060TI",
                "NVIDIA RTX 4060 Ti 16GB",
                "Creator-friendly GPU with larger VRAM buffer",
                Decimal("499.00"),
                10,
                3,
            ),
            (
                "RAM-32-DDR5",
                "Corsair 32GB DDR5 Kit",
                "2x16GB DDR5-6000 CL30 memory kit",
                Decimal("159.00"),
                42,
                10,
            ),
            (
                "RAM-64-DDR5",
                "G.Skill 64GB DDR5 Kit",
                "2x32GB DDR5 kit for heavy workstation usage",
                Decimal("279.00"),
                18,
                4,
            ),
            (
                "SSD-1TB-NVME",
                "Samsung 990 EVO 1TB",
                "PCIe NVMe SSD for fast boot and game loading",
                Decimal("109.00"),
                50,
                12,
            ),
            (
                "SSD-2TB-NVME",
                "WD Black SN850X 2TB",
                "High-end NVMe drive tuned for sustained throughput",
                Decimal("179.00"),
                28,
                8,
            ),
            (
                "MB-B650-TOMA",
                "MSI MAG B650 Tomahawk",
                "AM5 motherboard with PCIe 5.0 and Wi-Fi",
                Decimal("219.00"),
                20,
                5,
            ),
            (
                "PSU-750-GOLD",
                "Corsair RM750e",
                "750W 80+ Gold fully modular power supply",
                Decimal("119.00"),
                26,
                6,
            ),
            (
                "CASE-AIR-MID",
                "Fractal Pop Air Mid Tower",
                "Airflow-focused ATX mid tower case",
                Decimal("99.00"),
                16,
                4,
            ),
            (
                "AIO-360-ARGB",
                "DeepCool LS720 360mm AIO",
                "360mm liquid CPU cooler with ARGB pump cap",
                Decimal("129.00"),
                12,
                3,
            ),
            (
                "FAN-P12-5PACK",
                "Arctic P12 PWM 5-Pack",
                "Static-pressure optimized PWM fan bundle",
                Decimal("36.00"),
                40,
                10,
            ),
            (
                "WIFI-AX210",
                "Intel AX210 Wi-Fi 6E Card",
                "PCIe Wi-Fi adapter with Bluetooth 5.3",
                Decimal("34.00"),
                34,
                8,
            ),
        ]

        products_by_sku: dict[str, models.Product] = {}
        inventory_by_product_id: dict[str, models.Inventory] = {}

        for sku, name, description, price, qty, reorder_level in sample_products:
            product = await db.scalar(
                select(models.Product).where(
                    models.Product.tenant_id == tenant.id,
                    models.Product.sku == sku,
                )
            )
            if product is None:
                product = models.Product(
                    tenant_id=tenant.id,
                    sku=sku,
                    name=name,
                    unit_price=price,
                    description=description,
                )
                db.add(product)
                await db.flush()
            elif not product.description:
                product.description = description

            products_by_sku[sku] = product

            inventory = await db.scalar(
                select(models.Inventory).where(
                    models.Inventory.tenant_id == tenant.id,
                    models.Inventory.product_id == product.id,
                )
            )
            if inventory is None:
                inventory = models.Inventory(
                    tenant_id=tenant.id,
                    product_id=product.id,
                    quantity=qty,
                    reorder_level=reorder_level,
                )
                db.add(inventory)
            else:
                inventory.quantity = max(inventory.quantity, qty)
                inventory.reorder_level = max(
                    inventory.reorder_level,
                    reorder_level,
                )

            inventory_by_product_id[product.id] = inventory

        existing_order = await db.scalar(
            select(models.Order.id).where(
                models.Order.tenant_id == tenant.id
            )
        )

        if existing_order is None:
            users_by_email = {
                user.email: user
                for user in (
                    await db.scalars(
                        select(models.User).where(models.User.tenant_id == tenant.id)
                    )
                ).all()
            }

            sample_orders = [
                {
                    "created_by": "manager@railbyte.com",
                    "items": [
                        ("CPU-7600", 2),
                        ("RAM-32-DDR5", 2),
                        ("SSD-1TB-NVME", 2),
                    ],
                },
                {
                    "created_by": "staff@railbyte.com",
                    "items": [
                        ("GPU-4070S", 1),
                        ("PSU-750-GOLD", 1),
                        ("CASE-AIR-MID", 1),
                    ],
                },
            ]

            for sample_order in sample_orders:
                creator = users_by_email.get(sample_order["created_by"])
                if creator is None:
                    continue

                order = models.Order(
                    tenant_id=tenant.id,
                    created_by_user_id=creator.id,
                    status=models.OrderStatus.PLACED.value,
                )
                db.add(order)
                await db.flush()

                total = Decimal("0")

                for sku, quantity in sample_order["items"]:
                    product = products_by_sku.get(sku)
                    if product is None:
                        continue

                    inventory = inventory_by_product_id.get(product.id)
                    if inventory is None or inventory.quantity < quantity:
                        continue

                    line_total = Decimal(product.unit_price) * quantity
                    inventory.quantity -= quantity

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
                    total += line_total

                order.total_amount = total

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
