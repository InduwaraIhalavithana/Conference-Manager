"""Operational numbers kept in Redis: the worker's heartbeat, each scheduled job's last run, failed emails, and
requests and server errors per hour. Small keys with expiry, so nothing here ever needs cleaning up."""

import json
from datetime import UTC, datetime
from typing import Any

from app.db import queue, redis

HOUR_KEEP_SECONDS = 3 * 24 * 3600
DAY_KEEP_SECONDS = 8 * 24 * 3600


def _hour(at: datetime) -> str:
    return at.astimezone(UTC).strftime("%Y%m%d%H")


def _day(at: datetime) -> str:
    return at.astimezone(UTC).strftime("%Y%m%d")


async def record_request(status: int, at: datetime) -> None:
    key = redis.key("http", _hour(at))
    pipe = redis.client().pipeline(transaction=False)
    pipe.hincrby(key, "total", 1)
    if status >= 500:
        pipe.hincrby(key, "errors", 1)
    pipe.expire(key, HOUR_KEEP_SECONDS)
    await pipe.execute()


async def requests_in_hour(at: datetime) -> tuple[int, int]:
    values = await redis.client().hgetall(redis.key("http", _hour(at)))
    return int(values.get("total", 0)), int(values.get("errors", 0))


async def beat(at: datetime) -> None:
    await redis.client().set(redis.key("worker", "heartbeat"), at.isoformat(), ex=3600)


async def last_beat() -> datetime | None:
    value = await redis.client().get(redis.key("worker", "heartbeat"))
    return datetime.fromisoformat(str(value)) if value else None


async def job_ran(name: str, at: datetime, ok: bool, result: Any) -> None:
    payload = json.dumps({"at": at.isoformat(), "ok": ok, "result": str(result)[:200]})
    await redis.client().hset(redis.key("jobs", "last"), name, payload)


async def job_runs() -> dict[str, dict[str, Any]]:
    raw = await redis.client().hgetall(redis.key("jobs", "last"))
    return {str(name): json.loads(value) for name, value in raw.items()}


async def email_failed(at: datetime) -> None:
    key = redis.key("jobs", "failed_email", _day(at))
    await redis.client().incr(key)
    await redis.client().expire(key, DAY_KEEP_SECONDS)


async def failed_emails(at: datetime) -> int:
    return int(await redis.client().get(redis.key("jobs", "failed_email", _day(at))) or 0)


async def queue_length() -> int:
    """Jobs waiting in the ARQ queue (a sorted set keyed by when each job should run)."""
    return int(await redis.client().zcard(queue.current_queue_name()))
