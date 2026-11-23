"""Live Q&A: who can ask and vote, votes counted once, moderation, closing, and the live signal."""

import asyncio
from typing import Any

from app.services import questions
from tests.conftest import Api, sign_in_organizer
from tests.test_feedback import with_sessions
from tests.test_registrations import conference, confirmed, register

BOARD = """query($t: String!, $s: ID) { liveQuestions(ticketCode: $t, sessionId: $s) { __typename
  ... on QaBoard { open sessionId sessions { id questions } questions { id text authorName votes status votedByMe mine } }
  ... on UserError { code } } }"""
ASK = """mutation($t: String!, $s: ID!, $q: String!) { askQuestion(ticketCode: $t, sessionId: $s, text: $q) {
  __typename ... on LiveQuestion { id text authorName votes mine } ... on UserError { code field } } }"""
VOTE = """mutation($t: String!, $id: ID!, $on: Boolean!) { voteQuestion(ticketCode: $t, questionId: $id, voted: $on) {
  __typename ... on LiveQuestion { votes votedByMe } ... on UserError { code } } }"""
MODERATE = """mutation($id: ID!, $s: QuestionStatus!) { setQuestionStatus(questionId: $id, status: $s) {
  __typename ... on ModeratedQuestion { status answeredAt } ... on UserError { code } } }"""
ALL = """query($c: ID!, $s: ID!) { sessionQuestions(conferenceId: $c, sessionId: $s) { __typename
  ... on SessionQuestions { questions { text status votes } } ... on UserError { code } } }"""


async def setup(api: Api, other_api: Api) -> tuple[dict[str, Any], str, str, str, str]:
    """A conference with two sessions and two confirmed ticket holders: (conf, session, other_session, t1, t2)."""
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    past, later = await with_sessions(conf["id"])
    first = await confirmed(other_api, conf["slug"])
    second = await confirmed(other_api, conf["slug"])
    return conf, later, past, first, second


async def ask(api: Api, ticket: str, session: str, text: str) -> Any:
    return (await api.gql(ASK, {"t": ticket, "s": session, "q": text}))["data"]["askQuestion"]


async def test_ticket_holders_ask_and_see_questions_at_once(api: Api, other_api: Api) -> None:
    conf, session, _, ticket, other = await setup(api, other_api)
    q = await ask(other_api, ticket, session, "  Will the   slides be shared?  ")
    assert q["text"] == "Will the slides be shared?" and q["authorName"] == "Nimal" and q["mine"] is True

    board = (await other_api.gql(BOARD, {"t": other}))["data"]["liveQuestions"]  # no session: the next one
    assert board["open"] is True and board["sessionId"] == session
    assert [(x["text"], x["mine"]) for x in board["questions"]] == [("Will the slides be shared?", False)]
    assert {s["id"]: s["questions"] for s in board["sessions"]}[session] == 1

    assert (await ask(other_api, ticket, session, "ok"))["field"] == "text"
    assert (await ask(other_api, ticket, "nope", "A real question"))["code"] == "NOT_FOUND"
    unconfirmed = (await register(other_api, conf["slug"]))["ticketCode"]
    assert (await ask(other_api, unconfirmed, session, "Can I ask?"))["code"] == "QA_TICKET_REQUIRED"


async def test_votes_count_once_and_not_for_your_own(api: Api, other_api: Api) -> None:
    _, session, _, ticket, other = await setup(api, other_api)
    first = await ask(other_api, ticket, session, "First question here")
    second = await ask(other_api, ticket, session, "Second question here")

    for _ in range(2):  # a double click still counts one vote
        res = (await other_api.gql(VOTE, {"t": other, "id": second["id"], "on": True}))["data"]["voteQuestion"]
    assert res == {"__typename": "LiveQuestion", "votes": 1, "votedByMe": True}
    own = (await other_api.gql(VOTE, {"t": ticket, "id": first["id"], "on": True}))["data"]["voteQuestion"]
    assert own["code"] == "INVALID_STATE"

    board = (await other_api.gql(BOARD, {"t": other, "s": session}))["data"]["liveQuestions"]
    assert [x["text"] for x in board["questions"]] == [
        "Second question here",
        "First question here",
    ]  # most votes first

    res = (await other_api.gql(VOTE, {"t": other, "id": second["id"], "on": False}))["data"]["voteQuestion"]
    assert res["votes"] == 0 and res["votedByMe"] is False


async def test_the_organizer_answers_and_hides(api: Api, other_api: Api) -> None:
    conf, session, _, ticket, _ = await setup(api, other_api)
    keep = await ask(other_api, ticket, session, "A good question")
    rude = await ask(other_api, ticket, session, "Something rude")

    assert (await api.gql(MODERATE, {"id": keep["id"], "s": "ANSWERED"}))["data"]["setQuestionStatus"]["answeredAt"]
    assert (await api.gql(MODERATE, {"id": rude["id"], "s": "HIDDEN"}))["data"]["setQuestionStatus"][
        "status"
    ] == "HIDDEN"

    board = (await other_api.gql(BOARD, {"t": ticket, "s": session}))["data"]["liveQuestions"]
    assert [(x["text"], x["status"]) for x in board["questions"]] == [("A good question", "ANSWERED")]
    everything = (await api.gql(ALL, {"c": conf["id"], "s": session}))["data"]["sessionQuestions"]["questions"]
    assert {x["status"] for x in everything} == {"ANSWERED", "HIDDEN"}
    hidden_vote = (await other_api.gql(VOTE, {"t": ticket, "id": rude["id"], "on": True}))["data"]["voteQuestion"]
    assert hidden_vote["code"] == "NOT_FOUND"

    await sign_in_organizer(other_api, "Other")  # not their conference: it looks missing
    assert (await other_api.gql(MODERATE, {"id": keep["id"], "s": "OPEN"}))["data"]["setQuestionStatus"][
        "code"
    ] == "NOT_FOUND"
    assert (await other_api.gql(ALL, {"c": conf["id"], "s": session}))["data"]["sessionQuestions"][
        "code"
    ] == "NOT_FOUND"


async def test_after_the_conference_the_board_is_read_only(api: Api, other_api: Api) -> None:
    conf, session, _, ticket, _ = await setup(api, other_api)
    await ask(other_api, ticket, session, "Asked in time")
    await with_sessions(conf["id"], ended_days_ago=1)
    board = (await other_api.gql(BOARD, {"t": ticket}))["data"]["liveQuestions"]
    assert board["open"] is False
    assert (await ask(other_api, ticket, board["sessionId"], "Too late now"))["code"] == "QA_CLOSED"


async def test_every_change_sends_a_signal_without_content(api: Api, other_api: Api) -> None:
    conf, session, _, ticket, _ = await setup(api, other_api)
    received: list[dict[str, Any]] = []

    async def page() -> None:
        async for event in questions.signals(conf["id"], heartbeat=0.2):
            if event["type"] != "ping":
                received.append(event)
                return

    listening = asyncio.create_task(page())
    await asyncio.sleep(0.3)
    await ask(other_api, ticket, session, "Is this live?")
    await asyncio.wait_for(listening, timeout=5)
    assert received == [{"type": "questions", "sessionId": session}]

    assert (await other_api.http.get("/conferences/000000000000000000000000/qa-live")).status_code == 404
