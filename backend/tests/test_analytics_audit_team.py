from httpx import AsyncClient

from tests.helpers import PASSWORD, add_member, add_product, register_owner


async def test_analytics_summary_reflects_orders(client: AsyncClient):
    headers = await register_owner(client)
    cpu = await add_product(client, headers, sku="CPU", price=200, quantity=10, category="CPU")
    fan = await add_product(
        client, headers, sku="FAN", price=10, quantity=3, reorder_level=5, category="Cooling"
    )

    await client.post(
        "/api/v1/orders",
        headers=headers,
        json={"items": [{"product_id": cpu["id"], "quantity": 2}]},
    )
    to_cancel = (
        await client.post(
            "/api/v1/orders",
            headers=headers,
            json={"items": [{"product_id": fan["id"], "quantity": 1}]},
        )
    ).json()
    await client.post(f"/api/v1/orders/{to_cancel['id']}/cancel", headers=headers)

    response = await client.get("/api/v1/analytics/summary?days=7", headers=headers)
    assert response.status_code == 200
    summary = response.json()

    assert summary["revenue"]["value"] == 400
    assert summary["revenue"]["change_pct"] is None
    assert summary["orders"]["value"] == 1
    assert summary["units_sold"]["value"] == 2
    assert summary["cancelled_orders"] == 1
    assert summary["open_orders"] == 1
    assert len(summary["series"]) == 7
    assert summary["series"][-1]["revenue"] == 400
    assert summary["top_products"][0]["sku"] == "CPU"
    assert summary["categories"] == [{"category": "CPU", "revenue": 400, "units": 2}]
    assert summary["inventory"]["low_stock"] == 1
    assert summary["inventory"]["stock_value"] == 8 * 200 + 3 * 10
    assert [item["sku"] for item in summary["low_stock"]] == ["FAN"]


async def test_audit_log_records_changes_and_is_restricted(client: AsyncClient):
    owner = await register_owner(client)
    staff = await add_member(client, owner, "staff")
    product = await add_product(client, owner)
    await client.put(
        f"/api/v1/inventory/{product['id']}",
        headers=owner,
        json={"quantity": 20, "reorder_level": 2},
    )
    await client.post(
        "/api/v1/orders",
        headers=staff,
        json={"items": [{"product_id": product["id"], "quantity": 1}]},
    )

    entries = (await client.get("/api/v1/audit-logs", headers=owner)).json()
    events = [entry["event_type"] for entry in entries]
    assert set(events) == {
        "member.invited",
        "product.created",
        "inventory.adjusted",
        "order.placed",
    }
    placed = next(entry for entry in entries if entry["event_type"] == "order.placed")
    assert placed["summary"] == "Placed order #1001"
    assert placed["actor_email"] == staff_email(owner)

    only_orders = await client.get(
        "/api/v1/audit-logs?resource_type=order", headers=owner
    )
    assert [entry["event_type"] for entry in only_orders.json()] == ["order.placed"]

    assert (await client.get("/api/v1/audit-logs", headers=staff)).status_code == 403


def staff_email(owner_headers: dict[str, str]) -> str:
    return f"staff@{owner_headers['X-Tenant-Slug']}.com"


async def test_owner_manages_team_and_deactivation_locks_out(client: AsyncClient):
    owner = await register_owner(client)
    staff = await add_member(client, owner, "staff")

    members = (await client.get("/api/v1/auth/users", headers=owner)).json()
    assert [member["role"] for member in members] == ["owner", "staff"]
    staff_id = members[1]["id"]
    owner_id = members[0]["id"]

    assert (await client.get("/api/v1/auth/users", headers=staff)).status_code == 403

    promoted = await client.patch(
        f"/api/v1/auth/users/{staff_id}", headers=owner, json={"role": "manager"}
    )
    assert promoted.json()["role"] == "manager"
    # The old token still carries the staff role, so it is no longer accepted.
    assert (await client.get("/api/v1/products", headers=staff)).status_code == 401

    protected = await client.patch(
        f"/api/v1/auth/users/{owner_id}", headers=owner, json={"is_active": False}
    )
    assert protected.status_code == 400

    await client.patch(
        f"/api/v1/auth/users/{staff_id}", headers=owner, json={"is_active": False}
    )
    login = await client.post(
        "/api/v1/auth/login",
        headers={"X-Tenant-Slug": owner["X-Tenant-Slug"]},
        json={"email": staff_email(owner), "password": PASSWORD},
    )
    # Indistinguishable from a wrong password, so accounts can't be probed.
    assert login.status_code == 401


async def test_me_returns_workspace_and_logout_revokes_refresh(client: AsyncClient):
    slug = "session-shop"
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "tenant_name": "Session Shop",
            "tenant_slug": slug,
            "email": "Owner@Session.com",
            "password": PASSWORD,
        },
    )
    tokens = registered.json()
    headers = {
        "Authorization": f"Bearer {tokens['access_token']}",
        "X-Tenant-Slug": slug,
    }

    me = (await client.get("/api/v1/auth/me", headers=headers)).json()
    assert me["tenant_name"] == "Session Shop"
    assert me["email"] == "owner@session.com"
    assert me["role"] == "owner"

    logout = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert logout.status_code == 204

    refresh = await client.post(
        "/api/v1/auth/refresh",
        headers={"X-Tenant-Slug": slug},
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refresh.status_code == 401

    garbage = await client.post(
        "/api/v1/auth/refresh",
        headers={"X-Tenant-Slug": slug},
        json={"refresh_token": "not-a-jwt"},
    )
    assert garbage.status_code == 401
