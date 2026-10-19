"""Background loop: the day before a conference, email each confirmed attendee once and tell the organizer.

The same loop releases seats held by registrations nobody confirmed in time.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from starlette.concurrency import run_in_threadpool

from app.core import email
from app.core.config import REMINDER_INTERVAL_SECONDS
from app.core.notify import notify_organizer
from app.core.tickets import release_expired_holds
from app.db.database import SessionLocal
from app.models.attendee import REGISTERED, Attendee
from app.models.conference import Conference

log = logging.getLogger("conference.reminders")


def collect_due(today: date | None = None) -> list[email.Message]:
    """Mark tomorrow's reminders as sent and return the emails to deliver."""
    tomorrow = (today or date.today()) + timedelta(days=1)
    messages: list[email.Message] = []
    now = datetime.now(UTC)
    with SessionLocal() as db:
        confs = db.execute(
            select(Conference).where(Conference.date == tomorrow, Conference.status == "published")
        ).scalars().all()
        for conf in confs:
            attendees = db.execute(
                select(Attendee).where(Attendee.conference_id == conf.id, Attendee.status == REGISTERED,
                                       Attendee.confirmed_at.is_not(None),
                                       Attendee.reminder_sent_at.is_(None))
            ).scalars().all()
            for a in attendees:
                a.reminder_sent_at = now
                messages.append(email.reminder_message(a, conf))
            if conf.reminders_sent_at is None:
                conf.reminders_sent_at = now
                notify_organizer(db, conf.organizer_id, "conference_tomorrow",
                                 {"conference": conf.title, "count": len(attendees)}, f"/check-in/{conf.id}")
        db.commit()
    return messages


def release_holds() -> list[email.Message]:
    with SessionLocal() as db:
        return release_expired_holds(db)


async def run_once() -> int:
    for msg in await run_in_threadpool(release_holds):
        await email.send_message(msg)
    messages = await run_in_threadpool(collect_due)
    for msg in messages:
        await email.send_message(msg)
    if messages:
        log.info("Sent %d conference reminders", len(messages))
    return len(messages)


async def reminder_loop() -> None:
    while True:
        try:
            await run_once()
        except Exception:  # keep the loop alive whatever happens in one round
            log.exception("Reminder round failed")
        await asyncio.sleep(REMINDER_INTERVAL_SECONDS)
