"""Conference queries and mutations. Thin: rules live in app.services.conferences; this file maps GraphQL
shapes to service calls and documents back to GraphQL types."""

from datetime import UTC, date, datetime
from enum import Enum
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api.graphql.context import Context
from app.api.graphql.types import Done, DoneResult, UserError, guarded
from app.models import Conference as ConferenceDoc
from app.models import LocalizedText as LocalizedTextDoc
from app.models.conference import AgendaSession as SessionDoc
from app.models.conference import Speaker as SpeakerDoc
from app.models.conference import Track as TrackDoc
from app.services import conferences as service

# ── Enums ────────────────────────────────────────────────────────────────────────────────────────────


@strawberry.enum
class Category(Enum):
    TECH = "tech"
    HEALTH = "health"
    EDUCATION = "education"
    BUSINESS = "business"
    SCIENCE = "science"
    ARTS = "arts"
    OTHER = "other"


@strawberry.enum
class SessionKind(Enum):
    KEYNOTE = "keynote"
    TALK = "talk"
    WORKSHOP = "workshop"
    PANEL = "panel"
    BREAK = "break"


@strawberry.enum
class ConferenceStatus(Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


@strawberry.enum(description="Which conferences to list when no date range is given.")
class Timeframe(Enum):
    UPCOMING = "upcoming"
    PAST = "past"
    ALL = "all"


@strawberry.enum
class Lang(Enum):
    EN = "en"
    SI = "si"
    TA = "ta"


# ── Output types ─────────────────────────────────────────────────────────────────────────────────────


@strawberry.type
class LocalizedText:
    en: str
    si: str | None
    ta: str | None


def _text(value: LocalizedTextDoc | None) -> LocalizedText | None:
    return LocalizedText(en=value.en, si=value.si, ta=value.ta) if value else None


@strawberry.type
class GeoLocation:
    latitude: float
    longitude: float


@strawberry.type
class Venue:
    name: str | None
    address: str | None
    city: str | None
    location: GeoLocation | None


@strawberry.type
class ConferenceDay:
    date: date
    label: LocalizedText | None


@strawberry.type
class Track:
    id: strawberry.ID
    name: LocalizedText
    color: str

    @classmethod
    def from_doc(cls, doc: TrackDoc) -> "Track":
        name = _text(doc.name)
        assert name is not None
        return cls(id=strawberry.ID(doc.id), name=name, color=doc.color)


@strawberry.type
class Speaker:
    id: strawberry.ID
    name: str
    job_title: str | None
    organization: str | None
    bio: LocalizedText | None
    photo_url: str | None
    links: list[str]

    @classmethod
    def from_doc(cls, doc: SpeakerDoc) -> "Speaker":
        return cls(
            id=strawberry.ID(doc.id),
            name=doc.name,
            job_title=doc.job_title,
            organization=doc.organization,
            bio=_text(doc.bio),
            photo_url=doc.photo_url,
            links=doc.links,
        )


@strawberry.type
class AgendaSession:
    id: strawberry.ID
    day: date
    title: LocalizedText
    description: LocalizedText | None
    kind: SessionKind
    starts_at: datetime
    ends_at: datetime
    room: str | None
    capacity: int | None
    track: Track | None
    speakers: list[Speaker]

    @classmethod
    def from_doc(cls, doc: SessionDoc, conference: ConferenceDoc) -> "AgendaSession":
        title = _text(doc.title)
        assert title is not None
        track = conference.track(doc.track_id) if doc.track_id else None
        speakers = [s for sid in doc.speaker_ids if (s := conference.speaker(sid)) is not None]
        return cls(
            id=strawberry.ID(doc.id),
            day=doc.day,
            title=title,
            description=_text(doc.description),
            kind=SessionKind(doc.kind),
            starts_at=doc.starts_at,
            ends_at=doc.ends_at,
            room=doc.room,
            capacity=doc.capacity,
            track=Track.from_doc(track) if track else None,
            speakers=[Speaker.from_doc(s) for s in speakers],
        )


@strawberry.type
class Counters:
    registered: int
    confirmed: int
    waitlisted: int
    checked_in: int


@strawberry.type(description="The public face of an organizer: no email or phone.")
class OrganizerSummary:
    name: str
    organization: str | None


@strawberry.type
class Conference:
    id: strawberry.ID
    slug: str
    status: ConferenceStatus
    title: LocalizedText
    summary: LocalizedText | None
    description: LocalizedText | None
    source_lang: Lang
    category: Category
    tags: list[str]
    cover_url: str | None
    venue: Venue
    online_url: str | None
    timezone: str
    starts_at: datetime
    ends_at: datetime
    days: list[ConferenceDay]
    tracks: list[Track]
    speakers: list[Speaker]
    sessions: list[AgendaSession]
    capacity: int | None
    waitlist_enabled: bool
    counters: Counters
    published_at: datetime | None
    cancelled_at: datetime | None
    distance_km: float | None = None
    _doc: strawberry.Private[ConferenceDoc]

    @strawberry.field(description="Seats not yet taken; null when there is no limit.")
    def seats_left(self) -> int | None:
        return None if self.capacity is None else max(0, self.capacity - self.counters.registered)

    @strawberry.field(description="True once the conference's end time has passed (registration is then closed).")
    def ended(self) -> bool:
        return self.ends_at < datetime.now(UTC)

    @strawberry.field(description="True while the conference is running: started, not ended, not cancelled.")
    def live(self) -> bool:
        now = datetime.now(UTC)
        return self._doc.status == "published" and self.starts_at <= now < self.ends_at

    @strawberry.field(description="Shortcut for venue.city.")
    def city(self) -> str | None:
        return self.venue.city

    @strawberry.field(
        description="What blocks publishing, as codes: STARTS_IN_PAST, NEEDS_PLACE, NEEDS_CAPACITY (empty: ready)."
    )
    def publish_problems(self) -> list[str]:
        return service.publish_problems(self._doc)

    @strawberry.field
    async def organizer(self, info: Info[Context, None]) -> OrganizerSummary | None:
        doc = await info.context.organizer_loader.load(self._doc.organizer_id)
        if doc is None:
            return None
        return OrganizerSummary(name=doc.full_name, organization=doc.organization)

    @classmethod
    def from_doc(cls, doc: ConferenceDoc, distance_km: float | None = None) -> "Conference":
        title = _text(doc.title)
        assert title is not None
        loc = doc.venue.location
        return cls(
            id=strawberry.ID(str(doc.id)),
            slug=doc.slug,
            status=ConferenceStatus(doc.status),
            title=title,
            summary=_text(doc.summary),
            description=_text(doc.description),
            source_lang=Lang(doc.source_lang),
            category=Category(doc.category),
            tags=doc.tags,
            cover_url=doc.cover_url,
            venue=Venue(
                name=doc.venue.name,
                address=doc.venue.address,
                city=doc.venue.city,
                location=GeoLocation(latitude=loc.lat, longitude=loc.lng) if loc else None,
            ),
            online_url=doc.online_url,
            timezone=doc.timezone,
            starts_at=doc.starts_at,
            ends_at=doc.ends_at,
            days=[ConferenceDay(date=d.date, label=_text(d.label)) for d in doc.days],
            tracks=[Track.from_doc(t) for t in doc.tracks],
            speakers=[Speaker.from_doc(s) for s in doc.speakers],
            sessions=[AgendaSession.from_doc(s, doc) for s in doc.sessions],
            capacity=doc.capacity,
            waitlist_enabled=doc.waitlist_enabled,
            counters=Counters(
                registered=doc.counters.registered,
                confirmed=doc.counters.confirmed,
                waitlisted=doc.counters.waitlisted,
                checked_in=doc.counters.checked_in,
            ),
            published_at=doc.published_at,
            cancelled_at=doc.cancelled_at,
            distance_km=distance_km,
            _doc=doc,
        )


@strawberry.type
class ConferenceEdge:
    cursor: str
    node: Conference


@strawberry.type
class PageInfo:
    has_next_page: bool
    end_cursor: str | None


@strawberry.type
class ConferenceConnection:
    edges: list[ConferenceEdge]
    page_info: PageInfo


@strawberry.type
class ConferenceList:
    items: list[Conference]


ConferenceResult = Annotated[Conference | UserError, strawberry.union("ConferenceResult")]
ConferenceListResult = Annotated[ConferenceList | UserError, strawberry.union("ConferenceListResult")]
TrackResult = Annotated[Track | UserError, strawberry.union("TrackResult")]
SpeakerResult = Annotated[Speaker | UserError, strawberry.union("SpeakerResult")]
SessionResult = Annotated[AgendaSession | UserError, strawberry.union("SessionResult")]


# ── Inputs ───────────────────────────────────────────────────────────────────────────────────────────


@strawberry.input
class LocalizedTextInput:
    en: str | None = None
    si: str | None = None
    ta: str | None = None


def _texts(value: LocalizedTextInput | None) -> dict[str, str | None] | None:
    return None if value is None else {"en": value.en, "si": value.si, "ta": value.ta}


@strawberry.input
class ConferenceInput:
    title: LocalizedTextInput
    starts_at: datetime
    ends_at: datetime
    summary: LocalizedTextInput | None = None
    description: LocalizedTextInput | None = None
    source_lang: Lang = Lang.EN
    category: Category = Category.OTHER
    tags: list[str] = strawberry.field(default_factory=list)
    venue_name: str | None = None
    venue_address: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    online_url: str | None = None
    timezone: str = "Asia/Colombo"
    capacity: int | None = None
    waitlist_enabled: bool = True
    cover_url: str | None = None

    def to_data(self) -> dict[str, object]:
        data = dict(vars(self))
        data.update(
            title=_texts(self.title),
            summary=_texts(self.summary),
            description=_texts(self.description),
            source_lang=self.source_lang.value,
            category=self.category.value,
        )
        return data


@strawberry.input
class TrackInput:
    name: LocalizedTextInput
    color: str = "#0ea5e9"


@strawberry.input
class SpeakerInput:
    name: str
    job_title: str | None = None
    organization: str | None = None
    bio: LocalizedTextInput | None = None
    photo_url: str | None = None
    links: list[str] = strawberry.field(default_factory=list)


@strawberry.input
class SessionInput:
    title: LocalizedTextInput
    starts_at: datetime
    ends_at: datetime
    description: LocalizedTextInput | None = None
    kind: SessionKind = SessionKind.TALK
    room: str | None = None
    track_id: strawberry.ID | None = None
    speaker_ids: list[strawberry.ID] = strawberry.field(default_factory=list)
    capacity: int | None = None


@strawberry.input
class NearInput:
    latitude: float
    longitude: float
    radius_km: float = 25


@strawberry.input
class ConferenceFilter:
    q: str | None = None
    category: Category | None = None
    city: str | None = None
    near: NearInput | None = None
    starts_from: datetime | None = None
    starts_to: datetime | None = None
    timeframe: Timeframe = Timeframe.UPCOMING


# ── Queries ──────────────────────────────────────────────────────────────────────────────────────────


@strawberry.type
class ConferenceQuery:
    @strawberry.field(
        description="Published (and cancelled) conferences: soonest first, or nearest first with `near`. "
        "Without a date range, only conferences that have not ended."
    )
    async def conferences(
        self, filter: ConferenceFilter | None = None, first: int = 20, after: str | None = None
    ) -> ConferenceConnection:
        f = filter or ConferenceFilter()
        near = f.near
        page = await service.browse(
            q=f.q,
            category=f.category.value if f.category else None,
            city=f.city,
            near=service.NearInput(near.latitude, near.longitude, near.radius_km) if near else None,
            starts_from=f.starts_from,
            starts_to=f.starts_to,
            timeframe=f.timeframe.value,
            first=first,
            after=after,
        )
        return ConferenceConnection(
            edges=[
                ConferenceEdge(cursor=h.cursor, node=Conference.from_doc(h.conference, h.distance_km))
                for h in page.hits
            ],
            page_info=PageInfo(has_next_page=page.has_next, end_cursor=page.end_cursor),
        )

    @strawberry.field(description="Public conferences running right now, the ones that started first at the top.")
    async def happening_now(self, first: int = 8) -> list[Conference]:
        return [Conference.from_doc(doc) for doc in await service.happening_now(first)]

    @strawberry.field(description="One public conference by its web address.")
    async def conference(self, slug: str) -> Conference | None:
        doc = await service.public_by_slug(slug)
        return Conference.from_doc(doc) if doc else None

    @strawberry.field(description="The signed-in organizer's conferences, newest first, in every status.")
    async def my_conferences(self, info: Info[Context, None]) -> ConferenceListResult:
        async def run() -> ConferenceList:
            return ConferenceList(items=[Conference.from_doc(d) for d in await service.mine(info.context.viewer)])

        return await guarded(run)

    @strawberry.field(description="One of the signed-in organizer's conferences, for editing (drafts included).")
    async def my_conference(self, info: Info[Context, None], id: strawberry.ID) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.for_edit(info.context.viewer, str(id)))

        return await guarded(run)

    @strawberry.field
    def categories(self) -> list[Category]:
        return list(Category)


