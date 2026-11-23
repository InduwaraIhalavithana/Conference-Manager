"""Repository for registrations and the seat counters on the conference document.

The seat limit relies on one atomic, conditional update: the counter is only increased while it is below
the capacity. MongoDB applies that check and the increment as a single operation, so two people can never
take the last seat, even without row locks.
"""

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from beanie import PydanticObjectId, SortDirection
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.models import CheckInEvent, Conference, Registration
from app.models.common import utcnow
from app.models.registration import CheckInMeta, RegistrationStatus
from app.repositories.conference_search import Cursor
from app.repositories.unit_of_work import Session


class AlreadyRegisteredError(Exception):
    pass


def _conferences() -> Any:
    return Conference.get_pymongo_collection()


def _registrations() -> Any:
    return Registration.get_pymongo_collection()


# ── Seat counters (always inside a unit of work) ─────────────────────────────────────────────────────


async def take_seat(conference_id: PydanticObjectId, session: Session) -> bool:
    """Atomically take one seat if any is left. True when a seat was taken."""
    updated = await _conferences().find_one_and_update(
        {
            "_id": conference_id,
            "$or": [{"capacity": None}, {"$expr": {"$lt": ["$counters.registered", "$capacity"]}}],
        },
        {"$inc": {"counters.registered": 1}},
        session=session,
        return_document=ReturnDocument.AFTER,
    )
    return updated is not None


async def bump(conference_id: PydanticObjectId, session: Session | None = None, **deltas: int) -> None:
    """Change counters, e.g. bump(cid, s, registered=-1, confirmed=-1)."""
    changes = {f"counters.{field}": delta for field, delta in deltas.items() if delta}
    if changes:
        await _conferences().update_one({"_id": conference_id}, {"$inc": changes}, session=session)


# ── Registrations ────────────────────────────────────────────────────────────────────────────────────


async def insert(registration: Registration, session: Session | None = None) -> Registration:
    try:
        await registration.insert(session=session)
    except DuplicateKeyError as err:
        raise AlreadyRegisteredError(registration.email) from err
    return registration


async def set_fields(
    registration_id: PydanticObjectId,
    fields: dict[str, Any],
    session: Session | None = None,
    *,
    expect: dict[str, Any] | None = None,
) -> bool:
    """Update a registration, optionally only if it still matches `expect` (compare-and-set). True if changed."""
    query = {"_id": registration_id, **(expect or {})}
    result = await _registrations().update_one(query, {"$set": {**fields, "updated_at": utcnow()}}, session=session)
    return bool(result.modified_count)


async def by_id(registration_id: str | PydanticObjectId, session: Session | None = None) -> Registration | None:
    try:
        oid = PydanticObjectId(registration_id)
    except Exception:
        return None
    return await Registration.find_one({"_id": oid}, session=session)


async def by_ticket(code: str) -> Registration | None:
    return await Registration.find_one({"ticket_code": code.strip().upper().replace(" ", "").replace("-", "")})


async def active_for_email(conference_id: PydanticObjectId, email: str) -> Registration | None:
    return await Registration.find_one({"conference_id": conference_id, "email": email, "active": True})


async def next_confirmed_waitlister(conference_id: PydanticObjectId, session: Session) -> Registration | None:
    return await Registration.find_one(
        {"conference_id": conference_id, "status": "waitlisted", "confirmed_at": {"$ne": None}},
        session=session,
        sort=[("created_at", 1), ("_id", 1)],
    )


async def waitlist_position(registration: Registration) -> int:
    ahead = await Registration.find(
        {
            "conference_id": registration.conference_id,
            "status": "waitlisted",
            "created_at": {"$lt": registration.created_at},
        }
    ).count()
    return ahead + 1


async def expired_holds(now: datetime, limit: int = 500) -> list[Registration]:
    return (
        await Registration.find(
            {"status": {"$in": ["held", "waitlisted"]}, "confirmed_at": None, "hold_expires_at": {"$lt": now}}
        )
        .limit(limit)
        .to_list()
    )


