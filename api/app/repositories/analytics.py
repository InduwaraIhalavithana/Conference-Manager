"""Aggregations for the organizer's analytics. Dates are grouped in the conference's time zone."""

from datetime import datetime
from typing import Any

from beanie import PydanticObjectId

from app.models import CheckInEvent, Registration


async def _aggregate(model: Any, pipeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    cursor = await model.get_pymongo_collection().aggregate(pipeline)
    rows: list[dict[str, Any]] = await cursor.to_list(None)
    return rows


async def registrations_by_day(
    conference_ids: list[PydanticObjectId], since: datetime | None, timezone: str
) -> list[dict[str, Any]]:
    """Per day: sign-ups (by the day they registered), and how many of those later left (cancelled or released)."""
    match: dict[str, Any] = {"conference_id": {"$in": conference_ids}}
    if since is not None:
        match["created_at"] = {"$gte": since}
    pipeline: list[dict[str, Any]] = [
        {"$match": match},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at", "timezone": timezone}},
                "registered": {"$sum": 1},
                "left": {"$sum": {"$cond": [{"$in": ["$status", ["cancelled", "released"]]}, 1, 0]}},
                "waitlisted": {"$sum": {"$cond": [{"$eq": ["$status", "waitlisted"]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    return await _aggregate(Registration, pipeline)


async def arrivals(conference_id: PydanticObjectId, minutes: int, timezone: str) -> list[dict[str, Any]]:
    """Net arrivals per `minutes`-long slot (check-ins minus undone ones), from the time-series collection."""
    pipeline: list[dict[str, Any]] = [
        {"$match": {"meta.conference_id": conference_id}},
        {
            "$group": {
                "_id": {"$dateTrunc": {"date": "$at", "unit": "minute", "binSize": minutes, "timezone": timezone}},
                "count": {"$sum": {"$cond": ["$undone", -1, 1]}},
            }
        },
        {"$match": {"count": {"$gt": 0}}},
        {"$sort": {"_id": 1}},
    ]
    return await _aggregate(CheckInEvent, pipeline)


async def counts_by(conference_id: PydanticObjectId, field: str) -> dict[str, int]:
    pipeline: list[dict[str, Any]] = [
        {"$match": {"conference_id": conference_id}},
        {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
    ]
    rows = await _aggregate(Registration, pipeline)
    return {str(row["_id"]): int(row["count"]) for row in rows}


async def confirmed_count(conference_id: PydanticObjectId) -> int:
    return await Registration.find({"conference_id": conference_id, "confirmed_at": {"$ne": None}}).count()
