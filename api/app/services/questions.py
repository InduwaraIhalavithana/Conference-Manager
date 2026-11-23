"""Live Q&A for a conference's sessions.

Rules:
- Only ticket holders with a confirmed seat ask and vote (by ticket code; no account). They appear by first name.
- Questions show at once (no approval). The organizer can mark one answered, hide it, or show it again.
- Asking and voting are open from publishing until QA_GRACE after the conference ends; after that the board is
  read-only. Hidden questions are never shown to attendees.
- One vote per ticket per question (toggle); nobody votes for their own question.
- Every change sends a "questions changed" signal (no content) on the conference's public Q&A channel, so open
  pages refetch; a lost signal never fails the change itself.
"""

import contextlib
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from beanie import PydanticObjectId

from app.core.errors import DomainError, ErrorCode
from app.models import Conference, Question, Registration
from app.models.common import utcnow
from app.models.question import QuestionStatus
from app.repositories import conferences as conference_repo
from app.repositories import live
from app.repositories import questions as repo
from app.repositories import registrations as registration_repo
from app.services import ratelimit
from app.services.auth import Viewer
from app.services.registrations import owned_conference

ASK = ratelimit.Limit("qa_ask", 10)
VOTE = ratelimit.Limit("qa_vote", 60)
TEXT_MIN, TEXT_MAX = 3, 300
QA_GRACE = timedelta(hours=2)
HEARTBEAT_SECONDS = 20.0


def is_open(conference: Conference, now: datetime | None = None) -> bool:
    return conference.status == "published" and (now or utcnow()) <= conference.ends_at + QA_GRACE


def first_name(full_name: str) -> str:
    return (full_name.strip().split() or ["?"])[0][:40]


async def _ticket_holder(ticket_code: str) -> tuple[Registration, Conference]:
    registration = await registration_repo.by_ticket(ticket_code)
    conference = await conference_repo.by_id(registration.conference_id) if registration else None
    if registration is None or conference is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Ticket not found")
    if registration.status != "registered" or not registration.is_confirmed:
        raise DomainError(ErrorCode.QA_TICKET_REQUIRED, "Live Q&A is for people with a confirmed seat")
    return registration, conference


def _session(conference: Conference, session_id: str) -> None:
    if conference.session(session_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Session not found", field="sessionId")


async def _signal(conference_id: PydanticObjectId, session_id: str) -> None:
    with contextlib.suppress(Exception):
        await live.publish(conference_id, {"type": "questions", "sessionId": session_id}, topic="qa")


@dataclass(frozen=True)
class Board:
    registration: Registration
    conference: Conference
    session_id: str | None  # None only when the conference has no sessions
    questions: list[Question]
    counts: dict[str, int]


def default_session(conference: Conference, now: datetime | None = None) -> str | None:
    """The session running now, else the next one, else the last one."""
    now = now or utcnow()
    ordered = sorted(conference.sessions, key=lambda s: s.starts_at)
    for s in ordered:
        if s.ends_at >= now:
            return s.id
    return ordered[-1].id if ordered else None


async def board(ticket_code: str, session_id: str | None) -> Board:
    """What a ticket holder sees for one session (readable even after Q&A has closed)."""
    registration, conference = await _ticket_holder(ticket_code)
    chosen = session_id or default_session(conference)
    if chosen is not None:
        _session(conference, chosen)
    assert conference.id is not None
    return Board(
        registration=registration,
        conference=conference,
        session_id=chosen,
        questions=await repo.for_session(conference.id, chosen, include_hidden=False) if chosen else [],
        counts=await repo.counts_by_session(conference.id),
    )


async def ask(ip: str, ticket_code: str, session_id: str, text: str) -> Question:
    await ratelimit.enforce(ASK, ip)
    registration, conference = await _ticket_holder(ticket_code)
    _session(conference, session_id)
    if not is_open(conference):
        raise DomainError(ErrorCode.QA_CLOSED, "Questions for this conference have closed")
    cleaned = " ".join(text.split())
    if not TEXT_MIN <= len(cleaned) <= TEXT_MAX:
        raise DomainError(ErrorCode.VALIDATION, f"Write {TEXT_MIN} to {TEXT_MAX} characters", field="text")
    assert conference.id is not None and registration.id is not None
    question = await repo.insert(
        Question(
            conference_id=conference.id,
            session_id=session_id,
            registration_id=registration.id,
            author_name=first_name(registration.name),
            text=cleaned,
        )
    )
    await _signal(conference.id, session_id)
    return question


async def vote(ip: str, ticket_code: str, question_id: str, on: bool) -> tuple[Question, Registration]:
    await ratelimit.enforce(VOTE, ip)
    registration, conference = await _ticket_holder(ticket_code)
    question = await repo.by_id(question_id)
    if question is None or question.conference_id != conference.id or question.status == "hidden":
        raise DomainError(ErrorCode.NOT_FOUND, "Question not found")
    if not is_open(conference):
        raise DomainError(ErrorCode.QA_CLOSED, "Questions for this conference have closed")
    if question.registration_id == registration.id:
        raise DomainError(ErrorCode.INVALID_STATE, "You cannot vote for your own question")
    assert question.id is not None and registration.id is not None
    updated = await repo.set_vote(question.id, registration.id, on)
    assert updated is not None
    await _signal(conference.id or question.conference_id, question.session_id)
    return updated, registration


async def session_questions(viewer: Viewer | None, conference_id: str, session_id: str) -> list[Question]:
    """Everything asked in one session, hidden ones too, for the conference's owner."""
    conference = await owned_conference(viewer, conference_id)
    _session(conference, session_id)
    assert conference.id is not None
    return await repo.for_session(conference.id, session_id, include_hidden=True)


async def owned(viewer: Viewer | None, conference_id: str) -> Conference:
    return await owned_conference(viewer, conference_id)


async def question_counts(viewer: Viewer | None, conference_id: str) -> dict[str, int]:
    conference = await owned_conference(viewer, conference_id)
    assert conference.id is not None
    return await repo.counts_by_session(conference.id)


async def moderate(viewer: Viewer | None, question_id: str, status: QuestionStatus) -> Question:
    question = await repo.by_id(question_id)
    if question is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Question not found")
    await owned_conference(viewer, str(question.conference_id))  # someone else's question reads as missing
    assert question.id is not None
    updated = await repo.set_status(question.id, status)
    assert updated is not None
    await _signal(question.conference_id, question.session_id)
    return updated


async def signals(conference_id: str, heartbeat: float = HEARTBEAT_SECONDS) -> AsyncIterator[dict[str, Any]]:
    """The public 'questions changed' stream of a published conference (pings while quiet). No content in it."""
    async for event in live.listen(conference_id, heartbeat, topic="qa"):
        yield event if event is not None else {"type": "ping"}


async def require_published(conference_id: str) -> None:
    conference = await conference_repo.by_id(conference_id)
    if conference is None or conference.status != "published":
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
