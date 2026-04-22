from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db import models
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_tenant(
    tenant_slug: Annotated[str, Header(alias="X-Tenant-Slug")],
    db: AsyncSession = Depends(get_db),
) -> models.Tenant:
    tenant = await db.scalar(
        select(models.Tenant).where(models.Tenant.slug == tenant_slug)
    )
    if tenant is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found",
        )
    return tenant


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    tenant: models.Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> models.User:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from exc

    if payload.get("typ") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )

    token_tenant_id = payload.get("tid")
    token_tenant_slug = payload.get("tslug")
    token_role = payload.get("rol")
    user_id = payload.get("sub")

    if token_tenant_id != tenant.id or token_tenant_slug != tenant.slug:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant mismatch",
        )

    user = await db.scalar(
        select(models.User).where(
            models.User.id == user_id,
            models.User.tenant_id == tenant.id,
        )
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if token_role is not None and token_role != user.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token role out of date",
        )

    return user


def require_roles(*allowed_roles: str):
    async def _role_guard(
        current_user: models.User = Depends(get_current_user),
    ) -> models.User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient role permissions",
            )
        return current_user

    return _role_guard
