from fastapi import APIRouter

from app.api import analytics, audit, auth, inventory, orders, products

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(orders.router)
api_router.include_router(analytics.router)
api_router.include_router(audit.router)
