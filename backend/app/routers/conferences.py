from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core import email
from app.core.deps import get_current_organizer
from app.core.errors import AppError
from app.core.notify import notify_admins
from app.core.serialize import REGISTERED_COUNT, columns, conference_dict, conference_select, paginate_select
from app.core.tickets import promote_waitlist
from app.core.uploads import delete_image, save_image
from app.db.database import get_db
from app.models.activity import ActivityLog
from app.models.agenda import Session as AgendaSession
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, Attendee
from app.models.conference import CATEGORIES, Conference
from app.models.organizer import Organizer
from app.schemas.conference import ConferenceCreate, ConferencePatch, ConferenceUpdate

router = APIRouter(prefix="/api/conferences", tags=["conferences"])


def _not_found() -> AppError:
    return AppError(404, "conference_not_found", "Conference not found")


def own_conference(db: Session, conf_id: int, org: Organizer) -> Conference:
    conf = db.execute(
        select(Conference).where(and_(Conference.id == conf_id, Conference.organizer_id == org.id))
    ).scalar_one_or_none()
    if not conf:
        raise _not_found()
    return conf


def _one(db: Session, conf_id: int) -> dict:
    row = db.execute(conference_select().where(Conference.id == conf_id)).first()
    if not row:
        raise _not_found()
    return conference_dict(row)


def _visible(stmt, when: str):
    today = date.today()
    stmt = stmt.where(Conference.status == "published", Organizer.is_suspended.is_(False))
    if when == "past":
        return stmt.where(Conference.date < today)
    return stmt.where(Conference.date >= today)


@router.get("/categories")
def categories():
    return list(CATEGORIES)


@router.get("/past")
def past_conferences(org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    rows = db.execute(
        conference_select()
        .where(Conference.organizer_id == org.id, Conference.date < date.today())
        .order_by(Conference.date.desc())
    ).all()
    return [conference_dict(r) for r in rows]


@router.get("/upcoming")
def public_conferences(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category: str | None = Query(None, max_length=80),
    q: str | None = Query(None, max_length=120),
    city: str | None = Query(None, max_length=120),
    date_from: date | None = None,
    date_to: date | None = None,
    when: Literal["upcoming", "past"] = "upcoming",
    sort: Literal["date", "popular"] = "date",
    db: Session = Depends(get_db),
):
    """Public listing of published conferences (upcoming by default)."""
    stmt = _visible(conference_select(), when)
    if category:
        stmt = stmt.where(Conference.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Conference.title.ilike(like), Conference.location.ilike(like),
                              Conference.description.ilike(like)))
    if city:
        stmt = stmt.where(Conference.location.ilike(f"%{city.strip()}%"))
    if date_from:
        stmt = stmt.where(Conference.date >= date_from)
    if date_to:
        stmt = stmt.where(Conference.date <= date_to)
    if sort == "popular":
        stmt = stmt.order_by(REGISTERED_COUNT.desc(), Conference.date)
    elif when == "past":
        stmt = stmt.order_by(Conference.date.desc(), Conference.id)
    else:
        stmt = stmt.order_by(Conference.date, Conference.time, Conference.id)
    return paginate_select(db, stmt, page, per_page, conference_dict)


@router.get("/{conf_id}/details")
def conference_details(conf_id: int, db: Session = Depends(get_db)):
    """Everything the public conference page shows: the conference, agenda, speakers, related events."""
    data = _one(db, conf_id)
    if data["status"] != "published":
        raise _not_found()
    speakers = db.execute(
        select(Speaker).where(Speaker.conference_id == conf_id).order_by(Speaker.position, Speaker.id)
    ).scalars().all()
    sessions = db.execute(
        select(AgendaSession).where(AgendaSession.conference_id == conf_id)
        .order_by(AgendaSession.start_time, AgendaSession.id)
    ).scalars().all()
    related_stmt = _visible(conference_select(), "upcoming").where(Conference.id != conf_id)
    if data["category"]:
        related_stmt = related_stmt.where(Conference.category == data["category"])
    related = db.execute(related_stmt.order_by(Conference.date).limit(3)).all()
    return {
        "conference": data,
        "speakers": [columns(s) for s in speakers],
        "sessions": [columns(s) for s in sessions],
        "related": [conference_dict(r) for r in related],
    }


