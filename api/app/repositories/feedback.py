"""Repository for attendee ratings (session_feedback) and the registration fields Phase 6 adds."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from beanie import PydanticObjectId
from pymongo import ReturnDocument

from app.models import Registration, SessionRating
from app.models.common import utcnow


@dataclass(frozen=True)
class ScoreSummary:
    session_id: str | None
    average: float
    count: int


def _ratings() -> Any:
    return SessionRating.get_pymongo_collection()


async def save_rating(
    conference_id: PydanticObjectId,
    registration_id: PydanticObjectId,
    session_id: str | None,
    score: int,
    comment: str | None,
) -> SessionRating:
    """Insert or replace this ticket's rating for one session (or the conference): one per pair, by index."""
    now = utcnow()
    doc = await _ratings().find_one_and_update(
        {"registration_id": registration_id, "session_id": session_id},
        {
            "$set": {"conference_id": conference_id, "score": score, "comment": comment, "updated_at": now},
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    rating: SessionRating = SessionRating.model_validate(doc)
    return rating


async def for_registration(registration_id: PydanticObjectId) -> list[SessionRating]:
    return await SessionRating.find({"registration_id": registration_id}).to_list()


async def summary(conference_id: PydanticObjectId) -> list[ScoreSummary]:
    """Average score and number of ratings per session; session_id None is the conference as a whole."""
    pipeline = [
        {"$match": {"conference_id": conference_id}},
        {"$group": {"_id": "$session_id", "average": {"$avg": "$score"}, "count": {"$sum": 1}}},
    ]
    rows = await (await _ratings().aggregate(pipeline)).to_list()
    return [
        ScoreSummary(session_id=r["_id"], average=round(float(r["average"]), 2), count=int(r["count"])) for r in rows
    ]


async def comments(conference_id: PydanticObjectId, limit: int = 100) -> list[SessionRating]:
    """The newest ratings that came with a comment."""
    return (
        await SessionRating.find({"conference_id": conference_id, "comment": {"$ne": None}})
        .sort("-updated_at")
        .limit(limit)
        .to_list()
    )


async def respondents(conference_id: PydanticObjectId) -> int:
    """How many tickets gave at least one rating."""
    return len(await _ratings().distinct("registration_id", {"conference_id": conference_id}))


async def set_bookmark(registration_id: PydanticObjectId, session_id: str, on: bool) -> None:
    change = {"$addToSet" if on else "$pull": {"bookmarked_session_ids": session_id}}
    await Registration.get_pymongo_collection().update_one(
        {"_id": registration_id}, {**change, "$set": {"updated_at": utcnow()}}
    )


async def attendees_to_ask(conference_id: PydanticObjectId) -> list[Registration]:
    """Checked-in attendees who have not had the after-the-event feedback email."""
    return await Registration.find(
        {"conference_id": conference_id, "checked_in_at": {"$ne": None}, "feedback_requested_at": None}
    ).to_list()


async def mark_asked(registration_id: PydanticObjectId, at: datetime) -> bool:
    """Set the feedback-email time once; False if another run already did (so nobody gets it twice)."""
    result = await Registration.get_pymongo_collection().update_one(
        {"_id": registration_id, "feedback_requested_at": None}, {"$set": {"feedback_requested_at": at}}
    )
    return bool(result.modified_count)
