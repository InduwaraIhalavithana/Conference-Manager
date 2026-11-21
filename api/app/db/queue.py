"""The ARQ job queue in Redis. The API only enqueues; the worker (app/worker.py) runs the jobs."""

from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

_pool: ArqRedis | None = None
_queue_name = "arq:queue"


def queue_name(prefix: str) -> str:
    """Each Redis prefix gets its own queue, so tests never hand jobs to a developer's running worker."""
    return f"{prefix}:arq:queue"


def redis_settings(url: str) -> RedisSettings:
    return RedisSettings.from_dsn(url)


async def connect(url: str, prefix: str) -> None:
    global _pool, _queue_name
    _queue_name = queue_name(prefix)
    _pool = await create_pool(redis_settings(url), default_queue_name=_queue_name)


async def disconnect() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


async def enqueue(job: str, *args: Any) -> None:
    if _pool is None:
        raise RuntimeError("The job queue is not connected")
    await _pool.enqueue_job(job, *args)
