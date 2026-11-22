"""The admin area, plus organizer feedback (organizers send it, admins answer it). Thin: rules live in
app.services.admin and app.services.system."""

from datetime import datetime
from enum import Enum
from typing import Annotated

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from app.api.graphql.context import Context
from app.api.graphql.types import Organizer, UserError, guarded
from app.models import ActivityLog as ActivityDoc
from app.models import ContactMessage as ContactDoc
from app.models import Feedback as FeedbackDoc
from app.services import admin as service
from app.services import system


@strawberry.enum
class OrganizerFilter(Enum):
    ALL = "all"
    ACTIVE = "active"
    SUSPENDED = "suspended"
    UNVERIFIED = "unverified"


@strawberry.enum
class AdminConferenceFilter(Enum):
    ALL = "all"
    UPCOMING = "upcoming"
    PAST = "past"
    DRAFT = "draft"
    CANCELLED = "cancelled"
    HIDDEN = "hidden"


@strawberry.enum
class ContactStatus(Enum):
    OPEN = "open"
    RESOLVED = "resolved"


@strawberry.enum
class FeedbackStatus(Enum):
    OPEN = "open"
    REPLIED = "replied"
    CLOSED = "closed"


@strawberry.type
class AdminOverview:
    organizers_active: int
    organizers_suspended: int
    organizers_unverified: int
    conferences_upcoming: int
    conferences_drafts: int
    conferences_cancelled: int
    conferences_hidden: int
    registrations_active: int
    registrations_week: int
    contacts_open: int
    feedback_open: int


@strawberry.type
class AdminOrganizer:
    organizer: Organizer
    suspended: bool
    conferences: int


@strawberry.type
class AdminOrganizerPage:
    items: list[AdminOrganizer]
    total: int


@strawberry.type
class AdminConference:
    id: strawberry.ID
    slug: str
    title: str
    status: str
    hidden: bool
    hidden_reason: str | None
    starts_at: datetime
    city: str | None
    registered: int
    capacity: int | None
    organizer_name: str | None
    organizer_email: str | None


@strawberry.type
class AdminConferencePage:
    items: list[AdminConference]
    total: int


@strawberry.type
class ContactMessage:
    id: strawberry.ID
    name: str
    email: str
    topic: str
    message: str
    status: ContactStatus
    created_at: datetime
    resolved_at: datetime | None

    @classmethod
    def from_doc(cls, d: ContactDoc) -> "ContactMessage":
        return cls(
            id=strawberry.ID(str(d.id)),
            name=d.name,
            email=d.email,
            topic=d.subject,
            message=d.message,
            status=ContactStatus(d.status),
            created_at=d.created_at,
            resolved_at=d.resolved_at,
        )


@strawberry.type
class ContactPage:
    items: list[ContactMessage]
    total: int


@strawberry.type
class FeedbackItem:
    id: strawberry.ID
    subject: str
    message: str
    status: FeedbackStatus
    reply: str | None
    replied_at: datetime | None
    created_at: datetime
    organizer_name: str | None
    organizer_email: str | None

    @classmethod
    def from_doc(cls, d: FeedbackDoc, name: str | None = None, email: str | None = None) -> "FeedbackItem":
        return cls(
            id=strawberry.ID(str(d.id)),
            subject=d.subject,
            message=d.message,
            status=FeedbackStatus(d.status),
            reply=d.reply,
            replied_at=d.replied_at,
            created_at=d.created_at,
            organizer_name=name,
            organizer_email=email,
        )


@strawberry.type
class FeedbackPage:
    items: list[FeedbackItem]
    total: int


@strawberry.type
class FeedbackList:
    items: list[FeedbackItem]


@strawberry.type
class ActivityEntry:
    id: strawberry.ID
    actor_type: str
    actor_name: str | None
    action: str
    target: str | None
    meta: JSON
    created_at: datetime

    @classmethod
    def from_doc(cls, d: ActivityDoc, name: str | None) -> "ActivityEntry":
        return cls(
            id=strawberry.ID(str(d.id)),
            actor_type=d.actor.type,
            actor_name=name,
            action=d.action,
            target=d.target,
            meta=JSON(
                {k: v if isinstance(v, (str, int, float, bool)) or v is None else str(v) for k, v in d.meta.items()}
            ),
            created_at=d.created_at,
        )


@strawberry.type
class ActivityPage:
    items: list[ActivityEntry]
    total: int
    actions: list[str]


@strawberry.type
class JobRun:
    name: str
    at: datetime
    ok: bool
    result: str


@strawberry.type
class SystemStatus:
    mongo: bool
    redis: bool
    worker_running: bool
    worker_seen_at: datetime | None
    queue_length: int
    failed_emails_today: int
    requests_last_hour: int
    errors_last_hour: int
    jobs: list[JobRun]


@strawberry.type
class Removed:
    registrations: int
    conferences: int


