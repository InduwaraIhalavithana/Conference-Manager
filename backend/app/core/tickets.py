"""Ticket codes, email confirmation, waitlist positions and promotion from the waitlist."""
from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import email
from app.core.config import CONFIRM_HOLD_HOURS
from app.core.notify import notify_organizer
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference

# No 0/O or 1/I, so codes read aloud or typed at the door are unambiguous.
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 10


def new_ticket_code(db: Session) -> str:
    while True:
        code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))
        if not db.execute(select(Attendee.id).where(Attendee.ticket_code == code)).first():
            return code


def normalize_code(code: str) -> str:
    """Accept codes typed with spaces, dashes or lower case, or a full ticket URL from a QR scan."""
    code = code.strip().rstrip("/").split("/")[-1]
    return "".join(ch for ch in code.upper() if ch.isalnum())


def registered_count(db: Session, conf_id: int) -> int:
    return db.execute(
        select(func.count(Attendee.id)).where(Attendee.conference_id == conf_id, Attendee.status == REGISTERED)
    ).scalar() or 0


def confirmed_count(db: Session, conf_id: int) -> int:
    """Registered attendees who have confirmed their email (unconfirmed ones only hold a seat)."""
    return db.execute(
        select(func.count(Attendee.id)).where(Attendee.conference_id == conf_id, Attendee.status == REGISTERED,
                                              Attendee.confirmed_at.is_not(None))
    ).scalar() or 0


def waitlist_position(db: Session, attendee: Attendee) -> int | None:
    if attendee.status != WAITLISTED:
        return None
    # Same order promote_waitlist() uses; waitlists are short, so reading the ids is cheap.
    order = db.execute(
        select(Attendee.id)
        .where(Attendee.conference_id == attendee.conference_id, Attendee.status == WAITLISTED)
        .order_by(Attendee.registered_at, Attendee.id)
    ).scalars().all()
    return order.index(attendee.id) + 1 if attendee.id in order else None


def hold_expires_at(attendee: Attendee) -> datetime | None:
    """When an unconfirmed registration gives its seat back."""
    if attendee.confirmed_at is not None:
        return None
    registered = attendee.registered_at if attendee.registered_at.tzinfo else attendee.registered_at.replace(tzinfo=UTC)
    return registered + timedelta(hours=CONFIRM_HOLD_HOURS)


def release_expired_holds(db: Session) -> list[email.Message]:
    """Delete registrations nobody confirmed in time and hand their seats to the waitlist. Commits.

    Returns the "you got a seat" emails for the caller to send.
    """
    cutoff = datetime.now(UTC) - timedelta(hours=CONFIRM_HOLD_HOURS)
    stale = db.execute(
        select(Attendee).where(Attendee.confirmed_at.is_(None), Attendee.registered_at < cutoff)
    ).scalars().all()
    conf_ids = {a.conference_id for a in stale}
    for a in stale:
        db.delete(a)
    messages: list[email.Message] = []
    for conf_id in conf_ids:
        conf = db.get(Conference, conf_id)
        if conf is not None:
            messages += [email.promoted_message(p, conf) for p in promote_waitlist(db, conf, None)]
    db.commit()
    return messages


def promote_waitlist(db: Session, conf: Conference, background: BackgroundTasks | None) -> list[Attendee]:
    """Move confirmed people off the waitlist while seats are free. Caller commits.

    Unconfirmed waitlisters are skipped; confirming later calls this again, so they are not forgotten.
    """
    db.flush()
    free = None if not conf.max_attendees else conf.max_attendees - registered_count(db, conf.id)
    waiting = db.execute(
        select(Attendee)
        .where(Attendee.conference_id == conf.id, Attendee.status == WAITLISTED, Attendee.confirmed_at.is_not(None))
        .order_by(Attendee.registered_at, Attendee.id)
    ).scalars().all()
    promoted: list[Attendee] = []
    for attendee in waiting:
        if free is not None and free <= 0:
            break
        attendee.status = REGISTERED
        promoted.append(attendee)
        if free is not None:
            free -= 1
        notify_organizer(db, conf.organizer_id, "waitlist_promoted",
                         {"attendee": attendee.name, "conference": conf.title}, f"/attendees/{conf.id}")
        if background is not None:
            email.queue(background, email.promoted_message(attendee, conf))
    return promoted
