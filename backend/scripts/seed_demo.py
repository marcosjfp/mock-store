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

        sample_products = [
            ("CPU-7800X3D", "AMD Ryzen 7 7800X3D", Decimal("389.00"), 25),
            ("GPU-4070S", "NVIDIA RTX 4070 Super", Decimal("619.00"), 12),
            ("RAM-32-DDR5", "Corsair 32GB DDR5 Kit", Decimal("159.00"), 40),
        ]

        for sku, name, price, qty in sample_products:
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
                    description="Demo seeded computer part",
                )
                db.add(product)
                await db.flush()

            inventory = await db.scalar(
                select(models.Inventory).where(
                    models.Inventory.tenant_id == tenant.id,
                    models.Inventory.product_id == product.id,
                )
            )
            if inventory is None:
                db.add(
                    models.Inventory(
                        tenant_id=tenant.id,
                        product_id=product.id,
                        quantity=qty,
                        reorder_level=5,
                    )
                )

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
