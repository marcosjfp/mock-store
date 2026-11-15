from httpx import AsyncClient

from tests.helpers import add_member, add_product, register_owner


async def _stock(client: AsyncClient, headers: dict, product_id: str) -> int:
    response = await client.get(f"/api/v1/inventory/{product_id}", headers=headers)
    return response.json()["quantity"]


async def test_multi_item_order_totals_and_numbering(client: AsyncClient):
    headers = await register_owner(client)
    cpu = await add_product(client, headers, sku="CPU", price=300, quantity=5)
    ram = await add_product(client, headers, sku="RAM", price=80.5, quantity=9)

    first = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "customer_name": "  Atlas Robotics ",
            "items": [
                {"product_id": cpu["id"], "quantity": 1},
                {"product_id": ram["id"], "quantity": 2},
                {"product_id": ram["id"], "quantity": 1},
            ],
        },
    )
    assert first.status_code == 201
    order = first.json()
    assert order["number"] == 1001
    assert order["customer_name"] == "Atlas Robotics"
    assert order["total_amount"] == 541.5
    assert order["item_count"] == 4
    # Duplicate lines for the same product are merged.
    assert len(order["items"]) == 2
    assert {item["product_sku"] for item in order["items"]} == {"CPU", "RAM"}
    assert order["created_by_name"] == "Olivia Owner"
    assert order["created_at"].endswith(("Z", "+00:00"))

    second = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"items": [{"product_id": cpu["id"], "quantity": 1}]},
    )
    assert second.json()["number"] == 1002
    assert await _stock(client, headers, ram["id"]) == 6


async def test_insufficient_stock_rejects_whole_order(client: AsyncClient):
    headers = await register_owner(client)
    plenty = await add_product(client, headers, sku="PLENTY", quantity=10)
    scarce = await add_product(client, headers, sku="SCARCE", quantity=1)

    response = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={
            "items": [
                {"product_id": plenty["id"], "quantity": 2},
                {"product_id": scarce["id"], "quantity": 2},
            ]
        },
    )
    assert response.status_code == 409
    assert "Not enough stock" in response.json()["detail"]
    assert await _stock(client, headers, plenty["id"]) == 10
    assert (await client.get("/api/v1/orders", headers=headers)).json() == []


async def test_archived_product_cannot_be_ordered(client: AsyncClient):
    headers = await register_owner(client)
    product = await add_product(client, headers)
    await client.put(
        f"/api/v1/products/{product['id']}",
        headers=headers,
        json={"is_active": False},
    )

    response = await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert response.status_code == 400


async def test_cancel_restocks_and_is_final(client: AsyncClient):
    headers = await register_owner(client)
    product = await add_product(client, headers, quantity=10)
    order = (
        await client.post(
            "/api/v1/orders",
            headers=headers,
            json={"items": [{"product_id": product["id"], "quantity": 4}]},
        )
    ).json()
    assert await _stock(client, headers, product["id"]) == 6

    cancelled = await client.post(f"/api/v1/orders/{order['id']}/cancel", headers=headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert await _stock(client, headers, product["id"]) == 10

    again = await client.post(f"/api/v1/orders/{order['id']}/cancel", headers=headers)
    assert again.status_code == 409
    fulfill = await client.post(f"/api/v1/orders/{order['id']}/fulfill", headers=headers)
    assert fulfill.status_code == 409
    assert await _stock(client, headers, product["id"]) == 10


async def test_staff_can_fulfill_but_not_cancel(client: AsyncClient):
    owner = await register_owner(client)
    staff = await add_member(client, owner, "staff")
    product = await add_product(client, owner)
    order = (
        await client.post(
            "/api/v1/orders",
            headers=staff,
            json={"items": [{"product_id": product["id"], "quantity": 1}]},
        )
    ).json()

    denied = await client.post(f"/api/v1/orders/{order['id']}/cancel", headers=staff)
    assert denied.status_code == 403

    fulfilled = await client.post(f"/api/v1/orders/{order['id']}/fulfill", headers=staff)
    assert fulfilled.json()["status"] == "fulfilled"

    listed = await client.get("/api/v1/orders?status=fulfilled", headers=owner)
    assert [item["id"] for item in listed.json()] == [order["id"]]
    assert (await client.get("/api/v1/orders?status=placed", headers=owner)).json() == []
