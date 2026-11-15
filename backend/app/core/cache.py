import fnmatch
import json
import time
from typing import Any

from redis.asyncio import Redis

from app.core.config import get_settings


class CacheClient:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis: Redis | None = None
        self._memory: dict[str, tuple[float | None, str]] = {}

    async def connect(self) -> None:
        if not self.settings.REDIS_ENABLED:
            return
        try:
            self._redis = Redis.from_url(
                self.settings.REDIS_URL,
                decode_responses=True,
            )
            await self._redis.ping()
        except Exception:
            self._redis = None

    async def disconnect(self) -> None:
        if self._redis is not None:
            await self._redis.aclose()
            self._redis = None

    def _memory_read(self, key: str) -> str | None:
        item = self._memory.get(key)
        if item is None:
            return None
        expires_at, value = item
        if expires_at is not None and expires_at < time.time():
            self._memory.pop(key, None)
            return None
        return value

    def _memory_write(
        self,
        key: str,
        value: str,
        ttl_seconds: int | None,
    ) -> None:
        expires_at = None if ttl_seconds is None else (time.time() + ttl_seconds)
        self._memory[key] = (expires_at, value)

    async def get_value(self, key: str) -> str | None:
        if self._redis is not None:
            return await self._redis.get(key)
        return self._memory_read(key)

    async def set_value(
        self,
        key: str,
        value: str,
        ttl_seconds: int | None = None,
    ) -> None:
        if self._redis is not None:
            if ttl_seconds is None:
                await self._redis.set(key, value)
            else:
                await self._redis.set(key, value, ex=ttl_seconds)
            return
        self._memory_write(key, value, ttl_seconds)

    async def delete_value(self, key: str) -> None:
        if self._redis is not None:
            await self._redis.delete(key)
            return
        self._memory.pop(key, None)

    async def get_json(self, key: str) -> Any:
        raw = await self.get_value(key)
        if raw is None:
            return None
        return json.loads(raw)

    async def set_json(
        self,
        key: str,
        value: Any,
        ttl_seconds: int | None = None,
    ) -> None:
        await self.set_value(key, json.dumps(value), ttl_seconds)

    async def delete_pattern(self, pattern: str) -> None:
        if self._redis is not None:
            cursor = 0
            while True:
                cursor, keys = await self._redis.scan(
                    cursor=cursor,
                    match=pattern,
                    count=100,
                )
                if keys:
                    await self._redis.delete(*keys)
                if cursor == 0:
                    break
            return
        for key in list(self._memory.keys()):
            if fnmatch.fnmatch(key, pattern):
                self._memory.pop(key, None)


cache_client = CacheClient()
