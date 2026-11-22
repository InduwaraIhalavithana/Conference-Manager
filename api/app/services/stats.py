"""Public platform numbers (home page). Cached in Redis for a minute so busy home pages stay cheap."""

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta

from app.db import redis
from app.repositories import stats

CACHE_SECONDS = 60


@dataclass(frozen=True)
class PlatformStats:
    upcoming_conferences: int
    held_conferences: int
    registered_attendees: int
    checked_in: int
    speakers: int
    sessions: int
    organizers: int
    registrations_this_week: int


async def platform_stats() -> PlatformStats:
    key = redis.key("cache", "platform_stats")
    cached = await redis.client().get(key)
    if cached:
        return PlatformStats(**json.loads(cached))
    now = datetime.now(UTC)
    numbers = await stats.conference_numbers(now)
    result = PlatformStats(
        upcoming_conferences=numbers["upcoming"],
        held_conferences=numbers["held"],
        registered_attendees=numbers["registered"],
        checked_in=numbers["checked_in"],
        speakers=numbers["speakers"],
        sessions=numbers["sessions"],
        organizers=await stats.verified_organizers(),
        registrations_this_week=await stats.registrations_since(now - timedelta(days=7)),
    )
    await redis.client().set(key, json.dumps(asdict(result)), ex=CACHE_SECONDS)
    return result


async def upcoming_categories() -> list[tuple[str, int]]:
    return await stats.upcoming_by("category", datetime.now(UTC), limit=7)


async def upcoming_cities(limit: int = 12) -> list[tuple[str, int]]:
    return await stats.upcoming_by("venue.city", datetime.now(UTC), limit=max(1, min(limit, 50)))
