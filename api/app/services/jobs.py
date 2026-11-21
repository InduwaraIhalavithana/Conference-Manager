"""The scheduled jobs, as plain functions (the ARQ worker in app/worker.py runs them on a schedule; tests call
them directly). Every job is safe to run twice: a second run finds nothing left to do."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.logging import get_logger
from app.repositories import accounts
from app.repositories import conferences as conference_repo
from app.services import registrations, uploads

log = get_logger("jobs")

UNVERIFIED_DAYS = 7
ORPHAN_UPLOAD_HOURS = 24


async def release_holds(now: datetime | None = None) -> int:
    count = await registrations.release_expired_holds(now)
    if count:
        log.info("released expired holds", count=count)
    return count


async def send_due_reminders(now: datetime | None = None) -> int:
    """Reminders for conferences that start tomorrow in their own time zone."""
    now = now or datetime.now(UTC)
    sent = 0
    for conference in await conference_repo.starting_between(now, now + timedelta(hours=48)):
        zone = ZoneInfo(conference.timezone)
        tomorrow = now.astimezone(zone).date() + timedelta(days=1)
        if conference.starts_at.astimezone(zone).date() == tomorrow:
            sent += await registrations.send_reminders(conference)
    if sent:
        log.info("sent reminders", count=sent)
    return sent


async def recount_counters(now: datetime | None = None) -> int:
    """Nightly self-check: recount seats from the registrations and fix any drift (there should be none)."""
    since = (now or datetime.now(UTC)) - timedelta(days=1)
    fixed = 0
    for conference in await conference_repo.running_or_recent(since):
        assert conference.id is not None
        if await registrations.recount(conference.id):
            fixed += 1
    return fixed


async def purge_unverified_organizers(now: datetime | None = None) -> int:
    cutoff = (now or datetime.now(UTC)) - timedelta(days=UNVERIFIED_DAYS)
    count = await accounts.delete_unverified_before(cutoff)
    if count:
        log.info("purged unverified organizers", count=count)
    return count


async def delete_orphan_uploads(now: datetime | None = None) -> int:
    """Images uploaded but never attached to a conference (e.g. a form that was abandoned)."""
    cutoff = (now or datetime.now(UTC)) - timedelta(hours=ORPHAN_UPLOAD_HOURS)
    count = await uploads.delete_unused_before(cutoff)
    if count:
        log.info("deleted unused uploads", count=count)
    return count
