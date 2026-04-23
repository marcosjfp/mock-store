# Multi-tenant SaaS Order/Inventory Manager Blueprint

This project is a training-ready blueprint for a **multi-tenant computer parts store** that uses a modern production stack:

- FastAPI (async API)
- SQLAlchemy 2.0 (ORM)
- PostgreSQL (scalable relational DB)
- JWT access + refresh tokens
- Role-based access control (owner, manager, staff)
- CRUD for products, inventory, and orders
- Redis (cache + refresh session storage)
- RabbitMQ (async order events)
- React + TypeScript frontend
- Testing with pytest/httpx and Vitest
- Alembic migrations + demo seed script
- Docker Compose for full local stack

## 1. Architecture Overview

### Backend

- Tenant isolation through `X-Tenant-Slug` header + JWT tenant claims.
- Access token: short-lived API auth.
- Refresh token: long-lived, stored/revoked through Redis.
- RBAC matrix:
  - owner: full tenant control, including creating manager/staff users.
  - manager: product + inventory write access.
  - staff: read access and order creation.
- Product CRUD with Redis response caching.
- Order creation validates stock, updates inventory, writes order records, then publishes `order.created` event to RabbitMQ.
- Worker consumes `order.created` and simulates async notification handling.

### Frontend

- Tenant-aware login/register flow.
- Dashboard for product management, inventory updates, and order placement.
- Role-aware UI behavior:
  - owner/manager: can create products and update inventory.
  - staff: read-only catalog and inventory controls.
- Uses API token + tenant slug for all authenticated calls.

## 2. Project Structure

```text
backend/
  alembic/
    versions/
  app/
    api/
    core/
    db/
    schemas/
    services/
    workers/
  tests/
  scripts/
frontend/
  src/
docker-compose.yml
```

## 3. Quick Start With Docker

```bash
docker compose up --build
```

Services:

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- RabbitMQ UI: [http://localhost:15672](http://localhost:15672) (guest / guest)

## 4. Run Without Docker

### Backend Local

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### Seed Demo Data

```bash
cd backend
python scripts/seed_demo.py
```

Seeded tenant credentials:

- tenant slug: `rail-byte-demo`
- owner: `owner@railbyte.com` / `StrongPass123!`
- manager: `manager@railbyte.com` / `StrongPass123!`
- staff: `staff@railbyte.com` / `StrongPass123!`

Seeded catalog now includes a richer computer-parts dataset (CPU/GPU/RAM/SSD/PSU/case/cooling/network components), inventory levels, and sample orders so you can explore product, stock, and order flows immediately.

### Frontend Local

```bash
cd frontend
npm install
npm run dev
```

## 5. Testing

### Backend tests

```bash
cd backend
pytest
```

### Frontend tests

```bash
cd frontend
npm test
```

## 6. Migrations

Current migration chain:

- `20260422_0001`: initial schema
- `20260422_0002`: adds `audit_logs` table

Create a new migration revision:

```bash
cd backend
alembic revision -m "your change name"
```

## 7. Learning Path

1. Start with auth flow (`/api/v1/auth/*`) and inspect JWT claims.
2. Create products and inventory records per tenant.
3. Place orders and verify inventory decreases.
4. Watch order events flow through RabbitMQ to worker.
5. Use owner account to create manager/staff via `POST /api/v1/auth/users`.
6. Verify RBAC boundaries with role-specific logins.
7. Extend with pagination and audit logs.

## 8. Next Enhancements (Probaly)

- Soft deletes and full audit trail.
- Background email/Slack notification service.
- Metrics and tracing (Prometheus/OpenTelemetry).
