import pytest
from httpx import AsyncClient


async def _register(client: AsyncClient) -> tuple[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": "Train Parts",
            "tenant_slug": "train-parts",
            "email": "owner@train.com",
            "password": "StrongPass123!",
        },
    )
    body = response.json()
    return body["access_token"], "train-parts"


@pytest.mark.asyncio
async def test_order_creation_reduces_inventory(
    client: AsyncClient,
    build_auth_context,
):
    access_token, tenant_slug = await _register(client)
    headers = build_auth_context(access_token, tenant_slug)

    create_product = await client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": "CPU-I7",
            "name": "Intel Core i7",
            "description": "Desktop processor",
            "unit_price": 299.0,
        },
    )
    product_id = create_product.json()["id"]

    update_inventory = await client.put(
        f"/api/v1/inventory/{product_id}",
        headers=headers,
        json={"quantity": 10, "reorder_level": 2},
    )
    assert update_inventory.status_code == 200

    create_order = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"items": [{"product_id": product_id, "quantity": 2}]},
    )
    assert create_order.status_code == 201
    order = create_order.json()
    assert order["total_amount"] == 598.0

    inventory_after = await client.get(
        f"/api/v1/inventory/{product_id}",
        headers=headers,
    )
    assert inventory_after.status_code == 200
    assert inventory_after.json()["quantity"] == 8
