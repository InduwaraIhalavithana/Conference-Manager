"""The notification bell, for organizers and the admin. Same endpoints, the token decides whose list it is."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.deps import bearer, get_current_admin, get_current_organizer
from app.core.errors import AppError
from app.core.security import decode_token
from app.core.serialize import columns
from app.db.database import get_db
from app.models.notification import Notification

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def recipient(credentials: HTTPAuthorizationCredentials = Depends(bearer),
              db: Session = Depends(get_db)) -> tuple[str, int]:
    payload = decode_token(credentials.credentials) if credentials else None
    kind = payload.get("type") if payload else None
    if kind == "organizer":
        return "organizer", get_current_organizer(credentials, db).id
    if kind == "admin":
        return "admin", get_current_admin(credentials, db).id
    raise AppError(401, "not_authenticated", "Not authenticated")


def _mine(who: tuple[str, int]):
    return (Notification.recipient_type == who[0]) & (Notification.recipient_id == who[1])


@router.get("/")
def list_notifications(limit: int = Query(20, ge=1, le=100), who=Depends(recipient), db: Session = Depends(get_db)):
    items = db.execute(
        select(Notification).where(_mine(who))
        .order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    ).scalars().all()
    unread = db.execute(select(func.count(Notification.id)).where(_mine(who), Notification.is_read.is_(False))).scalar()
    return {"items": [columns(n) for n in items], "unread": unread or 0}


@router.get("/unread-count")
def unread_count(who=Depends(recipient), db: Session = Depends(get_db)):
    unread = db.execute(select(func.count(Notification.id)).where(_mine(who), Notification.is_read.is_(False))).scalar()
    return {"unread": unread or 0}


@router.put("/{notification_id}/read", status_code=204)
def mark_read(notification_id: int, who=Depends(recipient), db: Session = Depends(get_db)):
    n = db.execute(select(Notification).where(_mine(who), Notification.id == notification_id)).scalar_one_or_none()
    if not n:
        raise AppError(404, "not_found", "Notification not found")
    n.is_read = True
    db.commit()


@router.put("/read-all", status_code=204)
def mark_all_read(who=Depends(recipient), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(_mine(who), Notification.is_read.is_(False)).values(is_read=True))
    db.commit()
