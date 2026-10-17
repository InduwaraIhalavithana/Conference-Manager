from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_organizer
from app.core.errors import AppError
from app.core.notify import clear_notifications
from app.core.security import hash_password, verify_password
from app.core.serialize import organizer_dict
from app.core.uploads import delete_image, save_image
from app.db.database import get_db
from app.models.activity import ActivityLog
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference
from app.models.organizer import Organizer
from app.schemas.organizer import DeleteAccountRequest, LanguageUpdate, PasswordChange, ProfileUpdate

router = APIRouter(prefix="/api/organizers", tags=["organizers"])


def _day_series(db: Session, column, org_id: int, since: datetime, days: int, extra=None) -> list[int]:
    q = (
        select(func.date(column), func.count(Attendee.id))
        .join(Conference, Attendee.conference_id == Conference.id)
        .where(Conference.organizer_id == org_id, column >= since)
        .group_by(func.date(column))
    )
    if extra is not None:
        q = q.where(extra)
    by_day = {str(d): c for d, c in db.execute(q).all()}
    today = date.today()
    return [by_day.get(str(today - timedelta(days=i)), 0) for i in range(days - 1, -1, -1)]


@router.get("/me/overview")
def my_overview(org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    """Dashboard extras: 14-day registration trend + recent activity."""
    since = datetime.now(UTC) - timedelta(days=13)
    counts = _day_series(db, Attendee.registered_at, org.id, since, 14)
    today = date.today()
    trend = [{"date": str(today - timedelta(days=13 - i)), "count": c} for i, c in enumerate(counts)]
    activity = db.execute(
        select(ActivityLog).where(ActivityLog.organizer_id == org.id).order_by(ActivityLog.created_at.desc()).limit(8)
    ).scalars().all()
    return {
        "trend": trend,
        "activity": [
            {"action": a.action, "target": a.target, "created_at": a.created_at.isoformat()} for a in activity
        ],
    }


@router.get("/me/analytics")
def my_analytics(days: int = Query(30, ge=7, le=365), org: Organizer = Depends(get_current_organizer),
                 db: Session = Depends(get_db)):
    today = date.today()
    since = datetime.now(UTC) - timedelta(days=days - 1)
    regs = _day_series(db, Attendee.registered_at, org.id, since, days)
    checkins = _day_series(db, Attendee.checked_in_at, org.id, since, days)
    trend = [
        {"date": str(today - timedelta(days=days - 1 - i)), "registrations": regs[i], "checkins": checkins[i]}
        for i in range(days)
    ]

    per_conf = db.execute(
        select(
            Conference.id, Conference.title, Conference.date, Conference.category, Conference.max_attendees,
            func.count(Attendee.id).filter(Attendee.status == REGISTERED),
            func.count(Attendee.id).filter(Attendee.status == WAITLISTED),
            func.count(Attendee.id).filter(Attendee.checked_in_at.is_not(None)),
        )
        .outerjoin(Attendee, Attendee.conference_id == Conference.id)
        .where(Conference.organizer_id == org.id)
        .group_by(Conference.id)
        .order_by(Conference.date.desc())
    ).all()
    by_conference = [
        {"id": cid, "title": title, "date": str(d), "category": cat, "max_attendees": cap,
         "registered": r, "waitlisted": w, "checked_in": c}
        for cid, title, d, cat, cap, r, w, c in per_conf
    ]
    by_category: dict[str, dict] = {}
    for row in by_conference:
        key = row["category"] or "Other"
        bucket = by_category.setdefault(key, {"category": key, "conferences": 0, "registered": 0})
        bucket["conferences"] += 1
        bucket["registered"] += row["registered"]

    weekday_rows = db.execute(
        select(Attendee.registered_at)
        .join(Conference, Attendee.conference_id == Conference.id)
        .where(Conference.organizer_id == org.id)
    ).scalars().all()
    by_weekday = [0] * 7  # Monday first
    for ts in weekday_rows:
        by_weekday[ts.weekday()] += 1

    registered = sum(r["registered"] for r in by_conference)
    checked_in = sum(r["checked_in"] for r in by_conference)
    past = [r for r in by_conference if r["date"] < str(today)]
    past_registered = sum(r["registered"] for r in past)
    past_checked = sum(r["checked_in"] for r in past)
    capped = [r for r in by_conference if r["max_attendees"]]
    avg_fill = None
    if capped:
        avg_fill = round(100 * sum(min(1, r["registered"] / r["max_attendees"]) for r in capped) / len(capped))
    return {
        "totals": {
            "conferences": len(by_conference),
            "upcoming": len(by_conference) - len(past),
            "past": len(past),
            "registered": registered,
            "waitlisted": sum(r["waitlisted"] for r in by_conference),
            "checked_in": checked_in,
            "checkin_rate": round(100 * past_checked / past_registered) if past_registered else None,
            "avg_fill": avg_fill,
            "registrations_in_period": sum(regs),
        },
        "trend": trend,
        "by_conference": by_conference,
        "by_category": sorted(by_category.values(), key=lambda b: -b["registered"]),
        "by_weekday": by_weekday,
    }


@router.put("/me")
def update_profile(body: ProfileUpdate, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    for k, v in body.model_dump().items():
        setattr(org, k, v)
    db.add(ActivityLog(organizer_id=org.id, action="update_profile", target=org.email))
    db.commit()
    db.refresh(org)
    return organizer_dict(org)


@router.put("/me/language")
def update_language(body: LanguageUpdate, org: Organizer = Depends(get_current_organizer),
                    db: Session = Depends(get_db)):
    """Remembered so emails to this organizer use the language they picked in the app."""
    org.lang = body.lang
    db.commit()
    return {"lang": org.lang}


@router.post("/me/photo")
async def upload_photo(file: UploadFile = File(...), org: Organizer = Depends(get_current_organizer),
                       db: Session = Depends(get_db)):
    url = await save_image(file, "avatar")
    old, org.avatar = org.avatar, url
    db.add(ActivityLog(organizer_id=org.id, action="update_photo", target=org.email))
    db.commit()
    db.refresh(org)
    delete_image(old)
    return organizer_dict(org)


@router.delete("/me/photo")
def remove_photo(org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    old, org.avatar = org.avatar, None
    db.commit()
    db.refresh(org)
    delete_image(old)
    return organizer_dict(org)


@router.put("/me/password", status_code=204)
def change_password(body: PasswordChange, org: Organizer = Depends(get_current_organizer),
                    db: Session = Depends(get_db)):
    if not verify_password(body.current_password, org.password_hash):
        raise AppError(400, "wrong_password", "Current password is incorrect")
    org.password_hash = hash_password(body.new_password)
    db.add(ActivityLog(organizer_id=org.id, action="change_password", target=org.email))
    db.commit()


def organizer_files(db: Session, org: Organizer) -> list[str | None]:
    """The organizer's photo and every image of their conferences, to delete from disk after the rows go."""
    covers = db.execute(select(Conference.cover_image).where(Conference.organizer_id == org.id)).scalars().all()
    photos = db.execute(
        select(Speaker.photo).join(Conference, Speaker.conference_id == Conference.id)
        .where(Conference.organizer_id == org.id)
    ).scalars().all()
    return [org.avatar, *covers, *photos]


@router.delete("/me", status_code=204)
def delete_account(body: DeleteAccountRequest, org: Organizer = Depends(get_current_organizer),
                   db: Session = Depends(get_db)):
    if not verify_password(body.password, org.password_hash):
        raise AppError(400, "wrong_password", "Password is incorrect")
    files = organizer_files(db, org)
    clear_notifications(db, "organizer", org.id)
    db.delete(org)
    db.commit()
    for url in files:
        delete_image(url)
