"""Live updates over Redis pub/sub (Observer pattern): check-ins are published per conference, and every open
check-in desk or dashboard for that conference listens."""

import json
from collections.abc import AsyncIterator
from typing import Any, Literal

from beanie import PydanticObjectId

from app.db import redis

# "conference": check-in numbers for the owner; "qa": a "questions changed" signal anyone may hear (no content).
Topic = Literal["conference", "qa"]


def _channel(conference_id: PydanticObjectId | str, topic: Topic) -> str:
    return redis.key("live", topic, str(conference_id))


async def publish(conference_id: PydanticObjectId | str, event: dict[str, Any], topic: Topic = "conference") -> None:
    await redis.client().publish(_channel(conference_id, topic), json.dumps(event, default=str))


async def listen(
    conference_id: PydanticObjectId | str, quiet_seconds: float, topic: Topic = "conference"
) -> AsyncIterator[dict[str, Any] | None]:
    """Yields each published event, or None after `quiet_seconds` without one (time for a heartbeat)."""
    pubsub = redis.client().pubsub(ignore_subscribe_messages=True)
    await pubsub.subscribe(_channel(conference_id, topic))
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
