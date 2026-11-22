"""Public numbers for the home page, computed with MongoDB aggregation pipelines."""

from datetime import datetime
from typing import Any

from app.models import Conference, Organizer, Registration

PUBLIC = {"status": "published", "hidden": False}


async def _aggregate(model: Any, pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cursor = await model.get_pymongo_collection().aggregate(pipeline)
    return await cursor.to_list(None)  # type: ignore[no-any-return]


async def conference_numbers(now: datetime) -> dict[str, int]:
    rows = await _aggregate(
        Conference,
        [
            {"$match": PUBLIC},
            {
                "$group": {
                    "_id": None,
                    "upcoming": {"$sum": {"$cond": [{"$gte": ["$ends_at", now]}, 1, 0]}},
                    "held": {"$sum": {"$cond": [{"$lt": ["$ends_at", now]}, 1, 0]}},
                    "speakers": {"$sum": {"$size": "$speakers"}},
                    "sessions": {"$sum": {"$size": "$sessions"}},
                    "registered": {"$sum": "$counters.confirmed"},
                    "checked_in": {"$sum": "$counters.checked_in"},
                }
            },
        ],
    )
    row = rows[0] if rows else {}
    return {k: int(row.get(k, 0)) for k in ("upcoming", "held", "speakers", "sessions", "registered", "checked_in")}


async def registrations_since(since: datetime) -> int:
    return await Registration.find({"created_at": {"$gte": since}, "active": True}).count()


async def verified_organizers() -> int:
    return await Organizer.find({"email_verified_at": {"$ne": None}, "is_suspended": False}).count()


async def upcoming_by(field: str, now: datetime, limit: int) -> list[tuple[str, int]]:
    """Upcoming public conferences grouped by a field (category or venue.city), most first."""
    rows = await _aggregate(
        Conference,
        [
            {"$match": {**PUBLIC, "ends_at": {"$gte": now}, field: {"$nin": [None, ""]}}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1, "_id": 1}},
            {"$limit": limit},
        ],
    )
    return [(str(r["_id"]), int(r["count"])) for r in rows]
