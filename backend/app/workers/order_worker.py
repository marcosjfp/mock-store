import asyncio
import json

import aio_pika

from app.core.cache import cache_client
from app.core.config import get_settings


async def run_order_notification_worker() -> None:
    settings = get_settings()
    await cache_client.connect()

    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    channel = await connection.channel()
    queue = await channel.declare_queue(settings.RABBITMQ_QUEUE, durable=True)

    async with queue.iterator() as queue_iter:
        async for message in queue_iter:
            async with message.process():
                payload = json.loads(message.body.decode("utf-8"))
                cache_key = (
                    f"notification:{payload['tenant_id']}:"
                    f"{payload['order_id']}"
                )
                await cache_client.set_json(
                    cache_key,
                    payload,
                    ttl_seconds=3600,
                )
                print(f"Processed order event: {payload['order_id']}")


if __name__ == "__main__":
    asyncio.run(run_order_notification_worker())
