"""Public numbers for the home page, and the contact form."""

from enum import Enum

import strawberry
from strawberry.types import Info

from app.api.graphql.conferences import Category
from app.api.graphql.context import Context
from app.api.graphql.types import Done, DoneResult, guarded
from app.services import contact
from app.services import stats as service


@strawberry.type
class PlatformStats:
    upcoming_conferences: int
    held_conferences: int
    registered_attendees: int
    checked_in: int
    speakers: int
    sessions: int
    organizers: int
    registrations_this_week: int


@strawberry.type
class CategoryCount:
    category: Category
    count: int


@strawberry.type
class CityCount:
    city: str
    count: int


@strawberry.type
class StatsQuery:
    @strawberry.field(description="Platform-wide numbers, refreshed every minute.")
    async def platform_stats(self) -> PlatformStats:
        s = await service.platform_stats()
        return PlatformStats(
            upcoming_conferences=s.upcoming_conferences,
            held_conferences=s.held_conferences,
            registered_attendees=s.registered_attendees,
            checked_in=s.checked_in,
            speakers=s.speakers,
            sessions=s.sessions,
            organizers=s.organizers,
            registrations_this_week=s.registrations_this_week,
        )

    @strawberry.field(description="How many upcoming conferences each topic has (topics with none are left out).")
    async def upcoming_categories(self) -> list[CategoryCount]:
        return [CategoryCount(category=Category(c), count=n) for c, n in await service.upcoming_categories()]

    @strawberry.field(description="Cities with upcoming conferences, most first.")
    async def upcoming_cities(self, first: int = 12) -> list[CityCount]:
        return [CityCount(city=c, count=n) for c, n in await service.upcoming_cities(first)]


@strawberry.enum
class ContactTopic(Enum):
    GENERAL = "general"
    ATTENDING = "attending"
    ORGANIZING = "organizing"
    TECHNICAL = "technical"
    PARTNERSHIP = "partnership"


@strawberry.input
class ContactInput:
    name: str
    email: str
    message: str
    topic: ContactTopic = ContactTopic.GENERAL


@strawberry.type
class PublicMutation:
    @strawberry.mutation(description="The public contact form (5 messages per 10 minutes per address).")
    async def send_contact_message(self, info: Info[Context, None], input: ContactInput) -> DoneResult:
        async def run() -> Done:
            await contact.send(
                info.context.ip, name=input.name, email=input.email, topic=input.topic.value, message=input.message
            )
            return Done()

        return await guarded(run)
