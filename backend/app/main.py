from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.cache import cache_client
from app.core.config import get_settings
from app.core.messaging import publisher


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await cache_client.connect()
        await publisher.connect()
        yield
        await publisher.disconnect()
        await cache_client.disconnect()

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description=(
            "Multi-tenant order and inventory API. Every request is scoped to a "
            "workspace through the `X-Tenant-Slug` header and a JWT carrying the "
            "matching tenant claim; write access is gated by role "
            "(owner, manager, staff)."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    return app


app = create_app()
