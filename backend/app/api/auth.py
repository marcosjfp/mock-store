from typing import Annotated

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.auth import (
    CreateTenantMemberRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserRead,
)
from app.services.auth_service import (
    authenticate_user,
    create_tenant_member,
    issue_token_pair,
    refresh_token_pair,
    register_tenant_owner,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    tenant, user = await register_tenant_owner(db, payload)
    return await issue_token_pair(user, tenant.slug)


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    tenant_slug: Annotated[str, Header(alias="X-Tenant-Slug")],
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    tenant, user = await authenticate_user(db, tenant_slug, payload)
    return await issue_token_pair(user, tenant.slug)


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshRequest,
    tenant_slug: Annotated[str, Header(alias="X-Tenant-Slug")],
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await refresh_token_pair(db, payload.refresh_token, tenant_slug)


@router.get("/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_member(
    payload: CreateTenantMemberRequest,
    tenant: Tenant = Depends(get_current_tenant),
    _owner: User = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await create_tenant_member(db, tenant.id, payload)
