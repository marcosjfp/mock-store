import json
from typing import Any

import aio_pika
from aio_pika.abc import AbstractRobustChannel, AbstractRobustConnection

from app.core.config import get_settings


class MessagePublisher:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._connection: AbstractRobustConnection | None = None
        self._channel: AbstractRobustChannel | None = None

    async def connect(self) -> None:
        if not self.settings.RABBITMQ_ENABLED:
            return
        try:
            self._connection = await aio_pika.connect_robust(
                self.settings.RABBITMQ_URL
            )
            self._channel = await self._connection.channel()
            await self._channel.declare_queue(
                self.settings.RABBITMQ_QUEUE,
                durable=True,
            )
        except Exception:
            self._connection = None
            self._channel = None

    async def disconnect(self) -> None:
        if self._channel is not None:
            await self._channel.close()
            self._channel = None
        if self._connection is not None:
            await self._connection.close()
            self._connection = None

    async def publish_order_created(self, payload: dict[str, Any]) -> None:
        if self._channel is None:
            return
        body = json.dumps(payload).encode("utf-8")
        message = aio_pika.Message(
            body=body,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await self._channel.default_exchange.publish(
            message,
            routing_key=self.settings.RABBITMQ_QUEUE,
        )


publisher = MessagePublisher()
