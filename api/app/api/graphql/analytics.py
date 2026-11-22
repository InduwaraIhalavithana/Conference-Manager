"""The organizer's analytics: one conference in detail, and an overview of all of theirs."""

from datetime import datetime
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api.graphql.context import Context
from app.api.graphql.types import UserError, guarded
from app.services import analytics as service


@strawberry.type(description="Sign-ups on one day (in the conference's time zone): how many, and how many later left.")
class DayCount:
    day: str
    registered: int
    left: int
    waitlisted: int


@strawberry.type(description="Net arrivals (check-ins minus undone ones) in a 15-minute slot starting at `at`.")
class SlotCount:
    at: datetime
    count: int


@strawberry.type
class KeyCount:
    key: str
    count: int


@strawberry.type
class ConferenceAnalytics:
    by_day: list[DayCount]
    arrivals: list[SlotCount]
    by_status: list[KeyCount]
    by_language: list[KeyCount]
    registered: int
    confirmed: int
    waitlisted: int
    checked_in: int
    capacity: int | None
    ever_confirmed: int = strawberry.field(description="Registrations that entered their email code, ever.")
    total_signups: int = strawberry.field(description="Every registration, including cancelled and released ones.")


@strawberry.type
class ConferenceFill:
    id: strawberry.ID
    title: str
    starts_at: datetime
    capacity: int | None
    registered: int
    checked_in: int


@strawberry.type
class AnalyticsOverview:
    by_day: list[DayCount]
    conferences: list[ConferenceFill]


ConferenceAnalyticsResult = Annotated[ConferenceAnalytics | UserError, strawberry.union("ConferenceAnalyticsResult")]
AnalyticsOverviewResult = Annotated[AnalyticsOverview | UserError, strawberry.union("AnalyticsOverviewResult")]


def _days(rows: list[service.DayCount]) -> list[DayCount]:
    return [DayCount(day=r.day, registered=r.registered, left=r.left, waitlisted=r.waitlisted) for r in rows]


def _counts(values: dict[str, int]) -> list[KeyCount]:
    return [KeyCount(key=k, count=v) for k, v in sorted(values.items(), key=lambda kv: -kv[1])]


@strawberry.type
class AnalyticsQuery:
    @strawberry.field(description="Registrations over time, arrivals, and breakdowns for one of your conferences.")
    async def conference_analytics(
        self, info: Info[Context, None], conference_id: strawberry.ID
    ) -> ConferenceAnalyticsResult:
        async def run() -> ConferenceAnalytics:
            a = await service.conference_analytics(info.context.viewer, str(conference_id))
            return ConferenceAnalytics(
                by_day=_days(a.by_day),
                arrivals=[SlotCount(at=s.at, count=s.count) for s in a.arrivals],
                by_status=_counts(a.by_status),
                by_language=_counts(a.by_language),
                registered=a.registered,
                confirmed=a.confirmed,
                waitlisted=a.waitlisted,
                checked_in=a.checked_in,
                capacity=a.capacity,
                ever_confirmed=a.ever_confirmed,
                total_signups=a.total_signups,
            )

        return await guarded(run)

    @strawberry.field(
        description="Sign-ups per day over the last `days` across your conferences, and how full each one is."
    )
    async def analytics_overview(self, info: Info[Context, None], days: int = 30) -> AnalyticsOverviewResult:
        async def run() -> AnalyticsOverview:
            o = await service.overview(info.context.viewer, days)
            return AnalyticsOverview(
                by_day=_days(o.by_day),
                conferences=[
                    ConferenceFill(
                        id=strawberry.ID(c.id),
                        title=c.title,
                        starts_at=c.starts_at,
                        capacity=c.capacity,
                        registered=c.registered,
                        checked_in=c.checked_in,
                    )
                    for c in o.conferences
                ],
            )

        return await guarded(run)
