"""Turn rows into API dicts. Attendee counts come from correlated subqueries, so lists cost one query."""
from __future__ import annotations

import math
from typing import Any

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.agenda import Session as AgendaSession
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference
from app.models.organizer import Organizer


def _count(status: str | None = None, checked_in: bool = False):
    q = select(func.count(Attendee.id)).where(Attendee.conference_id == Conference.id)
    if status:
        q = q.where(Attendee.status == status)
    if checked_in:
        q = q.where(Attendee.checked_in_at.is_not(None))
    return q.correlate(Conference).scalar_subquery()


REGISTERED_COUNT = _count(REGISTERED).label("attendee_count")
WAITLIST_COUNT = _count(WAITLISTED).label("waitlist_count")
CHECKED_IN_COUNT = _count(REGISTERED, checked_in=True).label("checked_in_count")
SPEAKER_COUNT = (
    select(func.count(Speaker.id)).where(Speaker.conference_id == Conference.id).correlate(Conference).scalar_subquery()
).label("speaker_count")
SESSION_COUNT = (
    select(func.count(AgendaSession.id)).where(AgendaSession.conference_id == Conference.id)
    .correlate(Conference).scalar_subquery()
).label("session_count")


def conference_select() -> Select:
    """Conference + organizer + counts. Add .where()/.order_by() and pass rows to conference_dict()."""
    return (
        select(Conference, Organizer, REGISTERED_COUNT, WAITLIST_COUNT, CHECKED_IN_COUNT, SPEAKER_COUNT, SESSION_COUNT)
        .join(Organizer, Conference.organizer_id == Organizer.id)
    )


def columns(obj) -> dict[str, Any]:
    return {c.key: getattr(obj, c.key) for c in obj.__table__.columns}


def conference_dict(row) -> dict[str, Any]:
    conf, org, registered, waitlisted, checked_in, speakers, sessions = row
    data = columns(conf)
    data.pop("reminders_sent_at", None)
    data.update(
        attendee_count=registered or 0,
        waitlist_count=waitlisted or 0,
        checked_in_count=checked_in or 0,
        speaker_count=speakers or 0,
        session_count=sessions or 0,
        organizer_name=f"{org.first_name} {org.last_name}",
        organizer_avatar=org.avatar,
        organizer_organization=org.organization,
    )
    return data


def organizer_dict(org: Organizer) -> dict[str, Any]:
    data = columns(org)
    data.pop("password_hash", None)
    return data


def paginate_select(db: Session, stmt: Select, page: int, per_page: int, mapper) -> dict[str, Any]:
    total = db.execute(select(func.count()).select_from(stmt.order_by(None).subquery())).scalar() or 0
    rows = db.execute(stmt.limit(per_page).offset((page - 1) * per_page)).all()
    return {
        "items": [mapper(r) for r in rows],
        "total": total,
        "page": page,
        "pages": max(1, math.ceil(total / per_page)) if per_page else 1,
    }
