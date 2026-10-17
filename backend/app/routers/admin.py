from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import email
from app.core.deps import get_current_admin
from app.core.errors import AppError
from app.core.notify import clear_notifications, notify_organizer
from app.core.places import city_of
from app.core.serialize import (
    REGISTERED_COUNT,
    columns,
    conference_dict,
    conference_select,
    organizer_dict,
    paginate_select,
)
from app.core.uploads import delete_image
from app.db.database import get_db
from app.models.activity import ActivityLog
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference
from app.models.contact import ContactMessage
from app.models.feedback import Feedback
from app.models.organizer import Organizer
from app.routers.organizers import organizer_files
from app.schemas.admin import AdminStats, FeedbackReply

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_admin)])


def _count(db: Session, model, *conditions) -> int:
    q = select(func.count()).select_from(model)
    for c in conditions:
        q = q.where(c)
    return db.execute(q).scalar() or 0


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db)):
    return AdminStats(
        total_organizers=_count(db, Organizer),
        active_organizers=_count(db, Organizer, ~Organizer.is_suspended),
        suspended=_count(db, Organizer, Organizer.is_suspended),
        total_confs=_count(db, Conference),
        upcoming_confs=_count(db, Conference, Conference.date >= date.today()),
        total_attendees=_count(db, Attendee, Attendee.status == REGISTERED),
        waitlisted=_count(db, Attendee, Attendee.status == WAITLISTED),
        checked_in=_count(db, Attendee, Attendee.checked_in_at.is_not(None)),
        open_feedback=_count(db, Feedback, Feedback.status == "open"),
        open_contacts=_count(db, ContactMessage, ContactMessage.status == "open"),
    )


def _series(db: Session, column, days: int) -> list[int]:
    since = datetime.now(UTC) - timedelta(days=days - 1)
    rows = db.execute(select(func.date(column), func.count()).where(column >= since).group_by(func.date(column))).all()
    by_day = {str(d): c for d, c in rows}
    today = date.today()
    return [by_day.get(str(today - timedelta(days=i)), 0) for i in range(days - 1, -1, -1)]


@router.get("/trends")
def trends(days: int = Query(14, ge=7, le=365), db: Session = Depends(get_db)):
    """Daily registrations and organizer sign-ups for the dashboard charts."""
    today = date.today()
    dates = [str(today - timedelta(days=i)) for i in range(days - 1, -1, -1)]
    regs = _series(db, Attendee.registered_at, days)
    orgs = _series(db, Organizer.created_at, days)
    return {
        "registrations": [{"date": d, "count": c} for d, c in zip(dates, regs, strict=True)],
        "organizers": [{"date": d, "count": c} for d, c in zip(dates, orgs, strict=True)],
    }


