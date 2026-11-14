from httpx import AsyncClient

PASSWORD = "StrongPass123!"


async def register_owner(client: AsyncClient, slug: str = "acme-parts") -> dict[str, str]:
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": f"{slug} store",
            "tenant_slug": slug,
            "email": f"owner@{slug}.com",
            "password": PASSWORD,
            "full_name": "Olivia Owner",
        },
    )
    assert response.status_code == 201, response.text
    return {
        "Authorization": f"Bearer {response.json()['access_token']}",
        "X-Tenant-Slug": slug,
    }


async def add_member(
    client: AsyncClient,
    owner_headers: dict[str, str],
    role: str,
) -> dict[str, str]:
    slug = owner_headers["X-Tenant-Slug"]
    email = f"{role}@{slug}.com"
    created = await client.post(
        "/api/v1/auth/users",
        headers=owner_headers,
        json={"email": email, "password": PASSWORD, "role": role},
    )
    assert created.status_code == 201, created.text
    login = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": slug},
        json={"email": email, "password": PASSWORD},
    )
    assert login.status_code == 200, login.text
    return {
        "Authorization": f"Bearer {login.json()['access_token']}",
        "X-Tenant-Slug": slug,
    }


async def add_product(
    client: AsyncClient,
    headers: dict[str, str],
    sku: str = "CPU-1",
    price: float = 100.0,
    quantity: int = 10,
    reorder_level: int = 2,
    category: str = "CPU",
) -> dict:
    response = await client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": sku,
            "name": f"Product {sku}",
            "category": category,
            "unit_price": price,
            "quantity": quantity,
            "reorder_level": reorder_level,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()
