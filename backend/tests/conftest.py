import os
from collections.abc import AsyncIterator, Callable
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"
os.environ["REDIS_ENABLED"] = "false"
os.environ["RABBITMQ_ENABLED"] = "false"
os.environ["SECRET_KEY"] = "test-secret"

from app.core.config import get_settings  # noqa: E402

get_settings.cache_clear()

from app.main import create_app  # noqa: E402
from app.db.models import Base  # noqa: E402
from app.db.session import engine  # noqa: E402


@pytest_asyncio.fixture(scope="session")
async def app():
    return create_app()


@pytest_asyncio.fixture(autouse=True)
async def reset_database() -> AsyncIterator[None]:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture
async def client(app) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
    ) as async_client:
        yield async_client


@pytest.fixture
def build_auth_context() -> Callable[[str, str], dict[str, Any]]:
    def _build(access_token: str, tenant_slug: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {access_token}",
            "X-Tenant-Slug": tenant_slug,
        }

    return _build