@router.get("/analytics")
def analytics(db: Session = Depends(get_db)):
    today = date.today()
    by_category = db.execute(
        select(Conference.category, func.count(func.distinct(Conference.id)), func.count(Attendee.id))
        .outerjoin(Attendee, (Attendee.conference_id == Conference.id) & (Attendee.status == REGISTERED))
        .group_by(Conference.category)
    ).all()

    # Conferences per month: six months back, six ahead.
    first = date(today.year, today.month, 1)
    months = []
    for offset in range(-6, 6):
        m = first.month - 1 + offset
        y, m = first.year + m // 12, m % 12 + 1
        months.append(date(y, m, 1))
    end = date(months[-1].year + (months[-1].month == 12), months[-1].month % 12 + 1, 1)
    month_rows = db.execute(
        select(Conference.date).where(Conference.date >= months[0], Conference.date < end)
    ).scalars()
    month_counts = {m: 0 for m in months}
    for d in month_rows:
        month_counts[date(d.year, d.month, 1)] += 1

    top_orgs = db.execute(
        select(Organizer, func.count(func.distinct(Conference.id)), func.count(Attendee.id))
        .outerjoin(Conference, Conference.organizer_id == Organizer.id)
        .outerjoin(Attendee, (Attendee.conference_id == Conference.id) & (Attendee.status == REGISTERED))
        .group_by(Organizer.id)
        .order_by(func.count(Attendee.id).desc(), Organizer.id)
        .limit(6)
    ).all()
    top_confs = db.execute(conference_select().order_by(REGISTERED_COUNT.desc(), Conference.date.desc()).limit(6)).all()

    past_registered = _count(db, Attendee, Attendee.status == REGISTERED,
                             Attendee.conference_id.in_(select(Conference.id).where(Conference.date < today)))
    past_checked = _count(db, Attendee, Attendee.checked_in_at.is_not(None),
                          Attendee.conference_id.in_(select(Conference.id).where(Conference.date < today)))
    cities: dict[str, int] = {}
    for (loc,) in db.execute(select(Conference.location)).all():
        city = city_of(loc)
        if city:
            cities[city] = cities.get(city, 0) + 1

    # Conferences without a topic count as "Other", merged into one row.
    merged: dict[str, dict] = {}
    for c, n, r in by_category:
        row = merged.setdefault(c or "Other", {"category": c or "Other", "conferences": 0, "registered": 0})
        row["conferences"] += n
        row["registered"] += int(r)

    return {
        "by_category": sorted(merged.values(), key=lambda x: -x["conferences"]),
        "by_month": [{"month": m.isoformat()[:7], "count": month_counts[m]} for m in months],
        "top_organizers": [
            {"id": o.id, "name": f"{o.first_name} {o.last_name}", "avatar": o.avatar, "organization": o.organization,
             "conferences": nc, "attendees": na}
            for o, nc, na in top_orgs
        ],
        "top_conferences": [conference_dict(r) for r in top_confs],
        "checkin_rate": round(100 * past_checked / past_registered) if past_registered else None,
        "cities": [{"city": k, "count": v} for k, v in sorted(cities.items(), key=lambda kv: -kv[1])[:10]],
    }


@router.get("/organizers")
def list_organizers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=120),
    status: Literal["all", "active", "suspended"] = "all",
    db: Session = Depends(get_db),
):
    conf_count = (
        select(func.count(Conference.id)).where(Conference.organizer_id == Organizer.id)
        .correlate(Organizer).scalar_subquery().label("conference_count")
    )
    attendee_count = (
        select(func.count(Attendee.id)).join(Conference, Attendee.conference_id == Conference.id)
        .where(Conference.organizer_id == Organizer.id, Attendee.status == REGISTERED)
        .correlate(Organizer).scalar_subquery().label("attendee_count")
    )
    stmt = select(Organizer, conf_count, attendee_count)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Organizer.first_name.ilike(like), Organizer.last_name.ilike(like),
                              Organizer.email.ilike(like), Organizer.organization.ilike(like)))
    if status == "active":
        stmt = stmt.where(Organizer.is_suspended.is_(False))
    elif status == "suspended":
        stmt = stmt.where(Organizer.is_suspended.is_(True))
    stmt = stmt.order_by(Organizer.created_at.desc(), Organizer.id.desc())

    def mapper(row):
        org, nc, na = row
        return {**organizer_dict(org), "conference_count": nc or 0, "attendee_count": na or 0}

    return paginate_select(db, stmt, page, per_page, mapper)


def _organizer(db: Session, org_id: int) -> Organizer:
    org = db.get(Organizer, org_id)
    if not org:
        raise AppError(404, "organizer_not_found", "Organizer not found")
    return org


@router.put("/organizers/{org_id}/suspend", status_code=204)
def suspend(org_id: int, db: Session = Depends(get_db)):
    org = _organizer(db, org_id)
    org.is_suspended = True
    db.add(ActivityLog(organizer_id=org.id, action="admin_suspend", target=org.email))
    db.commit()


@router.put("/organizers/{org_id}/unsuspend", status_code=204)
def unsuspend(org_id: int, db: Session = Depends(get_db)):
    org = _organizer(db, org_id)
    org.is_suspended = False
    db.add(ActivityLog(organizer_id=org.id, action="admin_unsuspend", target=org.email))
    notify_organizer(db, org.id, "account_restored", {}, "/dashboard")
    db.commit()


@router.delete("/organizers/{org_id}", status_code=204)
def delete_organizer(org_id: int, db: Session = Depends(get_db)):
    org = _organizer(db, org_id)
    files = organizer_files(db, org)
    clear_notifications(db, "organizer", org.id)
    db.add(ActivityLog(organizer_id=None, action="admin_delete_organizer", target=org.email))
    db.delete(org)
    db.commit()
    for url in files:
        delete_image(url)


