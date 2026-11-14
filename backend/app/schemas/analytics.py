from pydantic import BaseModel


class Metric(BaseModel):
    value: float
    previous: float
    change_pct: float | None


class DailyPoint(BaseModel):
    date: str
    revenue: float
    orders: int


class TopProduct(BaseModel):
    product_id: str
    name: str
    sku: str
    category: str
    units: int
    revenue: float


class CategorySlice(BaseModel):
    category: str
    revenue: float
    units: int


class LowStockItem(BaseModel):
    product_id: str
    name: str
    sku: str
    category: str
    quantity: int
    reorder_level: int


class InventoryHealth(BaseModel):
    active_products: int
    total_units: int
    stock_value: float
    in_stock: int
    low_stock: int
    out_of_stock: int


class AnalyticsSummary(BaseModel):
    days: int
    revenue: Metric
    orders: Metric
    average_order_value: Metric
    units_sold: Metric
    cancelled_orders: int
    open_orders: int
    series: list[DailyPoint]
    top_products: list[TopProduct]
    categories: list[CategorySlice]
    inventory: InventoryHealth
    low_stock: list[LowStockItem]
