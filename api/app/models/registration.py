"""Registrations (one per person per conference) and check-in events (a time-series collection).

Status life cycle:
    held        has a seat, waiting for the emailed code (released after the hold time)
    registered  has a seat and confirmed: gets the ticket, check-in and reminders
    waitlisted  no seat yet; once confirmed, moves up automatically when a seat frees
    cancelled   by the attendee or the organizer
    released    the hold ran out before the code was entered
"""

import secrets
from datetime import datetime
from typing import Annotated, Literal

from beanie import Document, Granularity, Indexed, PydanticObjectId, TimeSeriesConfig
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel

from app.core.codes import EmailCode
from app.models.common import Lang, utcnow

RegistrationStatus = Literal["held", "registered", "waitlisted", "cancelled", "released"]
ACTIVE_STATUSES: tuple[RegistrationStatus, ...] = ("held", "registered", "waitlisted")

# No 0/O, 1/I/L: ticket codes are sometimes typed in by hand at the check-in desk.
TICKET_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def new_ticket_code() -> str:
    """12 characters from a 31-letter alphabet: about 7.9 x 10^17 possibilities, so codes cannot be guessed."""
    return "".join(secrets.choice(TICKET_ALPHABET) for _ in range(12))


class Registration(Document):
    conference_id: PydanticObjectId
    name: str
    email: str  # lower-case
    lang: Lang = "en"
    status: RegistrationStatus
    # True while held, registered or waitlisted: one active registration per email per conference.
    active: bool = True
    ticket_code: Annotated[str, Indexed(unique=True)] = Field(default_factory=new_ticket_code)
    confirm: EmailCode | None = None
    confirmed_at: datetime | None = None
    hold_expires_at: datetime | None = None
    promoted_at: datetime | None = None
    checked_in_at: datetime | None = None
    checked_in_by: PydanticObjectId | None = None
    reminder_sent_at: datetime | None = None
    # Sessions the attendee saved on their ticket page, and when the after-the-event feedback email went out.
    bookmarked_session_ids: list[str] = Field(default_factory=list)
    feedback_requested_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by: Literal["attendee", "organizer", "system"] | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "registrations"
        indexes = [
            IndexModel(
                [("conference_id", ASCENDING), ("email", ASCENDING)],
                unique=True,
                partialFilterExpression={"active": True},
                name="one_active_registration_per_email",
            ),
            IndexModel([("conference_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)]),
            IndexModel([("status", ASCENDING), ("hold_expires_at", ASCENDING)]),
        ]

    @property
    def has_seat(self) -> bool:
        return self.status in ("held", "registered")

    @property
    def is_confirmed(self) -> bool:
        return self.confirmed_at is not None


class CheckInMeta(BaseModel):
    conference_id: PydanticObjectId
    gate: str = "main"


class CheckInEvent(Document):
    """One row per arrival, stored in a MongoDB time-series collection (bucketed by minute) for arrival curves."""

    at: datetime = Field(default_factory=utcnow)
    meta: CheckInMeta
    registration_id: PydanticObjectId
    undone: bool = False

    class Settings:
        name = "checkin_events"
        timeseries = TimeSeriesConfig(time_field="at", meta_field="meta", granularity=Granularity.minutes)
