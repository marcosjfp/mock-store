from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.product import ProductCreate, ProductRead, ProductUpdate
from app.services import product_service

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductRead])
async def list_products(
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await product_service.list_products(db, tenant.id)


@router.post(
    "",
    response_model=ProductRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    payload: ProductCreate,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await product_service.create_product(db, tenant.id, payload)


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(
    product_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await product_service.get_product_or_404(db, tenant.id, product_id)


@router.put("/{product_id}", response_model=ProductRead)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    return await product_service.update_product(
        db,
        tenant.id,
        product_id,
        payload,
    )


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await product_service.delete_product(db, tenant.id, product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
