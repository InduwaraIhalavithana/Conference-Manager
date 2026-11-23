"""Live Q&A: questions ticket holders ask about a session, with upvotes from other ticket holders."""

from datetime import datetime
from typing import Literal

from beanie import Document, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.common import utcnow

QuestionStatus = Literal["open", "answered", "hidden"]


class Question(Document):
    conference_id: PydanticObjectId
    session_id: str
    registration_id: PydanticObjectId  # who asked; never shown, only their first name
    author_name: str
    text: str
    voter_ids: list[PydanticObjectId] = Field(default_factory=list)  # registrations that upvoted, one vote each
    votes: int = 0
    status: QuestionStatus = "open"
    created_at: datetime = Field(default_factory=utcnow)
    answered_at: datetime | None = None

    class Settings:
        name = "questions"
        indexes = [
            IndexModel([("conference_id", ASCENDING), ("session_id", ASCENDING), ("votes", DESCENDING)]),
        ]
