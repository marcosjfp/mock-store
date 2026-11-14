"""product categories, order numbers, customer names, user names

Revision ID: 20261114_0003
Revises: 20260422_0002
Create Date: 2026-11-14 00:00:00
"""

from typing import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20261114_0003"
down_revision: str | None = "20260422_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ORDER_SEQ_START = 1000


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column(
            "order_seq",
            sa.Integer(),
            nullable=False,
            server_default=str(ORDER_SEQ_START),
        ),
    )
    op.add_column(
        "users",
        sa.Column("full_name", sa.String(length=120), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column(
            "category",
            sa.String(length=40),
            nullable=False,
            server_default="Other",
        ),
    )
    op.add_column(
        "orders",
        sa.Column("number", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "orders",
        sa.Column("customer_name", sa.String(length=120), nullable=True),
    )
    op.create_index(op.f("ix_orders_status"), "orders", ["status"], unique=False)

    _backfill_order_numbers()


def _backfill_order_numbers() -> None:
    """Number pre-existing orders per tenant, oldest first."""
    bind = op.get_bind()
    tenant_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM tenants"))]

    for tenant_id in tenant_ids:
        order_ids = [
            row[0]
            for row in bind.execute(
                sa.text(
                    "SELECT id FROM orders WHERE tenant_id = :tenant_id "
                    "ORDER BY created_at ASC, id ASC"
                ),
                {"tenant_id": tenant_id},
            )
        ]
        number = ORDER_SEQ_START
        for order_id in order_ids:
            number += 1
            bind.execute(
                sa.text("UPDATE orders SET number = :number WHERE id = :id"),
                {"number": number, "id": order_id},
            )
        bind.execute(
            sa.text("UPDATE tenants SET order_seq = :seq WHERE id = :id"),
            {"seq": number, "id": tenant_id},
        )


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_status"), table_name="orders")
    with op.batch_alter_table("orders") as batch:
        batch.drop_column("customer_name")
        batch.drop_column("number")
    with op.batch_alter_table("products") as batch:
        batch.drop_column("category")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("full_name")
    with op.batch_alter_table("tenants") as batch:
        batch.drop_column("order_seq")
