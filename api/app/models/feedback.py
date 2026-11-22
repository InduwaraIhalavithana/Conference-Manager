"""Attendee ratings: one per session per ticket, plus one for the conference as a whole (session_id None)."""

from datetime import datetime

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.common import utcnow


class SessionRating(Document):
    conference_id: PydanticObjectId
    registration_id: PydanticObjectId
    session_id: str | None = None  # None: the conference as a whole
    score: int = Field(ge=1, le=5)
    comment: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "session_feedback"
        indexes = [
            IndexModel(
                [("registration_id", ASCENDING), ("session_id", ASCENDING)],
                unique=True,
                name="one_rating_per_session_per_ticket",
            ),
            IndexModel([("conference_id", ASCENDING), ("session_id", ASCENDING)]),
        ]
