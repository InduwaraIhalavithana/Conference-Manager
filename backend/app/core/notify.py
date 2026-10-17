"""Create in-app notifications. The frontend turns `kind` + `params` into text in the viewer's language."""
from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.admin import Admin
from app.models.notification import Notification


def notify_organizer(db: Session, organizer_id: int, kind: str, params: dict | None = None,
                     link: str | None = None) -> None:
    db.add(Notification(recipient_type="organizer", recipient_id=organizer_id, kind=kind, params=params or {},
                        link=link))


def notify_admins(db: Session, kind: str, params: dict | None = None, link: str | None = None) -> None:
    for admin_id in db.execute(select(Admin.id)).scalars():
        db.add(Notification(recipient_type="admin", recipient_id=admin_id, kind=kind, params=params or {}, link=link))


def clear_notifications(db: Session, recipient_type: str, recipient_id: int) -> None:
    """Drop a deleted account's notifications (recipient_id has no foreign key to cascade from)."""
    db.execute(delete(Notification).where(Notification.recipient_type == recipient_type,
                                          Notification.recipient_id == recipient_id))
