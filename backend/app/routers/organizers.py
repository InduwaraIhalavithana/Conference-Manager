from __future__ import annotations
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.deps import get_current_organizer
from app.core.security import hash_password, verify_password
from app.models.organizer import Organizer
from app.models.activity import ActivityLog
from app.models.attendee import Attendee
from app.models.conference import Conference
from app.schemas.auth import OrganizerOut
from app.schemas.organizer import ProfileUpdate, PasswordChange, DeleteAccountRequest

router = APIRouter(prefix="/api/organizers", tags=["organizers"])


@router.get("/me/overview")
def my_overview(org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    """Dashboard extras: 14-day registration trend + recent activity."""
    since = datetime.now(timezone.utc) - timedelta(days=13)
    rows = db.execute(
        select(func.date(Attendee.registered_at), func.count(Attendee.id))
        .join(Conference, Attendee.conference_id == Conference.id)
        .where(Conference.organizer_id == org.id, Attendee.registered_at >= since)
        .group_by(func.date(Attendee.registered_at))
    ).all()
    by_day = {str(d): c for d, c in rows}
    today = date.today()
    trend = [
        {"date": str(today - timedelta(days=i)), "count": by_day.get(str(today - timedelta(days=i)), 0)}
        for i in range(13, -1, -1)
    ]

    activity = db.execute(
        select(ActivityLog)
        .where(ActivityLog.organizer_id == org.id)
        .order_by(ActivityLog.created_at.desc())
        .limit(8)
    ).scalars().all()

    return {
        "trend": trend,
        "activity": [
            {"action": a.action, "target": a.target, "created_at": a.created_at.isoformat()}
            for a in activity
        ],
    }


@router.put("/me", response_model=OrganizerOut)
def update_profile(body: ProfileUpdate, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    org.first_name = body.first_name
    org.last_name = body.last_name
    org.phone = body.phone
    db.add(ActivityLog(organizer_id=org.id, action="update_profile", target=org.email))
    db.commit()
    db.refresh(org)
    return org


@router.put("/me/password", status_code=204)
def change_password(body: PasswordChange, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, org.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    org.password_hash = hash_password(body.new_password)
    db.add(ActivityLog(organizer_id=org.id, action="change_password", target=org.email))
    db.commit()


@router.delete("/me", status_code=204)
def delete_account(body: DeleteAccountRequest, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    if not verify_password(body.password, org.password_hash):
        raise HTTPException(status_code=400, detail="Password is incorrect")
    db.delete(org)
    db.commit()