async def confirmed_without_reminder(conference_id: PydanticObjectId) -> list[Registration]:
    return await Registration.find(
        {"conference_id": conference_id, "status": "registered", "reminder_sent_at": None}
    ).to_list()


async def confirmed_without(conference_id: PydanticObjectId, sent_field: str) -> list[Registration]:
    """Confirmed seats that have not had this email yet (`sent_field` is the registration's timestamp)."""
    return await Registration.find({"conference_id": conference_id, "status": "registered", sent_field: None}).to_list()


async def active_for_conference(conference_id: PydanticObjectId) -> list[Registration]:
    return await Registration.find({"conference_id": conference_id, "active": True}).to_list()


@dataclass(frozen=True)
class AttendeePage:
    items: list[Registration]
    cursors: list[str]
    end_cursor: str | None
    has_next: bool
    total: int


async def list_for_conference(
    conference_id: PydanticObjectId,
    *,
    statuses: list[RegistrationStatus] | None,
    q: str | None,
    checked_in: bool | None,
    first: int,
    after: str | None,
) -> AttendeePage:
    query: dict[str, Any] = {"conference_id": conference_id}
    if statuses:
        query["status"] = {"$in": statuses}
    if q:
        pattern = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"email": pattern}, {"ticket_code": pattern}]
    if checked_in is not None:
        query["checked_in_at"] = {"$ne": None} if checked_in else None
    total = await Registration.find(query).count()
    cursor = Cursor.decode(after)
    if cursor and cursor.starts_at and cursor.id:
        query = {
            "$and": [
                query,
                {
                    "$or": [
                        {"created_at": {"$gt": cursor.starts_at}},
                        {"created_at": cursor.starts_at, "_id": {"$gt": PydanticObjectId(cursor.id)}},
                    ]
                },
            ]
        }
    docs = (
        await Registration.find(query)
        .sort([("created_at", SortDirection.ASCENDING), ("_id", SortDirection.ASCENDING)])
        .limit(first + 1)
        .to_list()
    )
    has_next = len(docs) > first
    docs = docs[:first]
    cursors = [Cursor(starts_at=d.created_at, id=str(d.id)).encode() for d in docs]
    return AttendeePage(
        items=docs, cursors=cursors, end_cursor=cursors[-1] if cursors else None, has_next=has_next, total=total
    )


async def counts_by_status(conference_id: PydanticObjectId) -> dict[str, int]:
    """Recount from the registrations themselves (used to check the counters on the conference)."""
    pipeline = [
        {"$match": {"conference_id": conference_id}},
        {
            "$group": {
                "_id": None,
                "registered": {"$sum": {"$cond": [{"$in": ["$status", ["held", "registered"]]}, 1, 0]}},
                "confirmed": {"$sum": {"$cond": [{"$eq": ["$status", "registered"]}, 1, 0]}},
                "waitlisted": {"$sum": {"$cond": [{"$eq": ["$status", "waitlisted"]}, 1, 0]}},
                "checked_in": {"$sum": {"$cond": [{"$ne": ["$checked_in_at", None]}, 1, 0]}},
            }
        },
    ]
    rows = await (await _registrations().aggregate(pipeline)).to_list(1)
    row = rows[0] if rows else {}
    return {k: int(row.get(k, 0)) for k in ("registered", "confirmed", "waitlisted", "checked_in")}


async def record_check_in(
    conference_id: PydanticObjectId, registration_id: PydanticObjectId, gate: str, at: datetime | None = None
) -> None:
    await CheckInEvent(
        at=at or utcnow(), meta=CheckInMeta(conference_id=conference_id, gate=gate), registration_id=registration_id
    ).insert()


async def record_undo(conference_id: PydanticObjectId, registration_id: PydanticObjectId, gate: str) -> None:
    await CheckInEvent(
        meta=CheckInMeta(conference_id=conference_id, gate=gate), registration_id=registration_id, undone=True
    ).insert()
