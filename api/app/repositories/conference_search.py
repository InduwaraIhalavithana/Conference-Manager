"""How a public conference search becomes a MongoDB query (Strategy pattern).

``TextIndexSearch`` uses MongoDB's own text and 2dsphere indexes and works everywhere (local Docker, CI,
any MongoDB). An Atlas Search implementation can be added for production in Phase 9 behind the same
interface, without touching the service or GraphQL layers.
"""

import base64
import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Protocol

from beanie import SortDirection
from bson import ObjectId

from app.models.conference import Category

EARTH_RADIUS_KM = 6371.0


@dataclass(frozen=True)
class Near:
    lat: float
    lng: float
    radius_km: float


@dataclass(frozen=True)
class SearchCriteria:
    q: str | None = None
    category: Category | None = None
    city: str | None = None
    near: Near | None = None
    starts_from: datetime | None = None
    starts_to: datetime | None = None
    # Without an explicit date range: upcoming (not ended yet, soonest first), past (ended, latest first) or all.
    timeframe: Literal["upcoming", "past", "all"] = "upcoming"
    now: datetime | None = None
    first: int = 20
    after: str | None = None


@dataclass(frozen=True)
class Cursor:
    """Keyset cursor (starts_at, _id) for date order, or an offset for distance order."""

    starts_at: datetime | None = None
    id: str | None = None
    offset: int | None = None

    def encode(self) -> str:
        raw = (
            {"o": self.offset}
            if self.offset is not None
            else {"s": self.starts_at.isoformat() if self.starts_at else None, "i": self.id}
        )
        return base64.urlsafe_b64encode(json.dumps(raw).encode()).decode().rstrip("=")

    @classmethod
    def decode(cls, value: str | None) -> "Cursor | None":
        if not value:
            return None
        try:
            raw = json.loads(base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)))
            if "o" in raw:
                return cls(offset=max(0, int(raw["o"])))
            return cls(starts_at=datetime.fromisoformat(raw["s"]), id=str(ObjectId(raw["i"])))
        except (ValueError, KeyError, TypeError):
            return None


@dataclass(frozen=True)
class MongoSearch:
    filter: dict[str, Any]
    sort: list[tuple[str, SortDirection]] = field(default_factory=list)
    by_distance: bool = False


class SearchBackend(Protocol):
    def build(self, criteria: SearchCriteria, cursor: Cursor | None) -> MongoSearch: ...


class TextIndexSearch:
    def build(self, criteria: SearchCriteria, cursor: Cursor | None) -> MongoSearch:
        query: dict[str, Any] = {"status": {"$in": ["published", "cancelled"]}, "hidden": False}
        if criteria.q:
            query["$text"] = {"$search": criteria.q}
        if criteria.category:
            query["category"] = criteria.category
        if criteria.city:
            query["venue.city"] = {"$regex": f"^{_escape(criteria.city)}$", "$options": "i"}

        starts: dict[str, Any] = {}
        if criteria.starts_from:
            starts["$gte"] = criteria.starts_from
        if criteria.starts_to:
            starts["$lte"] = criteria.starts_to
        past = False
        if starts:
            query["starts_at"] = starts
        elif criteria.timeframe == "upcoming" and criteria.now:
            query["ends_at"] = {"$gte": criteria.now}
        elif criteria.timeframe == "past" and criteria.now:
            query["ends_at"] = {"$lt": criteria.now}
            past = True

        near = criteria.near
        if near and not criteria.q:
            # Nearest first. $nearSphere cannot be combined with $text, hence the branch below.
            query["venue.location"] = {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [near.lng, near.lat]},
                    "$maxDistance": near.radius_km * 1000,
                }
            }
            return MongoSearch(filter=query, by_distance=True)
        if near:
            query["venue.location"] = {
                "$geoWithin": {"$centerSphere": [[near.lng, near.lat], near.radius_km / EARTH_RADIUS_KM]}
            }

        # Past conferences read latest first; everything else soonest first. The cursor follows the same order.
        beyond, direction = ("$lt", SortDirection.DESCENDING) if past else ("$gt", SortDirection.ASCENDING)
        if cursor and cursor.starts_at and cursor.id:
            query["$or"] = [
                {"starts_at": {beyond: cursor.starts_at}},
                {"starts_at": cursor.starts_at, "_id": {beyond: ObjectId(cursor.id)}},
            ]
        return MongoSearch(filter=query, sort=[("starts_at", direction), ("_id", direction)])


def _escape(text: str) -> str:
    return re.escape(text.strip())


def distance_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))
