"""Conference rules: who may create and change a conference, what makes it publishable, and how its agenda
(days, tracks, speakers, sessions) stays consistent. Independent of GraphQL and HTTP.

Rules carried over from v2: titles up to 255 characters, descriptions up to 5000, capacity 1-100 000,
seven categories, five session kinds, sessions end after they start, no new conferences in the past.
New in v3: multi-day events (up to 14 days), tracks, several speakers per session, text in three
languages, no two sessions in the same room at the same time, and optimistic locking against lost edits.
"""

import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from beanie import PydanticObjectId
from pydantic import AfterValidator, BaseModel, Field, field_validator, model_validator

from app.core.errors import DomainError, ErrorCode
from app.models import ActorRef, Conference, Organizer
from app.models.common import Lang, LocalizedText, utcnow
from app.models.conference import (
    AgendaSession,
    Category,
    ConferenceDay,
    GeoPoint,
    SessionKind,
    Speaker,
    Track,
    Venue,
    new_sub_id,
)
from app.repositories import accounts, conference_search, messages
from app.repositories import conferences as repo
from app.services import registrations, uploads
from app.services.auth import Viewer, validate

MAX_DAYS = 14
MAX_PAGE = 50
MAX_TRACKS = 12
MAX_SPEAKERS = 200
MAX_SESSIONS = 400


# ── Inputs ───────────────────────────────────────────────────────────────────────────────────────────


