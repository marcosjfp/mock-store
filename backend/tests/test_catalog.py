from httpx import AsyncClient

from tests.helpers import add_member, add_product, register_owner


async def test_product_list_includes_stock_and_status(client: AsyncClient):
    headers = await register_owner(client)
    await add_product(client, headers, sku="A", quantity=10, reorder_level=2)
    await add_product(client, headers, sku="B", quantity=2, reorder_level=2)
    await add_product(client, headers, sku="C", quantity=0, reorder_level=2)

    products = (await client.get("/api/v1/products", headers=headers)).json()
    by_sku = {product["sku"]: product for product in products}

    assert by_sku["A"]["stock_status"] == "in_stock"
    assert by_sku["B"]["stock_status"] == "low_stock"
    assert by_sku["C"]["stock_status"] == "out_of_stock"
    assert by_sku["A"]["quantity"] == 10
    assert by_sku["A"]["category"] == "CPU"


async def test_duplicate_sku_is_rejected(client: AsyncClient):
    headers = await register_owner(client)
    await add_product(client, headers, sku="GPU-1")

    duplicate = await client.post(
        "/api/v1/products",
        headers=headers,
        json={"sku": "gpu-1", "name": "Another GPU", "unit_price": 10},
    )
    assert duplicate.status_code == 409


async def test_unknown_category_is_rejected(client: AsyncClient):
    headers = await register_owner(client)
    response = await client.post(
        "/api/v1/products",
        headers=headers,
        json={"sku": "X", "name": "Mystery", "unit_price": 10, "category": "Snacks"},
    )
    assert response.status_code == 422


async def test_update_can_clear_description_and_archive(client: AsyncClient):
    headers = await register_owner(client)
    product = await add_product(client, headers)

    described = await client.put(
        f"/api/v1/products/{product['id']}",
        headers=headers,
        json={"description": "Fast"},
    )
    assert described.json()["description"] == "Fast"

    cleared = await client.put(
        f"/api/v1/products/{product['id']}",
        headers=headers,
        json={"description": None, "is_active": False},
    )
    assert cleared.status_code == 200
    assert cleared.json()["description"] is None
    assert cleared.json()["is_active"] is False


async def test_stock_change_is_visible_through_cached_list(client: AsyncClient):
    headers = await register_owner(client)
    product = await add_product(client, headers, quantity=5)

    # Prime the list cache, then change stock.
    await client.get("/api/v1/products", headers=headers)
    await client.put(
        f"/api/v1/inventory/{product['id']}",
        headers=headers,
        json={"quantity": 42, "reorder_level": 3},
    )

    products = (await client.get("/api/v1/products", headers=headers)).json()
    assert products[0]["quantity"] == 42
    assert products[0]["reorder_level"] == 3


async def test_ordered_product_cannot_be_deleted(client: AsyncClient):
    headers = await register_owner(client)
    ordered = await add_product(client, headers, sku="KEEP")
    unused = await add_product(client, headers, sku="DROP")

    await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"items": [{"product_id": ordered["id"], "quantity": 1}]},
    )

    blocked = await client.delete(f"/api/v1/products/{ordered['id']}", headers=headers)
    assert blocked.status_code == 409

    deleted = await client.delete(f"/api/v1/products/{unused['id']}", headers=headers)
    assert deleted.status_code == 204


async def test_tenants_cannot_see_each_others_products(client: AsyncClient):
    first = await register_owner(client, "first-shop")
    second = await register_owner(client, "second-shop")
    product = await add_product(client, first)

    assert (await client.get("/api/v1/products", headers=second)).json() == []
    hidden = await client.get(f"/api/v1/products/{product['id']}", headers=second)
    assert hidden.status_code == 404

    # A valid token presented against another tenant's slug is refused.
    crossed = {**first, "X-Tenant-Slug": "second-shop"}
    assert (await client.get("/api/v1/products", headers=crossed)).status_code == 403


async def test_staff_cannot_adjust_stock(client: AsyncClient):
    owner = await register_owner(client)
    staff = await add_member(client, owner, "staff")
    product = await add_product(client, owner)

    denied = await client.put(
        f"/api/v1/inventory/{product['id']}",
        headers=staff,
        json={"quantity": 1, "reorder_level": 0},
    )
    assert denied.status_code == 403
