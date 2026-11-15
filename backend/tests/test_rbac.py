import pytest
from httpx import AsyncClient


async def _register_owner(client: AsyncClient) -> tuple[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": "RBAC Parts",
            "tenant_slug": "rbac-parts",
            "email": "owner@rbac.com",
            "password": "StrongPass123!",
        },
    )
    body = response.json()
    return body["access_token"], "rbac-parts"


@pytest.mark.asyncio
async def test_owner_can_create_member_and_staff_cannot_write_catalog(
    client: AsyncClient,
    build_auth_context,
):
    owner_token, tenant_slug = await _register_owner(client)
    owner_headers = build_auth_context(owner_token, tenant_slug)

    create_staff_response = await client.post(
        "/api/v1/auth/users",
        headers=owner_headers,
        json={
            "email": "staff@rbac.com",
            "password": "StrongPass123!",
            "role": "staff",
        },
    )
    assert create_staff_response.status_code == 201
    assert create_staff_response.json()["role"] == "staff"

    create_manager_response = await client.post(
        "/api/v1/auth/users",
        headers=owner_headers,
        json={
            "email": "manager@rbac.com",
            "password": "StrongPass123!",
            "role": "manager",
        },
    )
    assert create_manager_response.status_code == 201
    assert create_manager_response.json()["role"] == "manager"

    staff_login_response = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": tenant_slug},
        json={
            "email": "staff@rbac.com",
            "password": "StrongPass123!",
        },
    )
    staff_token = staff_login_response.json()["access_token"]
    staff_headers = build_auth_context(staff_token, tenant_slug)

    denied_create_product = await client.post(
        "/api/v1/products",
        headers=staff_headers,
        json={
            "sku": "SSD-1TB",
            "name": "Fast SSD",
            "description": "Forbidden for staff",
            "unit_price": 89.99,
        },
    )
    assert denied_create_product.status_code == 403

    manager_login_response = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": tenant_slug},
        json={
            "email": "manager@rbac.com",
            "password": "StrongPass123!",
        },
    )
    manager_token = manager_login_response.json()["access_token"]
    manager_headers = build_auth_context(manager_token, tenant_slug)

    allowed_create_product = await client.post(
        "/api/v1/products",
        headers=manager_headers,
        json={
            "sku": "SSD-1TB",
            "name": "Fast SSD",
            "description": "Allowed for manager",
            "unit_price": 89.99,
        },
    )
    assert allowed_create_product.status_code == 201
