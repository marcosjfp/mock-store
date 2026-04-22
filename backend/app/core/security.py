from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from app.core.config import get_settings


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8"),
    )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")


def _create_token(payload: dict[str, Any], expires_delta: timedelta) -> str:
    settings = get_settings()
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def create_access_token(
    subject: str,
    tenant_id: str,
    tenant_slug: str,
    role: str,
) -> str:
    settings = get_settings()
    payload = {
        "sub": subject,
        "tid": tenant_id,
        "tslug": tenant_slug,
        "rol": role,
        "typ": "access",
    }
    return _create_token(
        payload,
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(
    subject: str,
    tenant_id: str,
    tenant_slug: str,
    role: str,
) -> tuple[str, str]:
    settings = get_settings()
    token_id = str(uuid4())
    payload = {
        "sub": subject,
        "tid": tenant_id,
        "tslug": tenant_slug,
        "rol": role,
        "jti": token_id,
        "typ": "refresh",
    }
    token = _create_token(
        payload,
        timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES),
    )
    return token, token_id


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise ValueError("Invalid token") from exc