def _clean(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _http_url(value: str | None) -> str | None:
    if value is not None and not re.match(r"^https?://[^\s]{3,}$", value):
        raise ValueError("must be a web address starting with http:// or https://")
    return value


HttpUrl = Annotated[str | None, AfterValidator(_http_url)]


def _utc_with_offset(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("include a time zone offset, e.g. 2027-02-12T09:00:00+05:30")
    return value.astimezone(UTC)


def _texts(max_length: int, required: bool) -> type[BaseModel]:
    class Texts(BaseModel):
        en: str | None = Field(default=None, max_length=max_length)
        si: str | None = Field(default=None, max_length=max_length)
        ta: str | None = Field(default=None, max_length=max_length)

        _clean = field_validator("en", "si", "ta", mode="before")(_clean)

        @model_validator(mode="after")
        def english_present(self) -> "Texts":
            if required and not self.en:
                raise ValueError("an English version is required")
            if not required and not self.en and (self.si or self.ta):
                raise ValueError("add the English version too")
            return self

    return Texts


TitleIn = _texts(255, required=True)
SummaryIn = _texts(500, required=False)
DescriptionIn = _texts(5000, required=False)
BioIn = _texts(2000, required=False)
LabelIn = _texts(80, required=False)


def to_localized(texts: BaseModel | None) -> LocalizedText | None:
    if texts is None:
        return None
    data = texts.model_dump()
    return LocalizedText(**data) if data.get("en") else None


class ConferenceInput(BaseModel):
    title: TitleIn  # type: ignore[valid-type]
    summary: SummaryIn | None = None  # type: ignore[valid-type]
    description: DescriptionIn | None = None  # type: ignore[valid-type]
    source_lang: Lang = "en"
    category: Category = "other"
    tags: list[Annotated[str, Field(min_length=1, max_length=30)]] = Field(default_factory=list, max_length=10)
    venue_name: str | None = Field(default=None, max_length=160)
    venue_address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=80)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    online_url: HttpUrl = None
    timezone: str = "Asia/Colombo"
    starts_at: datetime
    ends_at: datetime
    capacity: int | None = Field(default=None, ge=1, le=100_000)
    waitlist_enabled: bool = True
    cover_url: str | None = None

    _clean = field_validator("venue_name", "venue_address", "city", "online_url", "cover_url", mode="before")(_clean)

    @field_validator("tags", mode="before")
    @classmethod
    def clean_tags(cls, value: object) -> object:
        if isinstance(value, list):
            seen: list[str] = []
            for tag in value:
                text = str(tag).strip().lower()
                if text and text not in seen:
                    seen.append(text)
            return seen
        return value

    @field_validator("timezone")
    @classmethod
    def known_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as err:
            raise ValueError("unknown time zone") from err
        return value

    _offset = field_validator("starts_at", "ends_at")(_utc_with_offset)

    @model_validator(mode="after")
    def consistent(self) -> "ConferenceInput":
        if self.ends_at <= self.starts_at:
            raise ValueError("the end must be after the start")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("give both latitude and longitude, or neither")
        return self


class TrackInput(BaseModel):
    name: TitleIn  # type: ignore[valid-type]
    color: str = Field(default="#0ea5e9", pattern=r"^#[0-9a-fA-F]{6}$")


class SpeakerInput(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    job_title: str | None = Field(default=None, max_length=160)
    organization: str | None = Field(default=None, max_length=160)
    bio: BioIn | None = None  # type: ignore[valid-type]
    photo_url: str | None = None
    links: list[Annotated[str, AfterValidator(_http_url)]] = Field(default_factory=list, max_length=5)

    _clean = field_validator("name", "job_title", "organization", "photo_url", mode="before")(_clean)


class SessionInput(BaseModel):
    title: TitleIn  # type: ignore[valid-type]
    description: DescriptionIn | None = None  # type: ignore[valid-type]
    kind: SessionKind = "talk"
    starts_at: datetime
    ends_at: datetime
    room: str | None = Field(default=None, max_length=120)
    track_id: str | None = None
    speaker_ids: list[str] = Field(default_factory=list, max_length=10)
    capacity: int | None = Field(default=None, ge=1, le=100_000)

    _clean = field_validator("room", "track_id", mode="before")(_clean)
    _offset = field_validator("starts_at", "ends_at")(_utc_with_offset)

    @model_validator(mode="after")
    def ends_after_start(self) -> "SessionInput":
        if self.ends_at <= self.starts_at:
            raise ValueError("the session must end after it starts")
        return self


# ── Helpers ──────────────────────────────────────────────────────────────────────────────────────────


def _not_found() -> DomainError:
    return DomainError(ErrorCode.NOT_FOUND, "Conference not found")


def _require_organizer(viewer: Viewer | None) -> PydanticObjectId:
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    organizer = viewer.organizer
    if organizer is None or organizer.id is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only organizers can manage conferences")
    return organizer.id


async def _owned(viewer: Viewer | None, conference_id: str) -> Conference:
    """The viewer's own conference. Someone else's looks exactly like a missing one (no existence leak)."""
    owner_id = _require_organizer(viewer)
    conference = await repo.by_id(conference_id)
    if conference is None or conference.organizer_id != owner_id:
        raise _not_found()
    return conference


async def _save(conference: Conference) -> Conference:
    try:
        await repo.save(conference)
    except repo.StaleWriteError as err:
        raise DomainError(ErrorCode.CONFLICT, "This conference was changed elsewhere: reload and try again") from err
    return conference


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    return slug[:60].strip("-") or "conference"


async def _unique_slug(title: str) -> str:
    base = slugify(title)
    for _ in range(10):
        candidate = f"{base}-{PydanticObjectId().__str__()[-5:]}"
        if not await repo.slug_exists(candidate):
            return candidate
    raise DomainError(ErrorCode.CONFLICT, "Could not create a web address for this conference: try again")


def _local_dates(starts_at: datetime, ends_at: datetime, tz: str) -> list[date]:
    zone = ZoneInfo(tz)
    first = starts_at.astimezone(zone).date()
    last = ends_at.astimezone(zone).date()
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]


def _apply(conference: Conference, body: ConferenceInput) -> None:
    dates = _local_dates(body.starts_at, body.ends_at, body.timezone)
    if len(dates) > MAX_DAYS:
        raise DomainError(ErrorCode.VALIDATION, f"A conference can last at most {MAX_DAYS} days", field="endsAt")
    outside = [s for s in conference.sessions if s.day not in dates]
    if outside:
        raise DomainError(
            ErrorCode.VALIDATION,
            "Some sessions fall outside the new dates: move or remove them first",
            field="startsAt",
        )
    labels = {d.date: d.label for d in conference.days}
    conference.days = [ConferenceDay(date=d, label=labels.get(d)) for d in dates]
    conference.title = to_localized(body.title) or conference.title
    conference.summary = to_localized(body.summary)
    conference.description = to_localized(body.description)
    conference.source_lang = body.source_lang
    conference.category = body.category
    conference.tags = body.tags
    location = GeoPoint(coordinates=(body.longitude, body.latitude)) if body.latitude is not None else None
    conference.venue = Venue(name=body.venue_name, address=body.venue_address, city=body.city, location=location)
    conference.online_url = body.online_url
    conference.timezone = body.timezone
    conference.starts_at = body.starts_at
    conference.ends_at = body.ends_at
    conference.capacity = body.capacity
    conference.waitlist_enabled = body.waitlist_enabled


def _check_session(conference: Conference, session: AgendaSession) -> None:
    if session.day not in {d.date for d in conference.days}:
        raise DomainError(ErrorCode.VALIDATION, "The session must be on one of the conference days", field="startsAt")
    if session.track_id and conference.track(session.track_id) is None:
        raise DomainError(ErrorCode.VALIDATION, "That track does not exist", field="trackId")
    unknown = [sid for sid in session.speaker_ids if conference.speaker(sid) is None]
    if unknown:
        raise DomainError(ErrorCode.VALIDATION, "One of the speakers does not exist", field="speakerIds")
    if session.room:
        room = session.room.casefold()
        for other in conference.sessions:
            if (
                other.id != session.id
                and other.room
                and other.room.casefold() == room
                and other.starts_at < session.ends_at
                and session.starts_at < other.ends_at
            ):
                raise DomainError(
                    ErrorCode.SESSION_CLASH,
                    f"{other.room} is already booked then for “{other.title.en}”",
                    field="room",
                )


async def _log(viewer: Viewer, action: str, conference: Conference) -> None:
    await messages.log_activity(ActorRef(type="organizer", id=viewer.subject.id), action, conference.title.en)


# ── Organizer: the conference itself ─────────────────────────────────────────────────────────────────


async def create(viewer: Viewer | None, **data: object) -> Conference:
    owner_id = _require_organizer(viewer)
    assert viewer is not None
    body = validate(ConferenceInput, **data)
    if body.starts_at < datetime.now(UTC):
        raise DomainError(ErrorCode.VALIDATION, "A new conference cannot start in the past", field="startsAt")
    if body.cover_url:
        uploads.require_own_upload(body.cover_url, "cover")
    title = to_localized(body.title)
    assert title is not None
    conference = Conference(
        organizer_id=owner_id,
        slug=await _unique_slug(title.en),
        title=title,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        cover_url=body.cover_url,
    )
    _apply(conference, body)
    await repo.insert(conference)
    await _log(viewer, "conference_created", conference)
    return conference


async def update(viewer: Viewer | None, conference_id: str, **data: object) -> Conference:
    conference = await _owned(viewer, conference_id)
    assert viewer is not None
    body = validate(ConferenceInput, **data)
    if conference.status in ("cancelled", "archived"):
        raise DomainError(ErrorCode.INVALID_STATE, "A cancelled or archived conference cannot be edited")
    if body.starts_at != conference.starts_at and body.starts_at < datetime.now(UTC):
        raise DomainError(ErrorCode.VALIDATION, "A conference cannot be moved into the past", field="startsAt")
    taken = conference.counters.registered
    if body.capacity is not None and body.capacity < taken:
        raise DomainError(
            ErrorCode.CAPACITY_BELOW_TAKEN, f"{taken} people already have seats", field="capacity", taken=taken
        )
    old_cover = conference.cover_url
    old_capacity = conference.capacity
    if body.cover_url and body.cover_url != old_cover:
        uploads.require_own_upload(body.cover_url, "cover")
    _apply(conference, body)
    conference.cover_url = body.cover_url
    await _save(conference)
    if old_cover and old_cover != conference.cover_url:
        await uploads.discard_if_unused(old_cover)
    more_seats = conference.capacity is None or (old_capacity is not None and conference.capacity > old_capacity)
    if more_seats and conference.id is not None:
        await registrations.promote_waitlist(conference.id)
    await _log(viewer, "conference_updated", conference)
    return conference


def publish_problems(conference: Conference) -> list[str]:
    problems = []
    if conference.starts_at < datetime.now(UTC):
        problems.append("the start date is in the past")
    if not conference.venue.city and not conference.online_url:
        problems.append("add a city or an online link")
    if conference.capacity is None:
        problems.append("set how many people can attend")
    return problems


async def publish(viewer: Viewer | None, conference_id: str) -> Conference:
    conference = await _owned(viewer, conference_id)
    assert viewer is not None
    if conference.status != "draft":
        raise DomainError(ErrorCode.INVALID_STATE, "Only a draft can be published")
    problems = publish_problems(conference)
    if problems:
        raise DomainError(ErrorCode.NOT_PUBLISHABLE, "Before publishing: " + "; ".join(problems))
    conference.status = "published"
    conference.published_at = conference.published_at or utcnow()
    await _save(conference)
    await _log(viewer, "conference_published", conference)
    return conference


async def unpublish(viewer: Viewer | None, conference_id: str) -> Conference:
    conference = await _owned(viewer, conference_id)
    assert viewer is not None
    if conference.status != "published":
        raise DomainError(ErrorCode.INVALID_STATE, "Only a published conference can go back to draft")
    if conference.counters.registered or conference.counters.waitlisted:
        raise DomainError(ErrorCode.INVALID_STATE, "People have registered: cancel the conference instead")
    conference.status = "draft"
    await _save(conference)
    await _log(viewer, "conference_unpublished", conference)
    return conference


async def cancel(viewer: Viewer | None, conference_id: str) -> Conference:
    """Cancelled conferences stay visible (marked as cancelled) so registered people can see what happened."""
    conference = await _owned(viewer, conference_id)
    assert viewer is not None
    if conference.status != "published":
        raise DomainError(ErrorCode.INVALID_STATE, "Only a published conference can be cancelled")
    conference.status = "cancelled"
    conference.cancelled_at = utcnow()
    await _save(conference)
    await registrations.notify_conference_cancelled(conference)
    await _log(viewer, "conference_cancelled", conference)
    return conference


async def delete(viewer: Viewer | None, conference_id: str) -> None:
    conference = await _owned(viewer, conference_id)
    assert viewer is not None
    if conference.counters.registered or conference.counters.waitlisted:
        raise DomainError(ErrorCode.INVALID_STATE, "People have registered: cancel the conference instead")
    files = [conference.cover_url, *(s.photo_url for s in conference.speakers)]
    await repo.delete(conference)
    for url in files:
        if url:
            await uploads.discard_if_unused(url)
    await _log(viewer, "conference_deleted", conference)


async def duplicate(viewer: Viewer | None, conference_id: str) -> Conference:
    """A draft copy with the same details and agenda; images are copied so each conference owns its files."""
    source = await _owned(viewer, conference_id)
    assert viewer is not None
    data = source.model_dump(
        exclude={
            "id",
            "revision_id",
            "slug",
            "status",
            "counters",
            "published_at",
            "cancelled_at",
            "created_at",
            "updated_at",
        }
    )
    copy = Conference(**data, slug=await _unique_slug(source.title.en), status="draft")
    copy.cover_url = await uploads.copy_upload(source.cover_url)
    for speaker in copy.speakers:
        speaker.photo_url = await uploads.copy_upload(speaker.photo_url)
    await repo.insert(copy)
    await _log(viewer, "conference_duplicated", copy)
    return copy


# ── Organizer: agenda ────────────────────────────────────────────────────────────────────────────────


async def _editable(viewer: Viewer | None, conference_id: str) -> Conference:
    conference = await _owned(viewer, conference_id)
    if conference.status in ("cancelled", "archived"):
        raise DomainError(ErrorCode.INVALID_STATE, "A cancelled or archived conference cannot be edited")
    return conference


async def upsert_track(viewer: Viewer | None, conference_id: str, track_id: str | None, **data: object) -> Track:
    conference = await _editable(viewer, conference_id)
    body = validate(TrackInput, **data)
    name = to_localized(body.name)
    assert name is not None
    if track_id:
        track = conference.track(track_id)
        if track is None:
            raise DomainError(ErrorCode.NOT_FOUND, "Track not found")
        track.name, track.color = name, body.color
    else:
        if len(conference.tracks) >= MAX_TRACKS:
            raise DomainError(ErrorCode.VALIDATION, f"At most {MAX_TRACKS} tracks")
        track = Track(name=name, color=body.color)
        conference.tracks.append(track)
    await _save(conference)
    return track


async def remove_track(viewer: Viewer | None, conference_id: str, track_id: str) -> None:
    conference = await _editable(viewer, conference_id)
    if conference.track(track_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Track not found")
    conference.tracks = [t for t in conference.tracks if t.id != track_id]
    for session in conference.sessions:
        if session.track_id == track_id:
            session.track_id = None
    await _save(conference)


async def upsert_speaker(viewer: Viewer | None, conference_id: str, speaker_id: str | None, **data: object) -> Speaker:
    conference = await _editable(viewer, conference_id)
    body = validate(SpeakerInput, **data)
    old_photo: str | None = None
    if speaker_id:
        speaker = conference.speaker(speaker_id)
        if speaker is None:
            raise DomainError(ErrorCode.NOT_FOUND, "Speaker not found")
        old_photo = speaker.photo_url
    else:
        if len(conference.speakers) >= MAX_SPEAKERS:
            raise DomainError(ErrorCode.VALIDATION, f"At most {MAX_SPEAKERS} speakers")
        speaker = Speaker(name=body.name)
        conference.speakers.append(speaker)
    if body.photo_url and body.photo_url != old_photo:
        uploads.require_own_upload(body.photo_url, "speaker")
    speaker.name = body.name
    speaker.job_title = body.job_title
    speaker.organization = body.organization
    speaker.bio = to_localized(body.bio)
    speaker.photo_url = body.photo_url
    speaker.links = [link for link in body.links if link]
    await _save(conference)
    if old_photo and old_photo != speaker.photo_url:
        await uploads.discard_if_unused(old_photo)
    return speaker


async def remove_speaker(viewer: Viewer | None, conference_id: str, speaker_id: str) -> None:
    conference = await _editable(viewer, conference_id)
    speaker = conference.speaker(speaker_id)
    if speaker is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Speaker not found")
    conference.speakers = [s for s in conference.speakers if s.id != speaker_id]
    for session in conference.sessions:
        session.speaker_ids = [sid for sid in session.speaker_ids if sid != speaker_id]
    await _save(conference)
    if speaker.photo_url:
        await uploads.discard_if_unused(speaker.photo_url)


async def upsert_session(
    viewer: Viewer | None, conference_id: str, session_id: str | None, **data: object
) -> AgendaSession:
    conference = await _editable(viewer, conference_id)
    body = validate(SessionInput, **data)
    title = to_localized(body.title)
    assert title is not None
    day = body.starts_at.astimezone(ZoneInfo(conference.timezone)).date()
    if body.ends_at.astimezone(ZoneInfo(conference.timezone)).date() != day:
        raise DomainError(ErrorCode.VALIDATION, "A session must start and end on the same day", field="endsAt")
    candidate = AgendaSession(
        id=session_id or new_sub_id(),
        day=day,
        track_id=body.track_id,
        title=title,
        description=to_localized(body.description),
        kind=body.kind,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        room=body.room,
        speaker_ids=list(dict.fromkeys(body.speaker_ids)),
        capacity=body.capacity,
    )
    if session_id and conference.session(session_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Session not found")
    _check_session(conference, candidate)
    if session_id:
        conference.sessions = [candidate if s.id == session_id else s for s in conference.sessions]
    else:
        if len(conference.sessions) >= MAX_SESSIONS:
            raise DomainError(ErrorCode.VALIDATION, f"At most {MAX_SESSIONS} sessions")
        conference.sessions.append(candidate)
    conference.sessions.sort(key=lambda s: (s.starts_at, s.room or ""))
    await _save(conference)
    return candidate


async def remove_session(viewer: Viewer | None, conference_id: str, session_id: str) -> None:
    conference = await _editable(viewer, conference_id)
    if conference.session(session_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Session not found")
    conference.sessions = [s for s in conference.sessions if s.id != session_id]
    await _save(conference)


async def set_day_label(viewer: Viewer | None, conference_id: str, day: date, **data: object) -> Conference:
    conference = await _editable(viewer, conference_id)
    body = validate(LabelIn, **data)
    entry = next((d for d in conference.days if d.date == day), None)
    if entry is None:
        raise DomainError(ErrorCode.NOT_FOUND, "That day is not part of the conference")
    entry.label = to_localized(body)
    await _save(conference)
    return conference


# ── Organizer: reading their own ─────────────────────────────────────────────────────────────────────


async def mine(viewer: Viewer | None) -> list[Conference]:
    return await repo.for_organizer(_require_organizer(viewer))


async def for_edit(viewer: Viewer | None, conference_id: str) -> Conference:
    return await _owned(viewer, conference_id)


# ── Public ───────────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class NearInput:
    latitude: float
    longitude: float
    radius_km: float = 25


async def browse(
    *,
    q: str | None = None,
    category: Category | None = None,
    city: str | None = None,
    near: NearInput | None = None,
    starts_from: datetime | None = None,
    starts_to: datetime | None = None,
    timeframe: Literal["upcoming", "past", "all"] = "upcoming",
    first: int = 20,
    after: str | None = None,
) -> repo.SearchPage:
    text = (q or "").strip()[:100] or None
    if near and not (-90 <= near.latitude <= 90 and -180 <= near.longitude <= 180):
        raise DomainError(ErrorCode.VALIDATION, "That location is not on the map", field="near")
    criteria = conference_search.SearchCriteria(
        q=text,
        category=category,
        city=(city or "").strip()[:80] or None,
        near=conference_search.Near(near.latitude, near.longitude, max(1.0, min(near.radius_km, 500.0)))
        if near
        else None,
        starts_from=starts_from,
        starts_to=starts_to,
        timeframe=timeframe,
        now=datetime.now(UTC),
        first=max(1, min(first, MAX_PAGE)),
        after=after,
    )
    return await repo.search(criteria)


async def public_by_slug(slug: str) -> Conference | None:
    conference = await repo.by_slug(slug)
    if conference is None or conference.hidden or conference.status not in ("published", "cancelled"):
        return None
    return conference


async def organizers_by_ids(ids: list[PydanticObjectId]) -> list[Organizer | None]:
    """For the GraphQL DataLoader: one query for every organizer on a page, in the order asked for."""
    found = {o.id: o for o in await accounts.organizers_by_ids(ids)}
    return [found.get(i) for i in ids]