@router.get("/conferences")
def all_conferences(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=120),
    when: Literal["all", "upcoming", "past", "draft"] = "all",
    category: str | None = Query(None, max_length=80),
    db: Session = Depends(get_db),
):
    stmt = conference_select()
    today = date.today()
    if when == "upcoming":
        stmt = stmt.where(Conference.date >= today)
    elif when == "past":
        stmt = stmt.where(Conference.date < today)
    elif when == "draft":
        stmt = stmt.where(Conference.status == "draft")
    if category:
        stmt = stmt.where(Conference.category == category)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Conference.title.ilike(like), Conference.location.ilike(like),
                              Organizer.first_name.ilike(like), Organizer.last_name.ilike(like)))
    return paginate_select(db, stmt.order_by(Conference.date.desc(), Conference.id.desc()), page, per_page,
                           conference_dict)


@router.delete("/conferences/{conf_id}", status_code=204)
def delete_conference(conf_id: int, db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf:
        raise AppError(404, "conference_not_found", "Conference not found")
    images = [conf.cover_image, *db.execute(select(Speaker.photo).where(Speaker.conference_id == conf.id)).scalars()]
    notify_organizer(db, conf.organizer_id, "conference_removed", {"conference": conf.title}, "/my-conferences")
    db.add(ActivityLog(organizer_id=conf.organizer_id, action="admin_delete_conference", target=conf.title))
    db.delete(conf)
    db.commit()
    for url in images:
        delete_image(url)


@router.get("/feedback")
def all_feedback(db: Session = Depends(get_db)):
    rows = db.execute(select(Feedback, Organizer).join(Organizer).order_by(Feedback.created_at.desc())).all()
    return [
        {**columns(fb), "organizer_name": f"{org.first_name} {org.last_name}", "organizer_email": org.email,
         "organizer_avatar": org.avatar}
        for fb, org in rows
    ]


@router.put("/feedback/{fb_id}/reply", status_code=204)
def reply_feedback(fb_id: int, body: FeedbackReply, background: BackgroundTasks, db: Session = Depends(get_db)):
    fb = db.get(Feedback, fb_id)
    if not fb:
        raise AppError(404, "feedback_not_found", "Feedback not found")
    fb.reply = body.reply
    org = db.get(Organizer, fb.organizer_id)
    if org:
        notify_organizer(db, org.id, "feedback_reply", {"subject": fb.subject}, "/help?tab=history")
        email.queue(background, email.feedback_reply_message(org, fb.subject, body.reply))
    db.commit()


@router.put("/feedback/{fb_id}/resolve", status_code=204)
def resolve_feedback(fb_id: int, db: Session = Depends(get_db)):
    fb = db.get(Feedback, fb_id)
    if not fb:
        raise AppError(404, "feedback_not_found", "Feedback not found")
    fb.status = "resolved"
    db.commit()


@router.get("/contacts")
def contact_messages(db: Session = Depends(get_db)):
    rows = db.execute(select(ContactMessage).order_by(ContactMessage.created_at.desc())).scalars().all()
    return [columns(m) for m in rows]


@router.put("/contacts/{msg_id}/resolve", status_code=204)
def resolve_contact(msg_id: int, db: Session = Depends(get_db)):
    msg = db.get(ContactMessage, msg_id)
    if not msg:
        raise AppError(404, "not_found", "Message not found")
    msg.status = "resolved"
    db.commit()


@router.get("/activity")
def activity_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    action: str | None = Query(None, max_length=60),
    db: Session = Depends(get_db),
):
    stmt = select(ActivityLog, Organizer).outerjoin(Organizer, ActivityLog.organizer_id == Organizer.id)
    if action:
        stmt = stmt.where(ActivityLog.action == action)
    stmt = stmt.order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())

    def mapper(row):
        log, org = row
        return {**columns(log), "organizer_name": f"{org.first_name} {org.last_name}" if org else None,
                "organizer_avatar": org.avatar if org else None}

    return paginate_select(db, stmt, page, per_page, mapper)
