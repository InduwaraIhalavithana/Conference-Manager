"""A conference is one MongoDB document (the aggregate): its days, tracks, speakers and sessions live inside it,
because they are always read and edited together. Registrations are a separate collection (Phase 3)."""

import secrets
from datetime import date, datetime
from typing import Annotated, Literal

from beanie import Document, Indexed, PydanticObjectId
from pydantic import BaseModel, Field
from pymongo import ASCENDING, GEOSPHERE, TEXT, IndexModel

from app.models.common import Lang, LocalizedText, utcnow

Status = Literal["draft", "published", "cancelled", "archived"]
Category = Literal["tech", "health", "education", "business", "science", "arts", "other"]
SessionKind = Literal["keynote", "talk", "workshop", "panel", "break"]

CATEGORIES: tuple[Category, ...] = ("tech", "health", "education", "business", "science", "arts", "other")
SESSION_KINDS: tuple[SessionKind, ...] = ("keynote", "talk", "workshop", "panel", "break")


def new_sub_id() -> str:
    """Ids for tracks, speakers and sessions inside a conference: short, random, URL-safe."""
    return secrets.token_hex(6)


class GeoPoint(BaseModel):
    """GeoJSON point, as the 2dsphere index expects: coordinates are [longitude, latitude]."""

    type: Literal["Point"] = "Point"
    coordinates: tuple[float, float]

    @property
    def lng(self) -> float:
        return self.coordinates[0]

    @property
    def lat(self) -> float:
        return self.coordinates[1]


class Venue(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    location: GeoPoint | None = None


class ConferenceDay(BaseModel):
    date: date
    label: LocalizedText | None = None


class Track(BaseModel):
    id: str = Field(default_factory=new_sub_id)
    name: LocalizedText
    color: str = "#0ea5e9"


class Speaker(BaseModel):
    id: str = Field(default_factory=new_sub_id)
    name: str
    job_title: str | None = None
    organization: str | None = None
    bio: LocalizedText | None = None
    photo_url: str | None = None
    links: list[str] = Field(default_factory=list)


class AgendaSession(BaseModel):
    id: str = Field(default_factory=new_sub_id)
    day: date
    track_id: str | None = None
    title: LocalizedText
    description: LocalizedText | None = None
    kind: SessionKind = "talk"
    starts_at: datetime
    ends_at: datetime
    room: str | None = None
    speaker_ids: list[str] = Field(default_factory=list)
    capacity: int | None = None


class Counters(BaseModel):
    """Kept up to date atomically by the registration service (Phase 3)."""

    registered: int = 0
    confirmed: int = 0
    waitlisted: int = 0
    checked_in: int = 0


class Conference(Document):
    organizer_id: PydanticObjectId
    slug: Annotated[str, Indexed(unique=True)]
    status: Status = "draft"
    # Set by an admin; hidden conferences never appear publicly (e.g. a suspended organizer's events).
    hidden: bool = False
    # Why: "admin" (hidden by hand) or "suspended" (its organizer was suspended; undone on restore).
    hidden_reason: Literal["admin", "suspended"] | None = None

    title: LocalizedText
    summary: LocalizedText | None = None
    description: LocalizedText | None = None
    source_lang: Lang = "en"
    category: Category = "other"
    tags: list[str] = Field(default_factory=list)
    cover_url: str | None = None

    venue: Venue = Field(default_factory=Venue)
    online_url: str | None = None
    timezone: str = "Asia/Colombo"
    starts_at: datetime
    ends_at: datetime
    days: list[ConferenceDay] = Field(default_factory=list)

    tracks: list[Track] = Field(default_factory=list)
    speakers: list[Speaker] = Field(default_factory=list)
    sessions: list[AgendaSession] = Field(default_factory=list)

    capacity: int | None = None
    waitlist_enabled: bool = True
    confirm_hold_hours: int = 24
    counters: Counters = Field(default_factory=Counters)

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
    published_at: datetime | None = None
    cancelled_at: datetime | None = None
    # Set by the reminder job (atomic update), never by a conference save.
    reminders_sent_at: datetime | None = None

    class Settings:
        name = "conferences"
        # Optimistic concurrency: a save fails if someone else saved the document since it was read.
        use_revision = True
        indexes = [
            IndexModel([("status", ASCENDING), ("hidden", ASCENDING), ("starts_at", ASCENDING)]),
            IndexModel([("organizer_id", ASCENDING), ("starts_at", ASCENDING)]),
            IndexModel([("venue.location", GEOSPHERE)]),
            IndexModel(
                [
                    ("title.en", TEXT),
                    ("title.si", TEXT),
                    ("title.ta", TEXT),
                    ("summary.en", TEXT),
                    ("summary.si", TEXT),
                    ("summary.ta", TEXT),
                    ("tags", TEXT),
                    ("venue.city", TEXT),
                ],
                # No stemming: English rules would mangle Sinhala and Tamil words.
                default_language="none",
                weights={"title.en": 10, "title.si": 10, "title.ta": 10, "tags": 5, "venue.city": 3},
                name="conference_text",
            ),
        ]

    def speaker(self, speaker_id: str) -> Speaker | None:
        return next((s for s in self.speakers if s.id == speaker_id), None)

    def track(self, track_id: str) -> Track | None:
        return next((t for t in self.tracks if t.id == track_id), None)

    def session(self, session_id: str) -> AgendaSession | None:
        return next((s for s in self.sessions if s.id == session_id), None)
