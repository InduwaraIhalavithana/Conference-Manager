"""Registration, ticket and check-in queries and mutations. Thin: the rules are in app.services.registrations."""

from datetime import datetime
from enum import Enum
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api.graphql.conferences import Conference, Lang, PageInfo
from app.api.graphql.context import Context
from app.api.graphql.types import UserError, guarded
from app.models import Conference as ConferenceDoc
from app.models import Registration as RegistrationDoc
from app.models import SessionRating as SessionRatingDoc
from app.services import feedback as feedback_service
from app.services import registrations as service


@strawberry.enum
class RegistrationStatus(Enum):
    HELD = "held"
    REGISTERED = "registered"
    WAITLISTED = "waitlisted"
    CANCELLED = "cancelled"
    RELEASED = "released"


@strawberry.type(description="One of the ticket holder's ratings: a session, or the conference when sessionId is null.")
class MyRating:
    session_id: strawberry.ID | None
    score: int
    comment: str | None
    updated_at: datetime

    @classmethod
    def from_doc(cls, doc: SessionRatingDoc) -> "MyRating":
        return cls(
            session_id=strawberry.ID(doc.session_id) if doc.session_id else None,
            score=doc.score,
            comment=doc.comment,
            updated_at=doc.updated_at,
        )


@strawberry.type(description="What the ticket holder sees, by the code from their email.")
class Ticket:
    code: str
    name: str
    email: str
    lang: Lang
    status: RegistrationStatus
    confirmed: bool
    hold_expires_at: datetime | None
    waitlist_position: int | None
    checked_in_at: datetime | None
    created_at: datetime
    conference: Conference
    bookmarked_session_ids: list[strawberry.ID]
    ratings: list[MyRating]
    feedback_closes_at: datetime = strawberry.field(
        description="Ratings can be given (by checked-in attendees) until this time."
    )

    @classmethod
    def build(
        cls, doc: RegistrationDoc, conference: ConferenceDoc, position: int | None, ratings: list[SessionRatingDoc]
    ) -> "Ticket":
        return cls(
            code=doc.ticket_code,
            name=doc.name,
            email=doc.email,
            lang=Lang(doc.lang),
            status=RegistrationStatus(doc.status),
            confirmed=doc.is_confirmed,
            hold_expires_at=doc.hold_expires_at,
            waitlist_position=position,
            checked_in_at=doc.checked_in_at,
            created_at=doc.created_at,
            conference=Conference.from_doc(conference),
            bookmarked_session_ids=[strawberry.ID(s) for s in doc.bookmarked_session_ids],
            ratings=[MyRating.from_doc(r) for r in ratings],
            feedback_closes_at=feedback_service.closes_at(conference),
        )


@strawberry.type(description="An attendee as the conference's organizer sees them.")
class Attendee:
    id: strawberry.ID
    name: str
    email: str
    lang: Lang
    status: RegistrationStatus
    ticket_code: str
    confirmed_at: datetime | None
    promoted_at: datetime | None
    checked_in_at: datetime | None
    cancelled_at: datetime | None
    cancelled_by: str | None
    created_at: datetime

    @classmethod
    def from_doc(cls, doc: RegistrationDoc) -> "Attendee":
        return cls(
            id=strawberry.ID(str(doc.id)),
            name=doc.name,
            email=doc.email,
            lang=Lang(doc.lang),
            status=RegistrationStatus(doc.status),
            ticket_code=doc.ticket_code,
            confirmed_at=doc.confirmed_at,
            promoted_at=doc.promoted_at,
            checked_in_at=doc.checked_in_at,
            cancelled_at=doc.cancelled_at,
            cancelled_by=doc.cancelled_by,
            created_at=doc.created_at,
        )


@strawberry.type(description="A seat is held; enter the emailed code before it is released.")
class Registered:
    ticket_code: str
    hold_expires_at: datetime | None


@strawberry.type(description="The conference is full; this person is on the waitlist.")
class Waitlisted:
    ticket_code: str
    position: int


@strawberry.type(description="This email already has a registration; the ticket link was emailed to it again.")
class AlreadyRegistered:
    email: str


@strawberry.type
class ConferenceFull:
    capacity: int


@strawberry.type
class ConfirmationSent:
    resend_after_seconds: int


@strawberry.type
class CheckedIn:
    attendee: Attendee


@strawberry.type(description="This ticket was already used: show when, so the desk can spot a copied ticket.")
class AlreadyCheckedIn:
    attendee: Attendee
    checked_in_at: datetime


@strawberry.type
class RemindersSent:
    count: int


@strawberry.type
class AttendeeEdge:
    cursor: str
    node: Attendee


@strawberry.type
class AttendeeConnection:
    edges: list[AttendeeEdge]
    page_info: PageInfo
    total_count: int


RegisterResult = Annotated[
    Registered | Waitlisted | AlreadyRegistered | ConferenceFull | UserError, strawberry.union("RegisterResult")
]
TicketResult = Annotated[Ticket | UserError, strawberry.union("TicketResult")]
ConfirmationResult = Annotated[ConfirmationSent | UserError, strawberry.union("ConfirmationResult")]
AttendeesResult = Annotated[AttendeeConnection | UserError, strawberry.union("AttendeesResult")]
AttendeeResult = Annotated[Attendee | UserError, strawberry.union("AttendeeResult")]
CheckInResult = Annotated[CheckedIn | AlreadyCheckedIn | UserError, strawberry.union("CheckInResult")]
RemindersResult = Annotated[RemindersSent | UserError, strawberry.union("RemindersResult")]


@strawberry.input
class AttendeeInput:
    name: str
    email: str
    lang: Lang = Lang.EN


