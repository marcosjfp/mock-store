from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.inventory import InventoryRead, InventoryUpdate
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/{product_id}", response_model=InventoryRead)
async def get_inventory(
    product_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await inventory_service.get_inventory_by_product(
        db,
        tenant.id,
        product_id,
    )


@router.put("/{product_id}", response_model=InventoryRead)
async def update_inventory(
    product_id: str,
    payload: InventoryUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await inventory_service.update_inventory(
        db,
        tenant.id,
        product_id,
        payload,
    )
