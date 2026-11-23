"""Repository for live Q&A questions. Votes are changed atomically, so two quick clicks never count twice."""

from typing import Any

from beanie import PydanticObjectId
from pymongo import ReturnDocument

from app.models import Question
from app.models.common import utcnow
from app.models.question import QuestionStatus


def _questions() -> Any:
    return Question.get_pymongo_collection()


async def insert(question: Question) -> Question:
    await question.insert()
    return question


async def by_id(question_id: str) -> Question | None:
    try:
        oid = PydanticObjectId(question_id)
    except Exception:
        return None
    return await Question.get(oid)


async def for_session(conference_id: PydanticObjectId, session_id: str, include_hidden: bool) -> list[Question]:
    """Most votes first, then oldest first."""
    query: dict[str, Any] = {"conference_id": conference_id, "session_id": session_id}
    if not include_hidden:
        query["status"] = {"$ne": "hidden"}
    return await Question.find(query).sort("-votes", "+created_at").to_list()


async def counts_by_session(conference_id: PydanticObjectId) -> dict[str, int]:
    """Visible questions per session (for the session pickers)."""
    pipeline = [
        {"$match": {"conference_id": conference_id, "status": {"$ne": "hidden"}}},
        {"$group": {"_id": "$session_id", "n": {"$sum": 1}}},
    ]
    rows = await (await _questions().aggregate(pipeline)).to_list()
    return {r["_id"]: int(r["n"]) for r in rows}


async def set_vote(question_id: PydanticObjectId, voter_id: PydanticObjectId, on: bool) -> Question | None:
    """Add or remove one vote; a no-op when it is already that way (the filter makes it so)."""
    if on:
        query = {"_id": question_id, "voter_ids": {"$ne": voter_id}}
        change = {"$push": {"voter_ids": voter_id}, "$inc": {"votes": 1}}
    else:
        query = {"_id": question_id, "voter_ids": voter_id}
        change = {"$pull": {"voter_ids": voter_id}, "$inc": {"votes": -1}}
    await _questions().update_one(query, change)
    return await Question.get(question_id)


async def set_status(question_id: PydanticObjectId, status: QuestionStatus) -> Question | None:
    doc = await _questions().find_one_and_update(
        {"_id": question_id},
        {"$set": {"status": status, "answered_at": utcnow() if status == "answered" else None}},
        return_document=ReturnDocument.AFTER,
    )
    return Question.model_validate(doc) if doc else None
