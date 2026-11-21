"""The ARQ worker: a second process next to the API that sends queued emails and runs the scheduled jobs.

    uv run arq app.worker.WorkerSettings

Jobs are async (they wait on SMTP, MongoDB and Redis, not on the CPU), which is why ARQ fits here.
"""

from typing import Any, ClassVar

from arq import Retry, cron
from arq.worker import func

from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings
from app.db import mongo, queue, redis
from app.services import email, jobs

settings = get_settings()
configure_logging(settings)
log = get_logger("worker")

EMAIL_TRIES = 3


async def startup(ctx: dict[str, Any]) -> None:
    await mongo.connect(settings.mongo_url, settings.mongo_db)
    await redis.connect(settings.redis_url, settings.redis_prefix)
    await queue.connect(settings.redis_url, settings.redis_prefix)
    # Emails written by jobs (reminders, promotions) go through the queue too, so they get the same retries.
    email.use_sender(email.QueueEmailSender())
    email.use_delivery(email.delivery_sender())
    log.info("worker started", smtp=bool(settings.gmail_user and settings.gmail_app_password))


async def shutdown(ctx: dict[str, Any]) -> None:
    await queue.disconnect()
    await redis.disconnect()
    await mongo.disconnect()


async def send_email(ctx: dict[str, Any], message: dict[str, Any]) -> bool:
    """Deliver one queued email; a failure is retried after 30 s, then 60 s, then given up and logged."""
    try:
        return await email.deliver(email.EmailMessage(**message))
    except Exception as err:
        attempt = int(ctx.get("job_try", 1))
        if attempt < EMAIL_TRIES:
            log.warning("email failed, will retry", to=message.get("to"), kind=message.get("kind"), attempt=attempt)
            raise Retry(defer=30 * attempt) from err
        log.error("email failed for good", to=message.get("to"), kind=message.get("kind"), error=str(err))
        return False


async def release_holds(ctx: dict[str, Any]) -> int:
    return await jobs.release_holds()


async def send_reminders(ctx: dict[str, Any]) -> int:
    return await jobs.send_due_reminders()


async def recount_counters(ctx: dict[str, Any]) -> int:
    return await jobs.recount_counters()


async def purge_unverified(ctx: dict[str, Any]) -> int:
    return await jobs.purge_unverified_organizers()


async def delete_orphan_uploads(ctx: dict[str, Any]) -> int:
    return await jobs.delete_orphan_uploads()


class WorkerSettings:
    functions: ClassVar = [func(send_email, max_tries=EMAIL_TRIES)]
    cron_jobs: ClassVar = [
        cron(release_holds, minute=set(range(0, 60, 10)), run_at_startup=True),
        cron(send_reminders, minute=5),
        cron(recount_counters, hour=2, minute=15),
        cron(purge_unverified, hour=3, minute=0),
        cron(delete_orphan_uploads, hour=3, minute=30),
    ]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = queue.redis_settings(settings.redis_url)
    queue_name = queue.queue_name(settings.redis_prefix)
    max_jobs = 20
