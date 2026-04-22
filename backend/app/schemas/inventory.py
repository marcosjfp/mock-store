from pydantic import BaseModel, ConfigDict, Field


class InventoryUpdate(BaseModel):
    quantity: int = Field(ge=0)
    reorder_level: int = Field(ge=0, default=0)


class InventoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    product_id: str
    quantity: int
    reorder_level: int
