from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=120)
    tenant_slug: str = Field(
        min_length=2,
        max_length=80,
        pattern=r"^[a-z0-9-]+$",
    )
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class CreateTenantMemberRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(pattern=r"^(manager|staff)$")
    full_name: str | None = Field(default=None, max_length=120)


class UpdateTenantMemberRequest(BaseModel):
    role: str | None = Field(default=None, pattern=r"^(manager|staff)$")
    is_active: bool | None = None
    full_name: str | None = Field(default=None, max_length=120)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    email: EmailStr
    full_name: str | None = None
    role: str
    is_active: bool
    created_at: datetime | None = None


class SessionRead(UserRead):
    """The signed-in user plus the workspace they belong to."""

    tenant_name: str
    tenant_slug: str