AdminOverviewResult = Annotated[AdminOverview | UserError, strawberry.union("AdminOverviewResult")]
AdminOrganizerPageResult = Annotated[AdminOrganizerPage | UserError, strawberry.union("AdminOrganizerPageResult")]
AdminOrganizerResult = Annotated[AdminOrganizer | UserError, strawberry.union("AdminOrganizerResult")]
AdminConferencePageResult = Annotated[AdminConferencePage | UserError, strawberry.union("AdminConferencePageResult")]
AdminConferenceResult = Annotated[AdminConference | UserError, strawberry.union("AdminConferenceResult")]
ContactPageResult = Annotated[ContactPage | UserError, strawberry.union("ContactPageResult")]
ContactResult = Annotated[ContactMessage | UserError, strawberry.union("ContactResult")]
FeedbackPageResult = Annotated[FeedbackPage | UserError, strawberry.union("FeedbackPageResult")]
FeedbackResult = Annotated[FeedbackItem | UserError, strawberry.union("FeedbackResult")]
FeedbackListResult = Annotated[FeedbackList | UserError, strawberry.union("FeedbackListResult")]
ActivityPageResult = Annotated[ActivityPage | UserError, strawberry.union("ActivityPageResult")]
SystemStatusResult = Annotated[SystemStatus | UserError, strawberry.union("SystemStatusResult")]
RemovedResult = Annotated[Removed | UserError, strawberry.union("RemovedResult")]


def _organizer_row(row: service.OrganizerRow) -> AdminOrganizer:
    return AdminOrganizer(
        organizer=Organizer.from_doc(row.organizer), suspended=row.organizer.is_suspended, conferences=row.conferences
    )


def _conference_row(row: service.ConferenceRow) -> AdminConference:
    c = row.conference
    return AdminConference(
        id=strawberry.ID(str(c.id)),
        slug=c.slug,
        title=c.title.en,
        status=c.status,
        hidden=c.hidden,
        hidden_reason=c.hidden_reason,
        starts_at=c.starts_at,
        city=c.venue.city,
        registered=c.counters.registered,
        capacity=c.capacity,
        organizer_name=row.organizer.full_name if row.organizer else None,
        organizer_email=row.organizer.email if row.organizer else None,
    )


@strawberry.type
class AdminQuery:
    @strawberry.field(description="Platform numbers for the admin dashboard.")
    async def admin_overview(self, info: Info[Context, None]) -> AdminOverviewResult:
        async def run() -> AdminOverview:
            o = await service.overview(info.context.viewer)
            return AdminOverview(**o.__dict__)

        return await guarded(run)

    @strawberry.field
    async def admin_organizers(
        self,
        info: Info[Context, None],
        q: str | None = None,
        status: OrganizerFilter = OrganizerFilter.ALL,
        first: int = 25,
        offset: int = 0,
    ) -> AdminOrganizerPageResult:
        async def run() -> AdminOrganizerPage:
            page = await service.organizers(info.context.viewer, q, status.value, first, offset)
            return AdminOrganizerPage(items=[_organizer_row(r) for r in page.items], total=page.total)

        return await guarded(run)

    @strawberry.field
    async def admin_conferences(
        self,
        info: Info[Context, None],
        q: str | None = None,
        status: AdminConferenceFilter = AdminConferenceFilter.ALL,
        first: int = 25,
        offset: int = 0,
    ) -> AdminConferencePageResult:
        async def run() -> AdminConferencePage:
            page = await service.conferences(info.context.viewer, q, status.value, first, offset)
            return AdminConferencePage(items=[_conference_row(r) for r in page.items], total=page.total)

        return await guarded(run)

    @strawberry.field
    async def contact_messages(
        self, info: Info[Context, None], status: ContactStatus | None = None, first: int = 25, offset: int = 0
    ) -> ContactPageResult:
        async def run() -> ContactPage:
            page = await service.contacts(info.context.viewer, status.value if status else None, first, offset)
            return ContactPage(items=[ContactMessage.from_doc(m) for m in page.items], total=page.total)

        return await guarded(run)

    @strawberry.field
    async def admin_feedback(
        self, info: Info[Context, None], status: FeedbackStatus | None = None, first: int = 25, offset: int = 0
    ) -> FeedbackPageResult:
        async def run() -> FeedbackPage:
            page = await service.feedback(info.context.viewer, status.value if status else None, first, offset)
            return FeedbackPage(
                items=[
                    FeedbackItem.from_doc(
                        r.feedback,
                        r.organizer.full_name if r.organizer else None,
                        r.organizer.email if r.organizer else None,
                    )
                    for r in page.items
                ],
                total=page.total,
            )

        return await guarded(run)

    @strawberry.field(description="The signed-in organizer's own feedback and the replies.")
    async def my_feedback(self, info: Info[Context, None]) -> FeedbackListResult:
        async def run() -> FeedbackList:
            return FeedbackList(
                items=[FeedbackItem.from_doc(f) for f in await service.my_feedback(info.context.viewer)]
            )

        return await guarded(run)

    @strawberry.field
    async def activity_log(
        self,
        info: Info[Context, None],
        actor_type: str | None = None,
        action: str | None = None,
        first: int = 50,
        offset: int = 0,
    ) -> ActivityPageResult:
        async def run() -> ActivityPage:
            kind = actor_type if actor_type in ("organizer", "admin") else None
            page = await service.activity(info.context.viewer, kind, action, first, offset)  # type: ignore[arg-type]
            return ActivityPage(
                items=[ActivityEntry.from_doc(r.entry, r.actor_name) for r in page.items],
                total=page.total,
                actions=await service.activity_actions(info.context.viewer),
            )

        return await guarded(run)

    @strawberry.field(description="Databases, the worker and its jobs, the queue, and recent errors.")
    async def system_status(self, info: Info[Context, None]) -> SystemStatusResult:
        async def run() -> SystemStatus:
            service.require_admin(info.context.viewer)
            s = await system.status()
            return SystemStatus(
                mongo=s.mongo,
                redis=s.redis,
                worker_running=s.worker_running,
                worker_seen_at=s.worker_seen_at,
                queue_length=s.queue_length,
                failed_emails_today=s.failed_emails_today,
                requests_last_hour=s.requests_last_hour,
                errors_last_hour=s.errors_last_hour,
                jobs=[JobRun(name=j.name, at=j.at, ok=j.ok, result=j.result) for j in s.jobs],
            )

        return await guarded(run)


