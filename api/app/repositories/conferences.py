"""Repository pattern: every read and write of the conferences collection goes through here."""

from dataclasses import dataclass
from datetime import datetime
from uuid import uuid4

from beanie import PydanticObjectId
from beanie.odm.utils.encoder import Encoder
from pymongo.errors import DuplicateKeyError
from pymongo.results import UpdateResult

from app.models import Conference
from app.models.common import utcnow
from app.repositories.conference_search import (
    Cursor,
    SearchBackend,
    SearchCriteria,
    TextIndexSearch,
    distance_km,
)

_search: SearchBackend = TextIndexSearch()


class SlugTakenError(Exception):
    pass


class StaleWriteError(Exception):
    """Someone else saved the conference after it was read."""


@dataclass(frozen=True)
class SearchHit:
    conference: Conference
    distance_km: float | None
    cursor: str


@dataclass(frozen=True)
class SearchPage:
    hits: list[SearchHit]
    end_cursor: str | None
    has_next: bool


def use_search_backend(backend: SearchBackend) -> None:
    global _search
    _search = backend


async def by_id(conference_id: str | PydanticObjectId) -> Conference | None:
    try:
        oid = PydanticObjectId(conference_id)
    except Exception:
        return None
    return await Conference.get(oid)


async def by_slug(slug: str) -> Conference | None:
    return await Conference.find_one({"slug": slug})


async def slug_exists(slug: str) -> bool:
    return await Conference.find_one({"slug": slug}) is not None


async def insert(conference: Conference) -> Conference:
    try:
        await conference.insert()
    except DuplicateKeyError as err:
        raise SlugTakenError(conference.slug) from err
    return conference


# Seat counters are only ever changed with atomic $inc (repositories/registrations.py). A whole-document save
# must never write them back, or it would undo registrations made since the document was read.
_NOT_SAVED = frozenset({"id", "revision_id", "counters", "reminders_sent_at"})


async def save(conference: Conference) -> None:
    """Save every field except the counters, only if nobody saved the conference since it was read."""
    conference.updated_at = utcnow()
    new_revision = uuid4()
    data = Encoder(exclude=_NOT_SAVED, to_db=True).encode(conference)
    result = await Conference.find_one({"_id": conference.id, "revision_id": conference.revision_id}).update(
        {"$set": {**data, "revision_id": new_revision}}
    )
    if not isinstance(result, UpdateResult) or result.matched_count != 1:
        raise StaleWriteError(str(conference.id))
    conference.revision_id = new_revision


async def delete(conference: Conference) -> None:
    await conference.delete()


async def for_organizer(organizer_id: PydanticObjectId) -> list[Conference]:
    return await Conference.find({"organizer_id": organizer_id}).sort("-starts_at").to_list()


async def count_for_organizer(organizer_id: PydanticObjectId) -> int:
    return await Conference.find({"organizer_id": organizer_id}).count()


async def search(criteria: SearchCriteria) -> SearchPage:
    cursor = Cursor.decode(criteria.after)
    plan = _search.build(criteria, cursor)
    limit = criteria.first
    find = Conference.find(plan.filter)
    offset = cursor.offset if plan.by_distance and cursor and cursor.offset is not None else 0
    if plan.by_distance:
        docs = await find.skip(offset).limit(limit + 1).to_list()
    else:
        docs = await find.sort(plan.sort).limit(limit + 1).to_list()
    has_next = len(docs) > limit
    docs = docs[:limit]

    near = criteria.near
    hits = []
    for index, doc in enumerate(docs):
        loc = doc.venue.location
        dist = distance_km(near.lat, near.lng, loc.lat, loc.lng) if near and loc else None
        position = (
            Cursor(offset=offset + index + 1) if plan.by_distance else Cursor(starts_at=doc.starts_at, id=str(doc.id))
        )
        hits.append(
            SearchHit(
                conference=doc, distance_km=round(dist, 1) if dist is not None else None, cursor=position.encode()
            )
        )
    return SearchPage(hits=hits, end_cursor=hits[-1].cursor if hits else None, has_next=has_next)


async def starting_between(start: datetime, end: datetime) -> list[Conference]:
    return await Conference.find(
        {"status": "published", "hidden": False, "starts_at": {"$gte": start, "$lt": end}}
    ).to_list()


async def ended_between(start: datetime, end: datetime) -> list[Conference]:
    """Published conferences that ended in [start, end): the after-the-event feedback email goes to these."""
    return await Conference.find({"status": "published", "ends_at": {"$gte": start, "$lt": end}}).to_list()


async def running_or_recent(since: datetime) -> list[Conference]:
    return await Conference.find({"status": {"$in": ["published", "cancelled"]}, "ends_at": {"$gte": since}}).to_list()


async def mark_reminders_sent(conference_id: PydanticObjectId, at: datetime) -> None:
    await Conference.get_pymongo_collection().update_one({"_id": conference_id}, {"$set": {"reminders_sent_at": at}})


async def file_still_used(url: str) -> bool:
    """Whether any conference still points at this uploaded file (cover or speaker photo)."""
    return await Conference.find_one({"$or": [{"cover_url": url}, {"speakers.photo_url": url}]}) is not None
