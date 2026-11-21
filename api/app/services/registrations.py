"""Registration rules: seats, the waitlist, holds, confirmation codes, cancelling and check-in.

Rules carried over from v2: attendees need no account; a seat is held for CONFIRM_HOLD_HOURS until the
6-digit code from the email is entered; waitlisters confirm too, and only confirmed waitlisters move up;
tickets, check-in and reminders only after confirming; duplicate check-ins are flagged.

Every change to seats runs as one MongoDB transaction (``unit_of_work.run``): the registration and the
conference counters change together or not at all, and the seat itself is taken with an atomic
conditional increment, so a conference can never be overbooked.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from beanie import PydanticObjectId
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core import codes
from app.core.errors import DomainError, ErrorCode
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.models import ActorRef, Conference, Registration
from app.models.common import Lang, utcnow
from app.models.registration import RegistrationStatus
from app.repositories import conferences as conference_repo
from app.repositories import messages, unit_of_work
from app.repositories import registrations as repo
from app.repositories.unit_of_work import Rollback, Session
from app.services import email, ratelimit
from app.services.auth import Viewer, validate

log = get_logger("registrations")
CONFIRM_PURPOSE = "confirm"
MAX_PAGE = 100

REGISTER = ratelimit.Limit("attendee_register", 10)
CONFIRM = ratelimit.Limit("attendee_confirm", 10)
RESEND = ratelimit.Limit("attendee_resend", 3)
CANCEL = ratelimit.Limit("attendee_cancel", 10)
CHECK_IN = ratelimit.Limit("check_in", 240)


class AttendeeInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    lang: Lang = "en"

    @field_validator("name", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


# ── Outcomes ─────────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Registered:
    registration: Registration


@dataclass(frozen=True)
class Waitlisted:
    registration: Registration
    position: int


@dataclass(frozen=True)
class AlreadyRegistered:
    """The ticket link was emailed again to that address; the ticket itself is never shown to whoever typed it."""

    email: str


@dataclass(frozen=True)
class ConferenceFull:
    capacity: int


RegisterOutcome = Registered | Waitlisted | AlreadyRegistered | ConferenceFull


@dataclass(frozen=True)
class CheckInOutcome:
    registration: Registration
    already: bool


class _Full(Exception):
    pass


# ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────


def _secret() -> str:
    return get_settings().secret_key.get_secret_value()


def ticket_link(registration: Registration) -> str:
    return f"{get_settings().frontend_url}/ticket/{registration.ticket_code}"


async def _conference(registration: Registration) -> Conference:
    conference = await conference_repo.by_id(registration.conference_id)
    if conference is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
    return conference


async def _send(registration: Registration, conference: Conference, kind: str, **params: object) -> None:
    await email.send(
        email.EmailMessage(
            to=registration.email,
            kind=kind,
            lang=registration.lang,
            params={
                "name": registration.name,
                "title": getattr(conference.title, registration.lang) or conference.title.en,
                "link": ticket_link(registration),
                **params,
            },
        )
    )


async def _by_ticket(code: str) -> Registration:
    registration = await repo.by_ticket(code)
    if registration is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Ticket not found")
    return registration


def _counter_deltas(status: RegistrationStatus) -> dict[str, int]:
    """What leaving `status` takes off the conference counters."""
    return {
        "held": {"registered": -1},
        "registered": {"registered": -1, "confirmed": -1},
        "waitlisted": {"waitlisted": -1},
    }.get(status, {})


# ── Registering ──────────────────────────────────────────────────────────────────────────────────────


async def register(ip: str, slug: str, **data: object) -> RegisterOutcome:
    await ratelimit.enforce(REGISTER, ip)
    body = validate(AttendeeInput, **data)
    conference = await conference_repo.by_slug(slug)
    if conference is None or conference.hidden or conference.status not in ("published", "cancelled"):
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
    if conference.status == "cancelled" or conference.ends_at < datetime.now(UTC):
        raise DomainError(ErrorCode.REGISTRATION_CLOSED, "Registration for this conference is closed")
    assert conference.id is not None
    conference_id = conference.id
    address = str(body.email).lower()

    existing = await repo.active_for_email(conference_id, address)
    if existing is not None:
        await _send(existing, conference, "ticket_link")
        return AlreadyRegistered(email=address)

    settings = get_settings()
    registration_id = PydanticObjectId()
    stored, code = codes.issue(_secret(), CONFIRM_PURPOSE, str(registration_id), settings.verify_code_minutes)
    hold_until = utcnow() + timedelta(hours=conference.confirm_hold_hours)

    async def work(session: Session) -> Registration:
        if await repo.take_seat(conference_id, session):
            status: RegistrationStatus = "held"
        elif conference.waitlist_enabled:
            await repo.bump(conference_id, session, waitlisted=1)
            status = "waitlisted"
        else:
            raise _Full
        registration = Registration(
            id=registration_id,
            conference_id=conference_id,
            name=body.name,
            email=address,
            lang=body.lang,
            status=status,
            confirm=stored,
            hold_expires_at=hold_until,
        )
        return await repo.insert(registration, session)

    try:
        registration = await unit_of_work.run(work)
    except _Full:
        return ConferenceFull(capacity=conference.capacity or 0)
    except repo.AlreadyRegisteredError:
        # Two sign-ups with the same email at the same moment: one won, this one gets the link again.
        winner = await repo.active_for_email(conference_id, address)
        if winner is not None:
            await _send(winner, conference, "ticket_link")
        return AlreadyRegistered(email=address)

    kind = "confirm_seat" if registration.status == "held" else "confirm_waitlist"
    await _send(
        registration, conference, kind,
        code=code, minutes=settings.verify_code_minutes, hours=conference.confirm_hold_hours,
    )  # fmt: skip
    await messages.notify(
        [ActorRef(type="organizer", id=conference.organizer_id)],
        "new_registration" if registration.status == "held" else "new_waitlister",
        {"name": registration.name, "title": conference.title.en},
        f"/dashboard/conferences/{conference_id}/attendees",
    )
    if registration.status == "waitlisted":
        return Waitlisted(registration=registration, position=await repo.waitlist_position(registration))
    return Registered(registration=registration)


async def confirm(ip: str, ticket_code: str, code: str) -> Registration:
    """The code from the email: a held seat becomes a confirmed ticket; a waitlister may now be promoted."""
    await ratelimit.enforce(CONFIRM, ip)
    registration = await _by_ticket(ticket_code)
    if not registration.active:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration is no longer active")
    if registration.is_confirmed:
        return registration
    assert registration.id is not None
    result = codes.check(_secret(), CONFIRM_PURPOSE, str(registration.id), registration.confirm, code)
    if not result.ok:
        assert result.stored is not None
        await repo.set_fields(registration.id, {"confirm": result.stored.model_dump()})
        raise codes.wrong_code_error(result.stored)

    now = utcnow()
    confirmed = {"confirmed_at": now, "confirm": None, "hold_expires_at": None}
    conference = await _conference(registration)
    if registration.status == "held":
        registration_id = registration.id

        async def work(session: Session) -> None:
            moved = await repo.set_fields(
                registration_id, {**confirmed, "status": "registered"}, session, expect={"status": "held"}
            )
            if not moved:
                raise Rollback
            await repo.bump(registration.conference_id, session, confirmed=1)

        try:
            await unit_of_work.run(work)
        except Rollback as err:
            raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration is no longer active") from err
        updated = await repo.by_id(registration_id)
        assert updated is not None
        await _send(updated, conference, "ticket_confirmed")
        return updated

    await repo.set_fields(registration.id, confirmed, expect={"status": "waitlisted", "confirmed_at": None})
    await promote_waitlist(registration.conference_id)
    updated = await repo.by_id(registration.id)
    assert updated is not None
    return updated


async def resend_confirmation(ip: str, ticket_code: str) -> int:
    """Send a new code. Returns the seconds until another may be sent."""
    await ratelimit.enforce(RESEND, ip)
    registration = await _by_ticket(ticket_code)
    if not registration.active or registration.is_confirmed:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "There is nothing to confirm on this ticket")
    wait = codes.resend_wait(registration.confirm)
    if wait:
        return wait
    assert registration.id is not None
    settings = get_settings()
    stored, code = codes.issue(_secret(), CONFIRM_PURPOSE, str(registration.id), settings.verify_code_minutes)
    await repo.set_fields(registration.id, {"confirm": stored.model_dump()})
    conference = await _conference(registration)
    kind = "confirm_seat" if registration.status == "held" else "confirm_waitlist"
    await _send(
        registration,
        conference,
        kind,
        code=code,
        minutes=settings.verify_code_minutes,
        hours=conference.confirm_hold_hours,
    )
    return codes.RESEND_SECONDS


async def ticket(code: str) -> tuple[Registration, Conference, int | None]:
    """The ticket page: the registration, its conference and (for waitlisters) the place in the queue."""
    registration = await _by_ticket(code)
    conference = await _conference(registration)
    position = await repo.waitlist_position(registration) if registration.status == "waitlisted" else None
    return registration, conference, position


# ── Leaving and moving up ────────────────────────────────────────────────────────────────────────────


async def _leave(registration: Registration, status: RegistrationStatus, by: str | None) -> bool:
    """Move an active registration out (cancelled or released) and give its seat back, in one transaction."""
    assert registration.id is not None
    registration_id, old_status = registration.id, registration.status
    fields: dict[str, object] = {"status": status, "active": False, "hold_expires_at": None, "confirm": None}
    if status == "cancelled":
        fields.update(cancelled_at=utcnow(), cancelled_by=by)

    async def work(session: Session) -> None:
        moved = await repo.set_fields(registration_id, fields, session, expect={"status": old_status, "active": True})
        if not moved:
            raise Rollback
        await repo.bump(registration.conference_id, session, **_counter_deltas(old_status))

    try:
        await unit_of_work.run(work)
    except Rollback:
        return False
    return True


async def cancel(ip: str, ticket_code: str) -> Registration:
    await ratelimit.enforce(CANCEL, ip)
    registration = await _by_ticket(ticket_code)
    if not registration.active:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration is no longer active")
    if registration.checked_in_at is not None:
        raise DomainError(ErrorCode.INVALID_STATE, "You have already checked in")
    if not await _leave(registration, "cancelled", "attendee"):
        raise DomainError(ErrorCode.CONFLICT, "This registration just changed: reload and try again")
    if registration.has_seat:
        await promote_waitlist(registration.conference_id)
    updated = await repo.by_id(registration.id or "")
    assert updated is not None
    return updated


async def promote_waitlist(conference_id: PydanticObjectId) -> list[Registration]:
    """Give free seats to confirmed waitlisters, oldest first, one transaction each, and tell them by email."""
    promoted: list[Registration] = []
    for _ in range(10_000):  # bounded loop; ends when there is no seat or nobody waiting

        async def work(session: Session) -> Registration:
            waiting = await repo.next_confirmed_waitlister(conference_id, session)
            if waiting is None or waiting.id is None or not await repo.take_seat(conference_id, session):
                raise Rollback
            moved = await repo.set_fields(
                waiting.id, {"status": "registered", "promoted_at": utcnow()}, session, expect={"status": "waitlisted"}
            )
            if not moved:
                raise Rollback
            await repo.bump(conference_id, session, waitlisted=-1, confirmed=1)
            return waiting

        try:
            waiting = await unit_of_work.run(work)
        except Rollback:
            break
        promoted.append(waiting)
    if promoted:
        conference = await conference_repo.by_id(conference_id)
        if conference is not None:
            for registration in promoted:
                await _send(registration, conference, "promoted")
        log.info("waitlist promoted", conference_id=str(conference_id), count=len(promoted))
    return promoted


async def release_expired_holds(now: datetime | None = None) -> int:
    """Unconfirmed seats and waitlist places past their hold time are released; freed seats go to the waitlist."""
    released = 0
    touched: set[PydanticObjectId] = set()
    for registration in await repo.expired_holds(now or utcnow()):
        if await _leave(registration, "released", None):
            released += 1
            if registration.has_seat:
                touched.add(registration.conference_id)
    for conference_id in touched:
        await promote_waitlist(conference_id)
    return released


async def notify_conference_cancelled(conference: Conference) -> int:
    """Email everyone with an active registration that the conference is cancelled."""
    assert conference.id is not None
    people = await repo.active_for_conference(conference.id)
    for registration in people:
        await _send(registration, conference, "conference_cancelled")
    return len(people)


# ── Organizer: attendees and check-in ────────────────────────────────────────────────────────────────


async def _owned_conference(viewer: Viewer | None, conference_id: str) -> Conference:
    """The viewer's own conference; someone else's looks exactly like a missing one (same rule as conferences)."""
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    organizer = viewer.organizer
    if organizer is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only organizers manage attendees")
    conference = await conference_repo.by_id(conference_id)
    if conference is None or conference.organizer_id != organizer.id:
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
    return conference


async def attendees(
    viewer: Viewer | None,
    conference_id: str,
    *,
    statuses: list[RegistrationStatus] | None = None,
    q: str | None = None,
    checked_in: bool | None = None,
    first: int = 50,
    after: str | None = None,
) -> repo.AttendeePage:
    conference = await _owned_conference(viewer, conference_id)
    assert conference.id is not None
    return await repo.list_for_conference(
        conference.id,
        statuses=statuses,
        q=(q or "").strip()[:100] or None,
        checked_in=checked_in,
        first=max(1, min(first, MAX_PAGE)),
        after=after,
    )


async def _registration_in(conference: Conference, registration_id: str) -> Registration:
    registration = await repo.by_id(registration_id)
    if registration is None or registration.conference_id != conference.id:
        raise DomainError(ErrorCode.NOT_FOUND, "Attendee not found")
    return registration


async def check_in(viewer: Viewer | None, conference_id: str, code: str, gate: str = "main") -> CheckInOutcome:
    conference = await _owned_conference(viewer, conference_id)
    assert viewer is not None and conference.id is not None
    await ratelimit.enforce(CHECK_IN, str(viewer.subject.id))
    registration = await repo.by_ticket(code)
    if registration is None or registration.conference_id != conference.id:
        raise DomainError(ErrorCode.NOT_FOUND, "This ticket is not for this conference")
    if not registration.active:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration was cancelled")
    if registration.status == "waitlisted":
        raise DomainError(ErrorCode.CHECKIN_WAITLISTED, "This person is still on the waitlist")
    if registration.status == "held":
        raise DomainError(ErrorCode.CHECKIN_UNCONFIRMED, "Ask them to enter the code from their confirmation email")
    if registration.checked_in_at is not None:
        return CheckInOutcome(registration=registration, already=True)
    assert registration.id is not None
    marked = await repo.set_fields(
        registration.id,
        {"checked_in_at": utcnow(), "checked_in_by": viewer.subject.id},
        expect={"checked_in_at": None, "status": "registered"},
    )
    fresh = await repo.by_id(registration.id)
    assert fresh is not None
    if not marked:
        return CheckInOutcome(registration=fresh, already=True)
    await repo.bump(conference.id, checked_in=1)
    await repo.record_check_in(conference.id, registration.id, gate[:40] or "main")
    return CheckInOutcome(registration=fresh, already=False)


async def undo_check_in(viewer: Viewer | None, conference_id: str, registration_id: str) -> Registration:
    conference = await _owned_conference(viewer, conference_id)
    registration = await _registration_in(conference, registration_id)
    assert conference.id is not None and registration.id is not None
    if await repo.set_fields(
        registration.id, {"checked_in_at": None, "checked_in_by": None}, expect={"checked_in_at": {"$ne": None}}
    ):
        await repo.bump(conference.id, checked_in=-1)
        await repo.record_undo(conference.id, registration.id, "main")
    fresh = await repo.by_id(registration.id)
    assert fresh is not None
    return fresh


async def remove_attendee(viewer: Viewer | None, conference_id: str, registration_id: str) -> Registration:
    """The organizer cancels someone's registration; they are told by email and their seat goes to the waitlist."""
    conference = await _owned_conference(viewer, conference_id)
    registration = await _registration_in(conference, registration_id)
    if not registration.active:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration is not active")
    if registration.checked_in_at is not None:
        raise DomainError(ErrorCode.INVALID_STATE, "Undo the check-in first")
    if not await _leave(registration, "cancelled", "organizer"):
        raise DomainError(ErrorCode.CONFLICT, "This registration just changed: reload and try again")
    await _send(registration, conference, "removed_by_organizer")
    if registration.has_seat and conference.id is not None:
        await promote_waitlist(conference.id)
    fresh = await repo.by_id(registration_id)
    assert fresh is not None
    return fresh


async def recount(conference_id: PydanticObjectId) -> dict[str, int]:
    """Compare the counters with the registrations; fix and report any drift (nightly self-check)."""
    actual = await repo.counts_by_status(conference_id)
    conference = await conference_repo.by_id(conference_id)
    if conference is None:
        return {}
    stored = conference.counters.model_dump()
    drift = {k: actual[k] - stored.get(k, 0) for k in actual if actual[k] != stored.get(k, 0)}
    if drift:
        await repo.bump(conference_id, **drift)
        log.warning("counter drift fixed", conference_id=str(conference_id), drift=drift)
    return drift
