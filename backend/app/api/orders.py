from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.order import OrderCreate, OrderRead
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderRead])
async def list_orders(
    status_filter: Literal["placed", "fulfilled", "cancelled"] | None = Query(
        default=None,
        alias="status",
    ),
    limit: int = Query(default=200, ge=1, le=500),
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await order_service.list_orders(db, tenant.id, status_filter, limit)


@router.post(
    "",
    response_model=OrderRead,
    status_code=status.HTTP_201_CREATED,
    summary="Place an order and reserve its stock",
)
async def create_order(
    payload: OrderCreate,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await order_service.create_order(db, tenant.id, user.id, payload)


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await order_service.get_order(db, tenant.id, order_id)


@router.post(
    "/{order_id}/fulfill",
    response_model=OrderRead,
    summary="Mark a placed order as fulfilled",
)
async def fulfill_order(
    order_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await order_service.fulfill_order(db, tenant.id, user.id, order_id)


@router.post(
    "/{order_id}/cancel",
    response_model=OrderRead,
    summary="Cancel a placed order and return its units to stock",
)
async def cancel_order(
    order_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await order_service.cancel_order(db, tenant.id, user.id, order_id)
