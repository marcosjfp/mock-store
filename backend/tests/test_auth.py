import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_me_refresh_rotation(
    client: AsyncClient,
    build_auth_context,
):
    register_payload = {
        "tenant_name": "Acme Components",
        "tenant_slug": "acme",
        "email": "owner@acme.com",
        "password": "StrongPass123!",
    }

    register_response = await client.post(
        "/api/v1/auth/register",
        json=register_payload,
    )
    assert register_response.status_code == 201

    tokens = register_response.json()
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    headers = build_auth_context(tokens["access_token"], "acme")
    me_response = await client.get("/api/v1/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "owner@acme.com"
    assert me_response.json()["role"] == "owner"

    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"X-Tenant-Slug": "acme"},
    )
    assert refresh_response.status_code == 200
    rotated = refresh_response.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]

    revoked_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
        headers={"X-Tenant-Slug": "acme"},
    )
    assert revoked_response.status_code == 401