# ── Mutations ────────────────────────────────────────────────────────────────────────────────────────


@strawberry.type
class ConferenceMutation:
    @strawberry.mutation(description="Create a draft conference owned by the signed-in organizer.")
    async def create_conference(self, info: Info[Context, None], input: ConferenceInput) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.create(info.context.viewer, **input.to_data()))

        return await guarded(run)

    @strawberry.mutation
    async def update_conference(
        self, info: Info[Context, None], id: strawberry.ID, input: ConferenceInput
    ) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.update(info.context.viewer, str(id), **input.to_data()))

        return await guarded(run)

    @strawberry.mutation(description="Make a draft public. Fails with NOT_PUBLISHABLE and the reasons when incomplete.")
    async def publish_conference(self, info: Info[Context, None], id: strawberry.ID) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.publish(info.context.viewer, str(id)))

        return await guarded(run)

    @strawberry.mutation(description="Back to draft; only while nobody has registered.")
    async def unpublish_conference(self, info: Info[Context, None], id: strawberry.ID) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.unpublish(info.context.viewer, str(id)))

        return await guarded(run)

    @strawberry.mutation(description="Cancel a published conference; it stays visible, marked as cancelled.")
    async def cancel_conference(self, info: Info[Context, None], id: strawberry.ID) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.cancel(info.context.viewer, str(id)))

        return await guarded(run)

    @strawberry.mutation(description="Delete a conference and its images; only while nobody has registered.")
    async def delete_conference(self, info: Info[Context, None], id: strawberry.ID) -> DoneResult:
        async def run() -> Done:
            await service.delete(info.context.viewer, str(id))
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Copy a conference (details, agenda and images) into a new draft.")
    async def duplicate_conference(self, info: Info[Context, None], id: strawberry.ID) -> ConferenceResult:
        async def run() -> Conference:
            return Conference.from_doc(await service.duplicate(info.context.viewer, str(id)))

        return await guarded(run)

    @strawberry.mutation(description="Add a track (no trackId) or change one.")
    async def upsert_track(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        input: TrackInput,
        track_id: strawberry.ID | None = None,
    ) -> TrackResult:
        async def run() -> Track:
            doc = await service.upsert_track(
                info.context.viewer, str(conference_id), str(track_id) if track_id else None,
                name=_texts(input.name), color=input.color,
            )  # fmt: skip
            return Track.from_doc(doc)

        return await guarded(run)

    @strawberry.mutation(description="Remove a track; its sessions keep their place without a track.")
    async def remove_track(
        self, info: Info[Context, None], conference_id: strawberry.ID, track_id: strawberry.ID
    ) -> DoneResult:
        async def run() -> Done:
            await service.remove_track(info.context.viewer, str(conference_id), str(track_id))
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Add a speaker (no speakerId) or change one.")
    async def upsert_speaker(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        input: SpeakerInput,
        speaker_id: strawberry.ID | None = None,
    ) -> SpeakerResult:
        async def run() -> Speaker:
            doc = await service.upsert_speaker(
                info.context.viewer, str(conference_id), str(speaker_id) if speaker_id else None,
                name=input.name, job_title=input.job_title, organization=input.organization,
                bio=_texts(input.bio), photo_url=input.photo_url, links=input.links,
            )  # fmt: skip
            return Speaker.from_doc(doc)

        return await guarded(run)

    @strawberry.mutation(description="Remove a speaker; they are also taken off every session.")
    async def remove_speaker(
        self, info: Info[Context, None], conference_id: strawberry.ID, speaker_id: strawberry.ID
    ) -> DoneResult:
        async def run() -> Done:
            await service.remove_speaker(info.context.viewer, str(conference_id), str(speaker_id))
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Add a session (no sessionId) or change one. Refuses room clashes.")
    async def upsert_session(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        input: SessionInput,
        session_id: strawberry.ID | None = None,
    ) -> SessionResult:
        async def run() -> AgendaSession:
            doc = await service.upsert_session(
                info.context.viewer, str(conference_id), str(session_id) if session_id else None,
                title=_texts(input.title), description=_texts(input.description), kind=input.kind.value,
                starts_at=input.starts_at, ends_at=input.ends_at, room=input.room,
                track_id=str(input.track_id) if input.track_id else None,
                speaker_ids=[str(s) for s in input.speaker_ids], capacity=input.capacity,
            )  # fmt: skip
            conference = await service.for_edit(info.context.viewer, str(conference_id))
            return AgendaSession.from_doc(doc, conference)

        return await guarded(run)

    @strawberry.mutation
    async def remove_session(
        self, info: Info[Context, None], conference_id: strawberry.ID, session_id: strawberry.ID
    ) -> DoneResult:
        async def run() -> Done:
            await service.remove_session(info.context.viewer, str(conference_id), str(session_id))
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Name a day, e.g. 'Workshop day'. Send no label to clear it.")
    async def set_day_label(
        self,
        info: Info[Context, None],
        conference_id: strawberry.ID,
        day: date,
        label: LocalizedTextInput | None = None,
    ) -> ConferenceResult:
        async def run() -> Conference:
            texts = _texts(label) or {}
            doc = await service.set_day_label(info.context.viewer, str(conference_id), day, **texts)
            return Conference.from_doc(doc)

        return await guarded(run)
