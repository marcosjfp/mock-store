import pytest
from httpx import AsyncClient


async def _register(client: AsyncClient) -> tuple[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": "Bits Warehouse",
            "tenant_slug": "bits",
            "email": "owner@bits.com",
            "password": "StrongPass123!",
        },
    )
    body = response.json()
    return body["access_token"], "bits"


@pytest.mark.asyncio
async def test_product_crud_flow(client: AsyncClient, build_auth_context):
    access_token, tenant_slug = await _register(client)
    headers = build_auth_context(access_token, tenant_slug)

    create_response = await client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": "GPU-4060",
            "name": "NVIDIA RTX 4060",
            "description": "Mid-range GPU",
            "unit_price": 329.99,
        },
    )
    assert create_response.status_code == 201
    product = create_response.json()

    list_response = await client.get("/api/v1/products", headers=headers)
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    update_response = await client.put(
        f"/api/v1/products/{product['id']}",
        headers=headers,
        json={"unit_price": 319.99, "name": "NVIDIA RTX 4060 OC"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["unit_price"] == 319.99

    get_response = await client.get(
        f"/api/v1/products/{product['id']}",
        headers=headers,
    )
    assert get_response.status_code == 200
    assert get_response.json()["name"] == "NVIDIA RTX 4060 OC"
