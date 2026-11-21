"""Notifications, the activity log, organizer feedback and contact-form messages."""

from datetime import datetime
from typing import Any, Literal

from beanie import Document, PydanticObjectId
from pydantic import EmailStr, Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.common import ActorRef, utcnow

DAY = 24 * 60 * 60


class Notification(Document):
    """``kind`` + ``params`` are translated in the web app, so a notification reads in the viewer's language."""

    recipient: ActorRef
    kind: str
    params: dict[str, Any] = Field(default_factory=dict)
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "notifications"
        indexes = [
            IndexModel([("recipient.type", ASCENDING), ("recipient.id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=180 * DAY),
        ]


class ActivityLog(Document):
    actor: ActorRef
    action: str
    target: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "activity_logs"
        indexes = [
            IndexModel([("actor.type", ASCENDING), ("actor.id", ASCENDING), ("created_at", DESCENDING)]),
            IndexModel([("created_at", ASCENDING)], expireAfterSeconds=365 * DAY),
        ]


class Feedback(Document):
    organizer_id: PydanticObjectId
    subject: str
    message: str
    status: Literal["open", "replied", "closed"] = "open"
    reply: str | None = None
    replied_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "feedback"
        indexes = [IndexModel([("status", ASCENDING), ("created_at", DESCENDING)])]


class ContactMessage(Document):
    name: str
    email: EmailStr
    subject: str
    message: str
    status: Literal["open", "resolved"] = "open"
    resolved_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "contact_messages"
        indexes = [IndexModel([("status", ASCENDING), ("created_at", DESCENDING)])]
