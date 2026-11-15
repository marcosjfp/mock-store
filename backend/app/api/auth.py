from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, get_current_user, require_roles
from app.db.models import Tenant, User
from app.db.session import get_db
from app.schemas.auth import (
    CreateTenantMemberRequest,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    SessionRead,
    TokenPair,
    UpdateTenantMemberRequest,
    UserRead,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    summary="Create a workspace and its owner account",
)
async def register(
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    tenant, user = await auth_service.register_tenant_owner(db, payload)
    return await auth_service.issue_token_pair(user, tenant.slug)


@router.post("/login", response_model=TokenPair)
async def login(
    payload: LoginRequest,
    tenant_slug: Annotated[str, Header(alias="X-Tenant-Slug")],
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    tenant, user = await auth_service.authenticate_user(db, tenant_slug, payload)
    return await auth_service.issue_token_pair(user, tenant.slug)


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="Rotate a refresh token for a new token pair",
)
async def refresh(
    payload: RefreshRequest,
    tenant_slug: Annotated[str, Header(alias="X-Tenant-Slug")],
    db: AsyncSession = Depends(get_db),
) -> TokenPair:
    return await auth_service.refresh_token_pair(
        db,
        payload.refresh_token,
        tenant_slug,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke a refresh token",
)
async def logout(payload: RefreshRequest) -> Response:
    await auth_service.revoke_refresh_token(payload.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=SessionRead)
async def me(
    tenant: Tenant = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
) -> SessionRead:
    return SessionRead(
        **UserRead.model_validate(current_user).model_dump(),
        tenant_name=tenant.name,
        tenant_slug=tenant.slug,
    )


@router.get("/users", response_model=list[UserRead])
async def list_members(
    tenant: Tenant = Depends(get_current_tenant),
    _user: User = Depends(require_roles("owner", "manager")),
    db: AsyncSession = Depends(get_db),
) -> list[User]:
    return await auth_service.list_tenant_members(db, tenant.id)


@router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_member(
    payload: CreateTenantMemberRequest,
    tenant: Tenant = Depends(get_current_tenant),
    owner: User = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.create_tenant_member(db, tenant.id, owner.id, payload)


@router.patch("/users/{member_id}", response_model=UserRead)
async def update_member(
    member_id: str,
    payload: UpdateTenantMemberRequest,
    tenant: Tenant = Depends(get_current_tenant),
    owner: User = Depends(require_roles("owner")),
    db: AsyncSession = Depends(get_db),
) -> User:
    return await auth_service.update_tenant_member(
        db,
        tenant.id,
        owner.id,
        member_id,
        payload,
    )
