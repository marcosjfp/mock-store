from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=10_000)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1, max_length=100)
    customer_name: str | None = Field(default=None, max_length=120)

    @field_validator("customer_name")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    product_name: str
    product_sku: str
    quantity: int
    unit_price: float
    line_total: float


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    number: int
    tenant_id: str
    created_by_user_id: str
    created_by_email: str | None
    created_by_name: str | None
    customer_name: str | None
    status: str
    total_amount: float
    item_count: int
    created_at: datetime | None
    updated_at: datetime | None
    items: list[OrderItemRead]
