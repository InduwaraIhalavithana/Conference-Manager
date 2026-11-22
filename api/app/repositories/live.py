"""Live updates over Redis pub/sub (Observer pattern): check-ins are published per conference, and every open
check-in desk or dashboard for that conference listens."""

import json
from collections.abc import AsyncIterator
from typing import Any

from beanie import PydanticObjectId

from app.db import redis


def _channel(conference_id: PydanticObjectId | str) -> str:
    return redis.key("live", "conference", str(conference_id))


async def publish(conference_id: PydanticObjectId | str, event: dict[str, Any]) -> None:
    await redis.client().publish(_channel(conference_id), json.dumps(event, default=str))


async def listen(conference_id: PydanticObjectId | str, quiet_seconds: float) -> AsyncIterator[dict[str, Any] | None]:
    """Yields each published event, or None after `quiet_seconds` without one (time for a heartbeat)."""
    pubsub = redis.client().pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(_channel(conference_id))
    try:
        while True:
            message = await pubsub.get_message(timeout=quiet_seconds)
            if message is None:
                yield None
            elif message.get("type") == "message":
                yield json.loads(message["data"])
    finally:
        await pubsub.unsubscribe()
        await pubsub.aclose()  # type: ignore[no-untyped-call]