@strawberry.input
class AttendeeFilter:
    statuses: list[RegistrationStatus] | None = None
    q: str | None = None
    checked_in: bool | None = None


async def ticket_by_code(code: str) -> Ticket:
    registration, conference, position = await service.ticket(code)
    return Ticket.build(registration, conference, position, await feedback_service.ratings_for(registration))


@strawberry.type
class RegistrationQuery:
    @strawberry.field(description="A ticket by the code from the email (the code is the only key to it).")
    async def ticket(self, code: str) -> Ticket | None:
        result = await guarded(lambda: ticket_by_code(code))
        return result if isinstance(result, Ticket) else None

    @strawberry.field(description="The attendees of one of the signed-in organizer's conferences.")
    async def attendees(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        filter: AttendeeFilter | None = None,
        first: int = 50,
        after: str | None = None,
    ) -> AttendeesResult:
        f = filter or AttendeeFilter()

        async def run() -> AttendeeConnection:
            page = await service.attendees(
                info.context.viewer, str(conference_id),
                statuses=[s.value for s in f.statuses] if f.statuses else None,
                q=f.q, checked_in=f.checked_in, first=first, after=after,
            )  # fmt: skip
            return AttendeeConnection(
                edges=[
                    AttendeeEdge(cursor=c, node=Attendee.from_doc(d))
                    for d, c in zip(page.items, page.cursors, strict=True)
                ],
                page_info=PageInfo(has_next_page=page.has_next, end_cursor=page.end_cursor),
                total_count=page.total,
            )

        return await guarded(run)


@strawberry.type
class RegistrationMutation:
    @strawberry.mutation(description="Register for a conference (no account needed). Emails a 6-digit code.")
    async def register_for_conference(
        self, info: Info[Context, None], slug: str, input: AttendeeInput
    ) -> RegisterResult:
        async def run() -> Registered | Waitlisted | AlreadyRegistered | ConferenceFull:
            outcome = await service.register(
                info.context.ip, slug, name=input.name, email=input.email, lang=input.lang.value
            )
            match outcome:
                case service.Registered(registration=r):
                    return Registered(ticket_code=r.ticket_code, hold_expires_at=r.hold_expires_at)
                case service.Waitlisted(registration=r, position=p):
                    return Waitlisted(ticket_code=r.ticket_code, position=p)
                case service.AlreadyRegistered(email=e):
                    return AlreadyRegistered(email=e)
                case service.ConferenceFull(capacity=c):
                    return ConferenceFull(capacity=c)

        return await guarded(run)

    @strawberry.mutation(description="Enter the emailed code: confirms the seat (or the waitlist place).")
    async def confirm_registration(self, info: Info[Context, None], ticket_code: str, code: str) -> TicketResult:
        async def run() -> Ticket:
            registration = await service.confirm(info.context.ip, ticket_code, code)
            return await ticket_by_code(registration.ticket_code)

        return await guarded(run)

    @strawberry.mutation(description="Email a new confirmation code (once a minute).")
    async def resend_confirmation(self, info: Info[Context, None], ticket_code: str) -> ConfirmationResult:
        async def run() -> ConfirmationSent:
            return ConfirmationSent(
                resend_after_seconds=await service.resend_confirmation(info.context.ip, ticket_code)
            )

        return await guarded(run)

    @strawberry.mutation(description="Cancel by ticket code; the seat goes to the next confirmed waitlister.")
    async def cancel_registration(self, info: Info[Context, None], ticket_code: str) -> TicketResult:
        async def run() -> Ticket:
            registration = await service.cancel(info.context.ip, ticket_code)
            return await ticket_by_code(registration.ticket_code)

        return await guarded(run)

    @strawberry.mutation(
        description="Check someone in by the code on their ticket (QR or typed). An offline desk sends `scannedAt` "
        "when it syncs (ignored if in the future or over a day old)."
    )
    async def check_in(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        code: str,
        gate: str = "main",
        scanned_at: datetime | None = None,
    ) -> CheckInResult:
        async def run() -> CheckedIn | AlreadyCheckedIn:
            outcome = await service.check_in(info.context.viewer, str(conference_id), code, gate, scanned_at)
            attendee = Attendee.from_doc(outcome.registration)
            if outcome.already and outcome.registration.checked_in_at is not None:
                return AlreadyCheckedIn(attendee=attendee, checked_in_at=outcome.registration.checked_in_at)
            return CheckedIn(attendee=attendee)

        return await guarded(run)

    @strawberry.mutation
    async def undo_check_in(
        self, info: Info[Context, None], conference_id: strawberry.ID, attendee_id: strawberry.ID
    ) -> AttendeeResult:
        async def run() -> Attendee:
            doc = await service.undo_check_in(info.context.viewer, str(conference_id), str(attendee_id))
            return Attendee.from_doc(doc)

        return await guarded(run)

    @strawberry.mutation(description="Cancel someone's registration as the organizer; they are told by email.")
    async def remove_attendee(
        self, info: Info[Context, None], conference_id: strawberry.ID, attendee_id: strawberry.ID
    ) -> AttendeeResult:
        async def run() -> Attendee:
            doc = await service.remove_attendee(info.context.viewer, str(conference_id), str(attendee_id))
            return Attendee.from_doc(doc)

        return await guarded(run)

    @strawberry.mutation(description="Email the day-before reminder now to confirmed attendees who have not had it.")
    async def send_reminders_now(self, info: Info[Context, None], conference_id: strawberry.ID) -> RemindersResult:
        async def run() -> RemindersSent:
            return RemindersSent(count=await service.send_reminders_now(info.context.viewer, str(conference_id)))

        return await guarded(run)
