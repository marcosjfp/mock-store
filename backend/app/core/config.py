from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Multi-tenant Order Inventory Manager"
    API_V1_PREFIX: str = "/api/v1"

    SECRET_KEY: str = "change-me-for-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = (
        "postgresql+asyncpg://store_user:store_pass@postgres:5432/store_db"
    )
    REDIS_URL: str = "redis://redis:6379/0"
    RABBITMQ_URL: str = "amqp://guest:guest@rabbitmq:5672/"
    RABBITMQ_QUEUE: str = "order.created"

    REDIS_ENABLED: bool = True
    RABBITMQ_ENABLED: bool = True
    CACHE_TTL_SECONDS: int = 60

    CORS_ORIGINS: list[str] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
