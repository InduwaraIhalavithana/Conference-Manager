"""Queries for the admin area: platform counts, paged lists with search, and removing an organizer's data."""

import re
from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models import (
    ActivityLog,
    AuthSession,
    CheckInEvent,
    Conference,
    ContactMessage,
    Feedback,
    Notification,
    Organizer,
    PasswordReset,
    Registration,
)


def _search(q: str | None, *fields: str) -> dict[str, Any]:
    """Case-insensitive "contains" over the given fields; the text is escaped, so it can never be a regex."""
    if not q or not q.strip():
        return {}
    pattern = {"$regex": re.escape(q.strip()[:100]), "$options": "i"}
    return {"$or": [{f: pattern} for f in fields]}


# ── Counts ───────────────────────────────────────────────────────────────────────────────────────────


async def organizer_counts() -> dict[str, int]:
    return {
        "active": await Organizer.find({"email_verified_at": {"$ne": None}, "is_suspended": False}).count(),
        "suspended": await Organizer.find({"is_suspended": True}).count(),
        "unverified": await Organizer.find({"email_verified_at": None}).count(),
    }


async def conference_counts(now: datetime) -> dict[str, int]:
    return {
        "upcoming": await Conference.find({"status": "published", "hidden": False, "ends_at": {"$gte": now}}).count(),
        "drafts": await Conference.find({"status": "draft"}).count(),
        "cancelled": await Conference.find({"status": "cancelled"}).count(),
        "hidden": await Conference.find({"hidden": True}).count(),
    }


async def registrations_since(since: datetime) -> int:
    return await Registration.find({"created_at": {"$gte": since}}).count()


async def active_registrations() -> int:
    return await Registration.find({"status": {"$in": ["held", "registered", "waitlisted"]}}).count()


async def open_contacts() -> int:
    return await ContactMessage.find({"status": "open"}).count()


async def open_feedback() -> int:
    return await Feedback.find({"status": "open"}).count()


# ── Organizers ───────────────────────────────────────────────────────────────────────────────────────


def _organizer_filter(q: str | None, status: str) -> dict[str, Any]:
    query = _search(q, "first_name", "last_name", "email", "organization")
    if status == "active":
        query.update({"email_verified_at": {"$ne": None}, "is_suspended": False})
    elif status == "suspended":
        query["is_suspended"] = True
    elif status == "unverified":
        query["email_verified_at"] = None
    return query


async def organizers(q: str | None, status: str, skip: int, limit: int) -> tuple[list[Organizer], int]:
    query = _organizer_filter(q, status)
    items = await Organizer.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, await Organizer.find(query).count()


async def conference_counts_by_organizer(ids: list[PydanticObjectId]) -> dict[PydanticObjectId, int]:
    cursor = await Conference.get_pymongo_collection().aggregate(
        [{"$match": {"organizer_id": {"$in": ids}}}, {"$group": {"_id": "$organizer_id", "n": {"$sum": 1}}}]
    )
    return {row["_id"]: int(row["n"]) for row in await cursor.to_list(None)}


async def set_hidden_for_organizer(organizer_id: PydanticObjectId, hidden: bool) -> int:
    """Hide all of an organizer's visible conferences (suspension), or show again only those it hid (restore)."""
    if hidden:
        query: dict[str, Any] = {"organizer_id": organizer_id, "hidden": False}
        update = {"$set": {"hidden": True, "hidden_reason": "suspended"}}
    else:
        query = {"organizer_id": organizer_id, "hidden": True, "hidden_reason": "suspended"}
        update = {"$set": {"hidden": False, "hidden_reason": None}}
    result = await Conference.get_pymongo_collection().update_many(query, update)
    return int(result.modified_count)


async def delete_organizer_data(organizer_id: PydanticObjectId) -> dict[str, int]:
    """Everything stored for one organizer: their conferences with registrations and check-ins, sessions,
    password resets, notifications and feedback, then the account. Activity entries stay (audit trail)."""
    conference_ids = [c.id for c in await Conference.find({"organizer_id": organizer_id}).to_list() if c.id]
    counts = {
        "registrations": (await Registration.find({"conference_id": {"$in": conference_ids}}).delete()),
        "checkins": (await CheckInEvent.find({"meta.conference_id": {"$in": conference_ids}}).delete()),
        "conferences": (await Conference.find({"organizer_id": organizer_id}).delete()),
        "sessions": (await AuthSession.find({"subject_type": "organizer", "subject_id": organizer_id}).delete()),
        "resets": (await PasswordReset.find({"organizer_id": organizer_id}).delete()),
        "notifications": (
            await Notification.find({"recipient.type": "organizer", "recipient.id": organizer_id}).delete()
        ),
        "feedback": (await Feedback.find({"organizer_id": organizer_id}).delete()),
        "organizer": (await Organizer.find({"_id": organizer_id}).delete()),
    }
    return {k: int(getattr(v, "deleted_count", 0) or 0) for k, v in counts.items()}


# ── Conferences ──────────────────────────────────────────────────────────────────────────────────────


async def conferences(q: str | None, status: str, skip: int, limit: int, now: datetime) -> tuple[list[Conference], int]:
    query = _search(q, "title.en", "title.si", "title.ta", "venue.name", "venue.city", "slug")
    if status == "upcoming":
        query.update({"status": "published", "ends_at": {"$gte": now}})
    elif status == "past":
        query.update({"status": "published", "ends_at": {"$lt": now}})
    elif status in ("draft", "cancelled"):
        query["status"] = status
    elif status == "hidden":
        query["hidden"] = True
    items = await Conference.find(query).sort("-starts_at").skip(skip).limit(limit).to_list()
    return items, await Conference.find(query).count()


# ── Inbox, feedback, activity ────────────────────────────────────────────────────────────────────────


async def contacts(status: str | None, skip: int, limit: int) -> tuple[list[ContactMessage], int]:
    query: dict[str, Any] = {"status": status} if status else {}
    items = await ContactMessage.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, await ContactMessage.find(query).count()


async def contact_by_id(message_id: PydanticObjectId) -> ContactMessage | None:
    return await ContactMessage.get(message_id)


async def feedback(
    status: str | None, organizer_id: PydanticObjectId | None, skip: int, limit: int
) -> tuple[list[Feedback], int]:
    query: dict[str, Any] = {}
    if status:
        query["status"] = status
    if organizer_id is not None:
        query["organizer_id"] = organizer_id
    items = await Feedback.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, await Feedback.find(query).count()


async def feedback_by_id(feedback_id: PydanticObjectId) -> Feedback | None:
    return await Feedback.get(feedback_id)


async def activity(actor_type: str | None, action: str | None, skip: int, limit: int) -> tuple[list[ActivityLog], int]:
    query: dict[str, Any] = {}
    if actor_type:
        query["actor.type"] = actor_type
    if action:
        query["action"] = action
    items = await ActivityLog.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    return items, await ActivityLog.find(query).count()


async def activity_actions() -> list[str]:
    return sorted(await ActivityLog.get_pymongo_collection().distinct("action"))