@strawberry.type
class AdminMutation:
    @strawberry.mutation(description="Sign the organizer out everywhere and hide their conferences until restored.")
    async def suspend_organizer(self, info: Info[Context, None], id: strawberry.ID) -> AdminOrganizerResult:
        async def run() -> AdminOrganizer:
            o = await service.suspend(info.context.viewer, str(id))
            return AdminOrganizer(organizer=Organizer.from_doc(o), suspended=o.is_suspended, conferences=0)

        return await guarded(run)

    @strawberry.mutation(description="Let the organizer sign in again and show the conferences their suspension hid.")
    async def restore_organizer(self, info: Info[Context, None], id: strawberry.ID) -> AdminOrganizerResult:
        async def run() -> AdminOrganizer:
            o = await service.restore(info.context.viewer, str(id))
            return AdminOrganizer(organizer=Organizer.from_doc(o), suspended=o.is_suspended, conferences=0)

        return await guarded(run)

    @strawberry.mutation(
        description="Delete the organizer and everything they own; attendees of upcoming events are emailed."
    )
    async def delete_organizer(self, info: Info[Context, None], id: strawberry.ID) -> RemovedResult:
        async def run() -> Removed:
            removed = await service.delete_organizer(info.context.viewer, str(id))
            return Removed(registrations=removed.get("registrations", 0), conferences=removed.get("conferences", 0))

        return await guarded(run)

    @strawberry.mutation(description="Hide a conference from the public (the organizer is told), or show it again.")
    async def set_conference_hidden(
        self, info: Info[Context, None], id: strawberry.ID, hidden: bool
    ) -> AdminConferenceResult:
        async def run() -> AdminConference:
            c = await service.set_hidden(info.context.viewer, str(id), hidden)
            return _conference_row(service.ConferenceRow(c, None))

        return await guarded(run)

    @strawberry.mutation
    async def set_contact_resolved(self, info: Info[Context, None], id: strawberry.ID, resolved: bool) -> ContactResult:
        async def run() -> ContactMessage:
            return ContactMessage.from_doc(await service.set_contact_resolved(info.context.viewer, str(id), resolved))

        return await guarded(run)

    @strawberry.mutation(description="Email a reply to whoever used the contact form, and mark the message resolved.")
    async def reply_to_contact(self, info: Info[Context, None], id: strawberry.ID, message: str) -> ContactResult:
        async def run() -> ContactMessage:
            return ContactMessage.from_doc(await service.reply_to_contact(info.context.viewer, str(id), message))

        return await guarded(run)

    @strawberry.mutation(description="An organizer writes to the admin team (10 an hour).")
    async def send_feedback(self, info: Info[Context, None], subject: str, message: str) -> FeedbackResult:
        async def run() -> FeedbackItem:
            return FeedbackItem.from_doc(await service.submit_feedback(info.context.viewer, subject, message))

        return await guarded(run)

    @strawberry.mutation(description="Answer an organizer's feedback; they get a notification and an email.")
    async def reply_to_feedback(self, info: Info[Context, None], id: strawberry.ID, reply: str) -> FeedbackResult:
        async def run() -> FeedbackItem:
            return FeedbackItem.from_doc(await service.reply_to_feedback(info.context.viewer, str(id), reply))

        return await guarded(run)

    @strawberry.mutation
    async def close_feedback(self, info: Info[Context, None], id: strawberry.ID) -> FeedbackResult:
        async def run() -> FeedbackItem:
            return FeedbackItem.from_doc(await service.close_feedback(info.context.viewer, str(id)))

        return await guarded(run)
