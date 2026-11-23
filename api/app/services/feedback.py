"""Bookmarks and feedback from attendees (by ticket code, no account), the organizer's view of the ratings,
and the after-the-event email asking for them.

Rules:
- Bookmarks: any active ticket, for any session of its conference.
- Ratings: only tickets that were checked in. A session can be rated once it has ended; the conference as a
  whole once the conference has ended. Everything closes FEEDBACK_DAYS after the end. One rating per session
  per ticket; giving it again replaces it.
- The organizer sees averages and comments, never who wrote them.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.core.errors import DomainError, ErrorCode
from app.core.logging import get_logger
from app.models import Conference, Registration, SessionRating
from app.models.common import utcnow
from app.repositories import conferences as conference_repo
from app.repositories import feedback as repo
from app.repositories import registrations as registration_repo
from app.services import ratelimit
from app.services.auth import Viewer
from app.services.registrations import owned_conference, send_to_attendee

log = get_logger("feedback")

FEEDBACK_DAYS = 14
COMMENT_MAX = 1000
BOOKMARK = ratelimit.Limit("attendee_bookmark", 60)
RATE = ratelimit.Limit("attendee_feedback", 30)

Window = Literal["open", "not_yet", "closed"]


def closes_at(conference: Conference) -> datetime:
    return conference.ends_at + timedelta(days=FEEDBACK_DAYS)


def window(conference: Conference, session_id: str | None, now: datetime | None = None) -> Window:
    """Whether a session (or, with None, the whole conference) can be rated right now."""
    now = now or utcnow()
    if now > closes_at(conference):
        return "closed"
    session = conference.session(session_id) if session_id else None
    opens = session.ends_at if session else conference.ends_at
    return "open" if now >= opens else "not_yet"


async def _ticket(code: str) -> tuple[Registration, Conference]:
    registration = await registration_repo.by_ticket(code)
    conference = await conference_repo.by_id(registration.conference_id) if registration else None
    if registration is None or conference is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Ticket not found")
    return registration, conference


async def set_bookmark(ip: str, ticket_code: str, session_id: str, on: bool) -> Registration:
    await ratelimit.enforce(BOOKMARK, ip)
    registration, conference = await _ticket(ticket_code)
    if not registration.active:
        raise DomainError(ErrorCode.REGISTRATION_INACTIVE, "This registration is no longer active")
    if conference.session(session_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Session not found", field="sessionId")
    assert registration.id is not None
    await repo.set_bookmark(registration.id, session_id, on)
    updated = await registration_repo.by_id(registration.id)
    assert updated is not None
    return updated


async def rate(ip: str, ticket_code: str, session_id: str | None, score: int, comment: str | None) -> SessionRating:
    await ratelimit.enforce(RATE, ip)
    registration, conference = await _ticket(ticket_code)
    if registration.checked_in_at is None:
        raise DomainError(ErrorCode.FEEDBACK_NOT_ATTENDED, "Only people who were checked in can give feedback")
    if session_id is not None and conference.session(session_id) is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Session not found", field="sessionId")
    if not 1 <= score <= 5:
        raise DomainError(ErrorCode.VALIDATION, "Choose 1 to 5 stars", field="score")
    text = (comment or "").strip()
    if len(text) > COMMENT_MAX:
        raise DomainError(ErrorCode.VALIDATION, f"Keep the comment under {COMMENT_MAX} characters", field="comment")
    match window(conference, session_id):
        case "not_yet":
            raise DomainError(ErrorCode.FEEDBACK_NOT_YET, "Feedback opens when it has ended")
        case "closed":
            raise DomainError(ErrorCode.FEEDBACK_CLOSED, "Feedback for this conference has closed")
    assert registration.id is not None and conference.id is not None
    return await repo.save_rating(conference.id, registration.id, session_id, score, text or None)


async def ratings_for(registration: Registration) -> list[SessionRating]:
    assert registration.id is not None
    return await repo.for_registration(registration.id)


@dataclass(frozen=True)
class FeedbackSummary:
    conference: Conference
    respondents: int
    attended: int
    scores: list[repo.ScoreSummary]
    comments: list[SessionRating]


async def conference_feedback(viewer: Viewer | None, conference_id: str) -> FeedbackSummary:
    conference = await owned_conference(viewer, conference_id)
    assert conference.id is not None
    return FeedbackSummary(
        conference=conference,
        respondents=await repo.respondents(conference.id),
        attended=conference.counters.checked_in,
        scores=await repo.summary(conference.id),
        comments=await repo.comments(conference.id),
    )


async def send_feedback_requests(now: datetime | None = None) -> int:
    """Daily job: the day after a conference ends, ask everyone who was checked in for feedback (once each)."""
    now = now or datetime.now(UTC)
    sent = 0
    # Ended at least 20 hours ago (so "the day after"), and recently enough that feedback is still open.
    for conference in await conference_repo.ended_between(
        now - timedelta(days=FEEDBACK_DAYS - 1), now - timedelta(hours=20)
    ):
        assert conference.id is not None
        for registration in await repo.attendees_to_ask(conference.id):
            assert registration.id is not None
            if await repo.mark_asked(registration.id, now):
                await send_to_attendee(registration, conference, "feedback_request")
                sent += 1
    if sent:
        log.info("sent feedback requests", count=sent)
    return sent
