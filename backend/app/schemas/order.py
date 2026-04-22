from pydantic import BaseModel, ConfigDict, Field


class OrderItemCreate(BaseModel):
    product_id: str
    quantity: int = Field(ge=1)


class OrderCreate(BaseModel):
    items: list[OrderItemCreate] = Field(min_length=1)


class OrderItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    product_id: str
    quantity: int
    unit_price: float
    line_total: float


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    created_by_user_id: str
    status: str
    total_amount: float
    items: list[OrderItemRead]
