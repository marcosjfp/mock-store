from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.db.models import PRODUCT_CATEGORIES

Category = Literal[*PRODUCT_CATEGORIES]  # type: ignore[valid-type]
StockStatus = Literal["in_stock", "low_stock", "out_of_stock"]


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    category: Category = "Other"
    unit_price: float = Field(gt=0, le=99_999_999)
    quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    category: Category | None = None
    unit_price: float | None = Field(default=None, gt=0, le=99_999_999)
    is_active: bool | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    sku: str
    name: str
    description: str | None
    category: str
    unit_price: float
    is_active: bool
    quantity: int
    reorder_level: int
    stock_status: StockStatus
    created_at: datetime | None = None
