"""Ticket codes, waitlist positions and promotion from the waitlist."""
from __future__ import annotations

import secrets

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core import email
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


def promote_waitlist(db: Session, conf: Conference, background: BackgroundTasks | None) -> list[Attendee]:
    """Move people off the waitlist while seats are free. Caller commits."""
    db.flush()
    free = None if not conf.max_attendees else conf.max_attendees - registered_count(db, conf.id)
    waiting = db.execute(
        select(Attendee)
        .where(Attendee.conference_id == conf.id, Attendee.status == WAITLISTED)
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