@router.get("/{conf_id}/calendar.ics")
def calendar_file(conf_id: int, db: Session = Depends(get_db)):
    data = _one(db, conf_id)
    if data["status"] != "published":
        raise _not_found()
    d: date = data["date"]
    if data["time"]:
        start = datetime.combine(d, data["time"])
        end = datetime.combine(d, data["end_time"]) if data["end_time"] else start + timedelta(hours=2)
        dt_start, dt_end = f"DTSTART:{start:%Y%m%dT%H%M%S}", f"DTEND:{end:%Y%m%dT%H%M%S}"
    else:
        dt_start, dt_end = f"DTSTART;VALUE=DATE:{d:%Y%m%d}", f"DTEND;VALUE=DATE:{d + timedelta(days=1):%Y%m%d}"

    def esc(text: str | None) -> str:
        return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ConferenceHub//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
        f"UID:conference-{conf_id}@conferencehub",
        f"DTSTAMP:{datetime.now(UTC):%Y%m%dT%H%M%SZ}",
        dt_start, dt_end,
        f"SUMMARY:{esc(data['title'])}",
        f"DESCRIPTION:{esc((data['description'] or '')[:900])}",
        f"LOCATION:{esc(data['location'])}",
    ]
    if data["venue_lat"] is not None and data["venue_lng"] is not None:
        lines.append(f"GEO:{data['venue_lat']};{data['venue_lng']}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return Response("\r\n".join(lines) + "\r\n", media_type="text/calendar; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="conference-{conf_id}.ics"'})


@router.get("/{conf_id}")
def get_conference(conf_id: int, db: Session = Depends(get_db)):
    data = _one(db, conf_id)
    if data["status"] != "published":
        raise _not_found()
    return data


@router.get("/mine/{conf_id}")
def get_my_conference(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    """An organizer's own conference, drafts included, with its agenda and speakers."""
    own_conference(db, conf_id, org)
    data = _one(db, conf_id)
    speakers = db.execute(
        select(Speaker).where(Speaker.conference_id == conf_id).order_by(Speaker.position, Speaker.id)
    ).scalars().all()
    sessions = db.execute(
        select(AgendaSession).where(AgendaSession.conference_id == conf_id)
        .order_by(AgendaSession.start_time, AgendaSession.id)
    ).scalars().all()
    return {"conference": data, "speakers": [columns(s) for s in speakers], "sessions": [columns(s) for s in sessions]}


@router.get("/")
def my_conferences(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=120),
    when: Literal["all", "upcoming", "past", "draft"] = "all",
    org=Depends(get_current_organizer),
    db: Session = Depends(get_db),
):
    stmt = conference_select().where(Conference.organizer_id == org.id)
    today = date.today()
    if when == "upcoming":
        stmt = stmt.where(Conference.date >= today)
    elif when == "past":
        stmt = stmt.where(Conference.date < today)
    elif when == "draft":
        stmt = stmt.where(Conference.status == "draft")
    if q:
        stmt = stmt.where(or_(Conference.title.ilike(f"%{q}%"), Conference.location.ilike(f"%{q}%")))
    order = Conference.date.desc() if when == "past" else Conference.date
    return paginate_select(db, stmt.order_by(order, Conference.id), page, per_page, conference_dict)


@router.post("/", status_code=201)
def create_conference(body: ConferenceCreate, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = Conference(**body.model_dump(), organizer_id=org.id)
    db.add(conf)
    db.add(ActivityLog(organizer_id=org.id, action="create_conference", target=body.title))
    db.flush()
    if conf.status == "published":
        notify_admins(db, "new_conference",
                      {"conference": conf.title, "organizer": f"{org.first_name} {org.last_name}"},
                      f"/conferences/{conf.id}")
    db.commit()
    return _one(db, conf.id)


def _apply_update(db: Session, conf: Conference, values: dict, org: Organizer, background: BackgroundTasks):
    was_draft = conf.status == "draft"
    for k, v in values.items():
        setattr(conf, k, v)
    db.add(ActivityLog(organizer_id=org.id, action="update_conference", target=conf.title))
    # More seats (or no limit any more) lets waiting people in.
    promote_waitlist(db, conf, background)
    if was_draft and conf.status == "published":
        notify_admins(db, "new_conference",
                      {"conference": conf.title, "organizer": f"{org.first_name} {org.last_name}"},
                      f"/conferences/{conf.id}")
    db.commit()
    return _one(db, conf.id)


@router.put("/{conf_id}")
def update_conference(conf_id: int, body: ConferenceUpdate, background: BackgroundTasks,
                      org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    return _apply_update(db, conf, body.model_dump(), org, background)


@router.patch("/{conf_id}")
def patch_conference(conf_id: int, body: ConferencePatch, background: BackgroundTasks,
                     org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    return _apply_update(db, conf, body.model_dump(exclude_unset=True), org, background)


@router.delete("/{conf_id}", status_code=204)
def delete_conference(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    images = [conf.cover_image] + list(
        db.execute(select(Speaker.photo).where(Speaker.conference_id == conf.id)).scalars()
    )
    db.add(ActivityLog(organizer_id=org.id, action="delete_conference", target=conf.title))
    db.delete(conf)
    db.commit()
    for url in images:
        delete_image(url)


@router.post("/{conf_id}/cover")
async def upload_cover(conf_id: int, file: UploadFile = File(...), org=Depends(get_current_organizer),
                       db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    url = await save_image(file, "cover")
    old, conf.cover_image = conf.cover_image, url
    db.commit()
    delete_image(old)
    return _one(db, conf.id)


@router.delete("/{conf_id}/cover")
def remove_cover(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    old, conf.cover_image = conf.cover_image, None
    db.commit()
    delete_image(old)
    return _one(db, conf.id)


@router.post("/{conf_id}/reminders")
def send_reminders_now(conf_id: int, background: BackgroundTasks, org=Depends(get_current_organizer),
                       db: Session = Depends(get_db)):
    """Email every registered attendee who confirmed their email a reminder right away."""
    conf = own_conference(db, conf_id, org)
    if conf.date < date.today():
        raise AppError(400, "conference_past", "This conference has already taken place")
    attendees = db.execute(
        select(Attendee).where(Attendee.conference_id == conf.id, Attendee.status == REGISTERED,
                               Attendee.confirmed_at.is_not(None))
    ).scalars().all()
    now = datetime.now(UTC)
    for a in attendees:
        a.reminder_sent_at = now
        email.queue(background, email.reminder_message(a, conf))
    db.add(ActivityLog(organizer_id=org.id, action="send_reminders", target=conf.title))
    db.commit()
    return {"sent": len(attendees), "email_enabled": email.email_enabled()}
