from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cache_client
from app.core.config import get_settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db import models
from app.schemas.auth import (
    CreateTenantMemberRequest,
    LoginRequest,
    RegisterRequest,
    TokenPair,
)


def _refresh_key(tenant_id: str, user_id: str, token_id: str) -> str:
    return f"refresh:{tenant_id}:{user_id}:{token_id}"


async def register_tenant_owner(
    db: AsyncSession,
    payload: RegisterRequest,
) -> tuple[models.Tenant, models.User]:
    existing_tenant = await db.scalar(
        select(models.Tenant).where(
            models.Tenant.slug == payload.tenant_slug
        )
    )
    if existing_tenant is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tenant slug already exists",
        )

    tenant = models.Tenant(name=payload.tenant_name, slug=payload.tenant_slug)
    user = models.User(
        tenant=tenant,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=models.UserRole.OWNER.value,
    )
    db.add_all([tenant, user])
    await db.commit()
    await db.refresh(tenant)
    await db.refresh(user)
    return tenant, user


async def authenticate_user(
    db: AsyncSession,
    tenant_slug: str,
    payload: LoginRequest,
) -> tuple[models.Tenant, models.User]:
    tenant = await db.scalar(
        select(models.Tenant).where(models.Tenant.slug == tenant_slug)
    )
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    stmt = select(models.User).where(
        models.User.tenant_id == tenant.id,
        models.User.email == payload.email,
    )
    user = await db.scalar(stmt)

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    return tenant, user


async def issue_token_pair(user: models.User, tenant_slug: str) -> TokenPair:
    settings = get_settings()
    access_token = create_access_token(
        user.id,
        user.tenant_id,
        tenant_slug,
        user.role,
    )
    refresh_token, token_id = create_refresh_token(
        user.id,
        user.tenant_id,
        tenant_slug,
        user.role,
    )

    await cache_client.set_value(
        _refresh_key(user.tenant_id, user.id, token_id),
        user.id,
        ttl_seconds=settings.REFRESH_TOKEN_EXPIRE_MINUTES * 60,
    )

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def refresh_token_pair(
    db: AsyncSession,
    refresh_token: str,
    tenant_slug: str,
) -> TokenPair:
    payload = decode_token(refresh_token)
    if payload.get("typ") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id = payload.get("sub")
    tenant_id = payload.get("tid")
    token_id = payload.get("jti")
    token_slug = payload.get("tslug")

    if not user_id or not tenant_id or not token_id or token_slug != tenant_slug:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    key = _refresh_key(tenant_id, user_id, token_id)
    active_session = await cache_client.get_value(key)
    if active_session != user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token revoked",
        )

    user = await db.scalar(
        select(models.User).where(
            models.User.id == user_id,
            models.User.tenant_id == tenant_id,
        )
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    await cache_client.delete_value(key)
    return await issue_token_pair(user, tenant_slug)


async def create_tenant_member(
    db: AsyncSession,
    tenant_id: str,
    payload: CreateTenantMemberRequest,
) -> models.User:
    existing_user = await db.scalar(
        select(models.User).where(
            models.User.tenant_id == tenant_id,
            models.User.email == payload.email,
        )
    )
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists in tenant",
        )

    user = models.User(
        tenant_id=tenant_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
