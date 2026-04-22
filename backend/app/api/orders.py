from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.order import OrderCreate, OrderRead
from app.services import order_service

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderRead])
async def list_orders(
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await order_service.list_orders(db, tenant.id)


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
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
