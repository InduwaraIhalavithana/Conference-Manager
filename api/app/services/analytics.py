"""Numbers for the organizer's analytics page: one conference in detail, or all of theirs at a glance."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from app.models.common import utcnow
from app.repositories import analytics as repo
from app.repositories import conferences as conference_repo
from app.services.auth import Viewer
from app.services.conferences import require_organizer
from app.services.registrations import owned_conference

ARRIVAL_SLOT_MINUTES = 15
OVERVIEW_DAYS = 30
DEFAULT_TZ = "Asia/Colombo"


@dataclass(frozen=True)
class DayCount:
    day: str
    registered: int
    left: int
    waitlisted: int


@dataclass(frozen=True)
class SlotCount:
    at: datetime
    count: int


@dataclass(frozen=True)
class ConferenceAnalytics:
    by_day: list[DayCount]
    arrivals: list[SlotCount]
    by_status: dict[str, int]
    by_language: dict[str, int]
    registered: int
    confirmed: int
    waitlisted: int
    checked_in: int
    capacity: int | None
    ever_confirmed: int
    total_signups: int


@dataclass(frozen=True)
class ConferenceRow:
    id: str
    title: str
    starts_at: datetime
    capacity: int | None
    registered: int
    checked_in: int


@dataclass(frozen=True)
class Overview:
    by_day: list[DayCount]
    conferences: list[ConferenceRow] = field(default_factory=list)


def _days(rows: list[dict[str, Any]]) -> list[DayCount]:
    return [
        DayCount(
            day=str(r["_id"]), registered=int(r["registered"]), left=int(r["left"]), waitlisted=int(r["waitlisted"])
        )
        for r in rows
    ]


async def conference_analytics(viewer: Viewer | None, conference_id: str) -> ConferenceAnalytics:
    conference = await owned_conference(viewer, conference_id)
    assert conference.id is not None
    by_status = await repo.counts_by(conference.id, "status")
    return ConferenceAnalytics(
        by_day=_days(await repo.registrations_by_day([conference.id], None, conference.timezone)),
        arrivals=[
            SlotCount(at=r["_id"], count=int(r["count"]))
            for r in await repo.arrivals(conference.id, ARRIVAL_SLOT_MINUTES, conference.timezone)
        ],
        by_status=by_status,
        by_language=await repo.counts_by(conference.id, "lang"),
        registered=conference.counters.registered,
        confirmed=conference.counters.confirmed,
        waitlisted=conference.counters.waitlisted,
        checked_in=conference.counters.checked_in,
        capacity=conference.capacity,
        ever_confirmed=await repo.confirmed_count(conference.id),
        total_signups=sum(by_status.values()),
    )


async def overview(viewer: Viewer | None, days: int = OVERVIEW_DAYS) -> Overview:
    """Sign-ups per day over the last `days` across all the organizer's conferences, and each conference's fill."""
    organizer_id = require_organizer(viewer)
    conferences = await conference_repo.for_organizer(organizer_id)
    ids = [c.id for c in conferences if c.id is not None]
    since = utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = await repo.registrations_by_day(ids, since, DEFAULT_TZ) if ids else []
    return Overview(
        by_day=_days(rows),
        conferences=[
            ConferenceRow(
                id=str(c.id),
                title=c.title.en,
                starts_at=c.starts_at,
                capacity=c.capacity,
                registered=c.counters.registered,
                checked_in=c.counters.checked_in,
            )
            for c in sorted(conferences, key=lambda c: c.starts_at, reverse=True)
            if c.status != "draft"
        ],
    )
