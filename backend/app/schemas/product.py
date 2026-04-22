from pydantic import BaseModel, ConfigDict, Field


class ProductCreate(BaseModel):
    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    unit_price: float = Field(gt=0)


class ProductUpdate(BaseModel):
    sku: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=2, max_length=180)
    description: str | None = Field(default=None, max_length=500)
    unit_price: float | None = Field(default=None, gt=0)
    is_active: bool | None = None


class ProductRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    sku: str
    name: str
    description: str | None
    unit_price: float
    is_active: bool
