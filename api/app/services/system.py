"""Health for the admin's System card and /metrics: databases, the worker and its jobs, the email queue, and
the API's request and error counts. Recording never fails a request or a job."""

import contextlib
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from app.core.logging import get_logger
from app.db import mongo, redis
from app.models.common import utcnow
from app.repositories import system as repo

log = get_logger("system")

# The worker beats every minute; three minutes of silence means it is not running.
WORKER_STALE_AFTER = timedelta(minutes=3)


async def record_request(status: int) -> None:
    with contextlib.suppress(Exception):  # counting is best effort
        await repo.record_request(status, utcnow())


async def heartbeat() -> None:
    await repo.beat(utcnow())


async def email_failed() -> None:
    try:
        await repo.email_failed(utcnow())
    except Exception:  # noqa: BLE001
        log.warning("could not count a failed email")


async def tracked[T](name: str, job: Callable[[], Awaitable[T]]) -> T:
    """Runs a scheduled job and records when it last ran and how it went (for the System card)."""
    try:
        result = await job()
    except Exception as err:
        await repo.job_ran(name, utcnow(), ok=False, result=err)
        raise
    await repo.job_ran(name, utcnow(), ok=True, result=result)
    return result


@dataclass(frozen=True)
class JobRun:
    name: str
    at: datetime
    ok: bool
    result: str


@dataclass(frozen=True)
class Status:
    mongo: bool
    redis: bool
    worker_seen_at: datetime | None
    worker_running: bool
    queue_length: int
    failed_emails_today: int
    requests_last_hour: int
    errors_last_hour: int
    jobs: list[JobRun]


async def status() -> Status:
    now = utcnow()
    redis_ok = await redis.ping()
    seen = await repo.last_beat() if redis_ok else None
    runs: dict[str, dict[str, Any]] = await repo.job_runs() if redis_ok else {}
    this_hour = await repo.requests_in_hour(now) if redis_ok else (0, 0)
    last_hour = await repo.requests_in_hour(now - timedelta(hours=1)) if redis_ok else (0, 0)
    return Status(
        mongo=await mongo.ping(),
        redis=redis_ok,
        worker_seen_at=seen,
        worker_running=seen is not None and now - seen < WORKER_STALE_AFTER,
        queue_length=await repo.queue_length() if redis_ok else 0,
        failed_emails_today=await repo.failed_emails(now) if redis_ok else 0,
        requests_last_hour=this_hour[0] + last_hour[0],
        errors_last_hour=this_hour[1] + last_hour[1],
        jobs=sorted(
            (
                JobRun(name=n, at=datetime.fromisoformat(r["at"]), ok=bool(r["ok"]), result=str(r["result"]))
                for n, r in runs.items()
            ),
            key=lambda j: j.name,
        ),
    )


def prometheus(s: Status) -> str:
    """The same numbers in Prometheus text format (scraped from /metrics)."""
    lines = [
        "# HELP conferencehub_up Whether a dependency answers (1) or not (0).",
        "# TYPE conferencehub_up gauge",
        f'conferencehub_up{{service="mongo"}} {int(s.mongo)}',
        f'conferencehub_up{{service="redis"}} {int(s.redis)}',
        f'conferencehub_up{{service="worker"}} {int(s.worker_running)}',
        "# HELP conferencehub_queue_length Jobs waiting in the email and job queue.",
        "# TYPE conferencehub_queue_length gauge",
        f"conferencehub_queue_length {s.queue_length}",
        "# HELP conferencehub_failed_emails_today Emails given up on after three tries, today (UTC).",
        "# TYPE conferencehub_failed_emails_today gauge",
        f"conferencehub_failed_emails_today {s.failed_emails_today}",
        "# HELP conferencehub_requests_recent Requests in the current and previous hour.",
        "# TYPE conferencehub_requests_recent gauge",
        f"conferencehub_requests_recent {s.requests_last_hour}",
        "# HELP conferencehub_server_errors_recent 5xx responses in the current and previous hour.",
        "# TYPE conferencehub_server_errors_recent gauge",
        f"conferencehub_server_errors_recent {s.errors_last_hour}",
    ]
    return "\n".join(lines) + "\n"
