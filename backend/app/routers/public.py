"""Public data for the home, about and contact pages: real counts instead of placeholder numbers."""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.notify import notify_admins
from app.core.places import city_of
from app.core.ratelimit import limiter
from app.core.serialize import conference_dict, conference_select
from app.db.database import get_db
from app.models.agenda import Session as AgendaSession
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, Attendee
from app.models.conference import Conference
from app.models.contact import ContactMessage
from app.models.organizer import Organizer
from app.schemas.feedback import ContactCreate

router = APIRouter(prefix="/api/public", tags=["public"])




def _merge_categories(rows) -> list[dict]:
    """Conferences without a topic count as "Other", in one row."""
    merged: dict[str, int] = {}
    for c, n in rows:
        merged[c or "Other"] = merged.get(c or "Other", 0) + n
    return [{"category": c, "count": n} for c, n in sorted(merged.items(), key=lambda kv: -kv[1])]


@router.get("/stats")
def public_stats(db: Session = Depends(get_db)):
    today = date.today()
    live = (Conference.status == "published") & Organizer.is_suspended.is_(False)
    base = select(Conference).join(Organizer, Conference.organizer_id == Organizer.id).where(live)

    def count(stmt) -> int:
        return db.execute(select(func.count()).select_from(stmt.subquery())).scalar() or 0

    upcoming = count(base.where(Conference.date >= today))
    held = count(base.where(Conference.date < today))
    attendees = db.execute(
        select(func.count(Attendee.id)).join(Conference, Attendee.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id).where(live, Attendee.status == REGISTERED)
    ).scalar() or 0
    checked_in = db.execute(
        select(func.count(Attendee.id)).join(Conference, Attendee.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id).where(live, Attendee.checked_in_at.is_not(None))
    ).scalar() or 0
    organizers = db.execute(select(func.count(Organizer.id)).where(Organizer.is_suspended.is_(False))).scalar() or 0
    speakers = db.execute(
        select(func.count(Speaker.id)).join(Conference, Speaker.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id).where(live)
    ).scalar() or 0
    sessions = db.execute(
        select(func.count(AgendaSession.id)).join(Conference, AgendaSession.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id).where(live)
    ).scalar() or 0

    cat_rows = db.execute(
        select(Conference.category, func.count(Conference.id))
        .join(Organizer, Conference.organizer_id == Organizer.id)
        .where(live, Conference.date >= today).group_by(Conference.category)
    ).all()
    cities: dict[str, int] = {}
    for (loc,) in db.execute(
        select(Conference.location).join(Organizer, Conference.organizer_id == Organizer.id).where(live)
    ).all():
        c = city_of(loc)
        if c:
            cities[c] = cities.get(c, 0) + 1

    # Recent registrations for the live ticker: conference title and time only, never attendee names.
    since = datetime.now(UTC) - timedelta(days=30)
    recent = db.execute(
        select(Conference.id, Conference.title, Attendee.registered_at)
        .join(Attendee, Attendee.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id)
        .where(live, Attendee.registered_at >= since, Conference.date >= today)
        .order_by(Attendee.registered_at.desc()).limit(12)
    ).all()
    week_ago = datetime.now(UTC) - timedelta(days=7)
    this_week = db.execute(
        select(func.count(Attendee.id)).where(Attendee.registered_at >= week_ago)
    ).scalar() or 0

    return {
        "upcoming": upcoming,
        "held": held,
        "attendees": attendees,
        "checked_in": checked_in,
        "organizers": organizers,
        "speakers": speakers,
        "sessions": sessions,
        "registrations_this_week": this_week,
        "categories": _merge_categories(cat_rows),
        "cities": [{"city": k, "count": v} for k, v in sorted(cities.items(), key=lambda kv: -kv[1])[:12]],
        "recent": [{"conference_id": i, "title": t, "at": at.isoformat()} for i, t, at in recent],
    }


@router.get("/featured")
def featured(db: Session = Depends(get_db)):
    """Home page blocks: next events, most popular, and a few speakers."""
    today = date.today()
    live = (Conference.status == "published") & Organizer.is_suspended.is_(False) & (Conference.date >= today)
    nxt = db.execute(conference_select().where(live).order_by(Conference.date, Conference.time).limit(8)).all()
    speakers = db.execute(
        select(Speaker, Conference.id, Conference.title)
        .join(Conference, Speaker.conference_id == Conference.id)
        .join(Organizer, Conference.organizer_id == Organizer.id)
        .where(live, Speaker.photo.is_not(None))
        .order_by(Conference.date, Speaker.position).limit(8)
    ).all()
    return {
        "next": [conference_dict(r) for r in nxt],
        "speakers": [
            {"id": s.id, "name": s.name, "job_title": s.job_title, "organization": s.organization, "photo": s.photo,
             "conference_id": cid, "conference_title": title}
            for s, cid, title in speakers
        ],
    }


@router.post("/contact", status_code=201)
@limiter.limit("5/minute")
def contact(request: Request, body: ContactCreate, db: Session = Depends(get_db)):
    msg = ContactMessage(name=body.name, email=body.email.lower(), subject=body.subject, message=body.message)
    db.add(msg)
    db.flush()
    notify_admins(db, "new_contact", {"name": body.name, "subject": body.subject}, "/admin/feedback?tab=contact")
    db.commit()
    return {"id": msg.id, "code": "contact_sent"}
