"""Bookmarks, ratings (who, when, how often), the organizer's anonymous summary, and the feedback email."""

from datetime import UTC, datetime, timedelta
from typing import Any

from app.models import SessionRating
from app.models.common import LocalizedText
from app.models.conference import AgendaSession
from app.repositories import conferences as conference_repo
from app.services import feedback
from tests.conftest import OUTBOX, Api, sign_in_organizer
from tests.test_registrations import CANCEL_REG, CHECK_IN, conference, confirmed, register

BOOKMARK = """mutation($t: String!, $s: ID!, $on: Boolean!) { setBookmark(ticketCode: $t, sessionId: $s, bookmarked: $on) {
  __typename ... on Ticket { bookmarkedSessionIds } ... on UserError { code } } }"""
RATE = """mutation($t: String!, $s: ID, $score: Int!, $c: String) { rateSession(ticketCode: $t, sessionId: $s, score: $score, comment: $c) {
  __typename ... on MyRating { sessionId score comment } ... on UserError { code field } } }"""
MY_TICKET = """query($t: String!) { ticket(code: $t) { bookmarkedSessionIds feedbackClosesAt ratings { sessionId score comment } } }"""
SUMMARY = """query($c: ID!) { conferenceFeedback(conferenceId: $c) { __typename
  ... on ConferenceFeedback { respondents attended scores { sessionId average count } comments { sessionId score comment } }
  ... on UserError { code } } }"""


async def with_sessions(conference_id: str, *, ended_days_ago: float | None = None) -> tuple[str, str]:
    """Give the conference one session that has ended and one still to come; optionally move it into the past.
    Returns (ended_session_id, upcoming_session_id)."""
    doc = await conference_repo.by_id(conference_id)
    assert doc is not None
    now = datetime.now(UTC)
    if ended_days_ago is not None:
        doc.ends_at = now - timedelta(days=ended_days_ago)
        doc.starts_at = doc.ends_at - timedelta(hours=8)
    past = AgendaSession(
        day=now.date(), title=LocalizedText(en="Opening talk"),
        starts_at=now - timedelta(hours=3), ends_at=now - timedelta(hours=2),
    )  # fmt: skip
    later = AgendaSession(
        day=now.date(), title=LocalizedText(en="Closing panel"),
        starts_at=now + timedelta(hours=2), ends_at=now + timedelta(hours=3),
    )  # fmt: skip
    doc.sessions = [past, later]
    await conference_repo.save(doc)
    return past.id, later.id


async def rate(api: Api, ticket: str, score: int, session: str | None = None, comment: str | None = None) -> Any:
    return (await api.gql(RATE, {"t": ticket, "s": session, "score": score, "c": comment}))["data"]["rateSession"]


async def test_bookmarks_are_saved_on_the_ticket(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    past, later = await with_sessions(conf["id"])
    ticket = (await register(other_api, conf["slug"]))["ticketCode"]

    for _ in range(2):  # saving twice keeps one entry
        res = (await other_api.gql(BOOKMARK, {"t": ticket, "s": later, "on": True}))["data"]["setBookmark"]
    assert res["bookmarkedSessionIds"] == [later]
    res = (await other_api.gql(BOOKMARK, {"t": ticket, "s": past, "on": True}))["data"]["setBookmark"]
    assert set(res["bookmarkedSessionIds"]) == {past, later}
    res = (await other_api.gql(BOOKMARK, {"t": ticket, "s": later, "on": False}))["data"]["setBookmark"]
    assert res["bookmarkedSessionIds"] == [past]

    unknown = (await other_api.gql(BOOKMARK, {"t": ticket, "s": "nope", "on": True}))["data"]["setBookmark"]
    assert unknown == {"__typename": "UserError", "code": "NOT_FOUND"}
    await other_api.gql(CANCEL_REG, {"t": ticket})
    gone = (await other_api.gql(BOOKMARK, {"t": ticket, "s": past, "on": True}))["data"]["setBookmark"]
    assert gone["code"] == "REGISTRATION_INACTIVE"


async def test_only_people_who_came_rate_and_only_once_it_has_ended(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    past, later = await with_sessions(conf["id"])
    ticket = await confirmed(other_api, conf["slug"])

    assert (await rate(other_api, ticket, 5, past))["code"] == "FEEDBACK_NOT_ATTENDED"
    await api.gql(CHECK_IN, {"c": conf["id"], "code": ticket})

    assert (await rate(other_api, ticket, 4, later))["code"] == "FEEDBACK_NOT_YET"
    assert (await rate(other_api, ticket, 4))["code"] == "FEEDBACK_NOT_YET"  # the conference has not ended
    assert (await rate(other_api, ticket, 6, past))["field"] == "score"
    assert (await rate(other_api, ticket, 3, past, "x" * 1001))["field"] == "comment"

    assert (await rate(other_api, ticket, 3, past, "  Too short  "))["score"] == 3
    again = await rate(other_api, ticket, 5, past, "Great after all")  # replaces, does not add
    assert again == {"__typename": "MyRating", "sessionId": past, "score": 5, "comment": "Great after all"}
    assert await SessionRating.find({"session_id": past}).count() == 1

    await with_sessions(conf["id"], ended_days_ago=1)
    assert (await rate(other_api, ticket, 4, None, ""))["comment"] is None  # whole conference, empty comment
    mine = (await other_api.gql(MY_TICKET, {"t": ticket}))["data"]["ticket"]
    assert {(r["sessionId"], r["score"]) for r in mine["ratings"]} == {(past, 5), (None, 4)}

    await with_sessions(conf["id"], ended_days_ago=feedback.FEEDBACK_DAYS + 1)
    assert (await rate(other_api, ticket, 2, None))["code"] == "FEEDBACK_CLOSED"


async def test_the_organizer_sees_anonymous_averages_and_comments(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    past, _ = await with_sessions(conf["id"])
    tickets = [await confirmed(other_api, conf["slug"]) for _ in range(3)]
    for ticket in tickets:
        await api.gql(CHECK_IN, {"c": conf["id"], "code": ticket})
    await rate(other_api, tickets[0], 5, past, "Loved it")
    await rate(other_api, tickets[1], 2, past)

    res = (await api.gql(SUMMARY, {"c": conf["id"]}))["data"]["conferenceFeedback"]
    assert res["respondents"] == 2 and res["attended"] == 3
    assert res["scores"] == [{"sessionId": past, "average": 3.5, "count": 2}]
    assert res["comments"] == [{"sessionId": past, "score": 5, "comment": "Loved it"}]

    await sign_in_organizer(other_api, "Other")  # not their conference: looks missing
    assert (await other_api.gql(SUMMARY, {"c": conf["id"]}))["data"]["conferenceFeedback"]["code"] == "NOT_FOUND"


async def test_the_day_after_people_who_came_are_asked_once(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    came = await confirmed(other_api, conf["slug"])
    await confirmed(other_api, conf["slug"])  # registered but never came: not asked
    await api.gql(CHECK_IN, {"c": conf["id"], "code": came})
    await with_sessions(conf["id"], ended_days_ago=1)

    def asked() -> list[str]:
        """Feedback emails for this conference so far (other tests' conferences may be asked too)."""
        return [m.to for m in OUTBOX.outbox if m.kind == "feedback_request" and m.params["link"].endswith(came)]

    assert await feedback.send_feedback_requests() >= 1
    assert len(asked()) == 1
    await feedback.send_feedback_requests()
    assert len(asked()) == 1  # never twice
