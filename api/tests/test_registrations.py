"""Registrations over GraphQL and the service: seats, holds, codes, waitlist, cancelling, check-in, and a
concurrency test proving a conference can never be overbooked."""

import asyncio
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from app.models import CheckInEvent, Conference, Notification, Registration
from app.repositories import conferences as conference_repo
from app.repositories import registrations as repo
from app.services import registrations as service
from tests.conftest import OUTBOX, Api, sign_in_organizer, unique_email
from tests.test_conferences import CANCEL, PUBLISH, UPDATE, conf_input

REGISTER = """mutation($slug: String!, $input: AttendeeInput!) {
  registerForConference(slug: $slug, input: $input) {
    __typename
    ... on Registered { ticketCode holdExpiresAt }
    ... on Waitlisted { ticketCode position }
    ... on AlreadyRegistered { email }
    ... on ConferenceFull { capacity }
    ... on UserError { code field }
  } }"""
CONFIRM = """mutation($t: String!, $c: String!) { confirmRegistration(ticketCode: $t, code: $c) {
  __typename ... on Ticket { status confirmed } ... on UserError { code remainingAttempts } } }"""
TICKET = """query($t: String!) { ticket(code: $t) {
  code name status confirmed waitlistPosition holdExpiresAt conference { slug seatsLeft counters { registered confirmed waitlisted } } } }"""
CANCEL_REG = "mutation($t: String!) { cancelRegistration(ticketCode: $t) { __typename ... on Ticket { status } ... on UserError { code } } }"
CHECK_IN = """mutation($c: ID!, $code: String!) { checkIn(conferenceId: $c, code: $code) {
  __typename ... on CheckedIn { attendee { name checkedInAt } } ... on AlreadyCheckedIn { checkedInAt } ... on UserError { code } } }"""
ATTENDEES = """query($c: ID!, $f: AttendeeFilter, $first: Int, $after: String) { attendees(conferenceId: $c, filter: $f, first: $first, after: $after) {
  __typename ... on AttendeeConnection { totalCount edges { cursor node { id name email status } } pageInfo { hasNextPage endCursor } }
  ... on UserError { code } } }"""


def ip() -> str:
    return f"172.16.{random.randint(0, 255)}.{random.randint(1, 254)}"


async def conference(api: Api, capacity: int, waitlist: bool = True) -> dict[str, Any]:
    """A published conference owned by the organizer signed in on `api`."""
    create = (
        """mutation($input: ConferenceInput!) { createConference(input: $input) { ... on Conference { id slug } } }"""
    )
    conf = (await api.gql(create, {"input": conf_input(capacity=capacity, waitlistEnabled=waitlist)}))["data"][
        "createConference"
    ]
    assert (await api.gql(PUBLISH, {"id": conf["id"]}))["data"]["publishConference"]["status"] == "PUBLISHED"
    return conf  # type: ignore[no-any-return]


async def register(api: Api, slug: str, email: str | None = None, name: str = "Nimal Silva") -> dict[str, Any]:
    data = {"name": name, "email": email or unique_email("att"), "lang": "SI"}
    return (await api.gql(REGISTER, {"slug": slug, "input": data}))["data"]["registerForConference"]  # type: ignore[no-any-return]


async def confirmed(api: Api, slug: str, email: str | None = None) -> str:
    """Register and confirm; returns the ticket code."""
    address = email or unique_email("att")
    res = await register(api, slug, address)
    code = OUTBOX.last_to(address).params["code"]
    assert (await api.gql(CONFIRM, {"t": res["ticketCode"], "c": code}))["data"]["confirmRegistration"][
        "status"
    ] == "REGISTERED"
    return res["ticketCode"]  # type: ignore[no-any-return]


async def counters(conference_id: str) -> dict[str, int]:
    doc = await conference_repo.by_id(conference_id)
    assert doc is not None
    return doc.counters.model_dump()


async def no_drift(conference_id: str) -> None:
    doc = await conference_repo.by_id(conference_id)
    assert doc is not None and doc.id is not None
    assert await repo.counts_by_status(doc.id) == doc.counters.model_dump()


# ── Registering and confirming ───────────────────────────────────────────────────────────────────────


async def test_register_holds_a_seat_until_the_code_is_entered(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=10)
    email = unique_email("att")
    res = await register(other_api, conf["slug"], email.upper())
    assert res["__typename"] == "Registered" and len(res["ticketCode"]) == 12

    message = OUTBOX.last_to(email, "confirm_seat")
    assert message.lang == "si" and message.params["hours"] == 24 and message.params["link"].endswith(res["ticketCode"])
    ticket = (await other_api.gql(TICKET, {"t": res["ticketCode"]}))["data"]["ticket"]
    assert ticket["status"] == "HELD" and ticket["confirmed"] is False
    hold = datetime.fromisoformat(ticket["holdExpiresAt"])
    assert timedelta(hours=23, minutes=59) < hold - datetime.now(UTC) <= timedelta(hours=24)
    assert ticket["conference"]["seatsLeft"] == 9

    wrong = "000000" if message.params["code"] != "000000" else "111111"
    bad = (await other_api.gql(CONFIRM, {"t": res["ticketCode"], "c": wrong}))["data"]["confirmRegistration"]
    assert bad == {"__typename": "UserError", "code": "CODE_INVALID", "remainingAttempts": 4}
    good = (await other_api.gql(CONFIRM, {"t": res["ticketCode"], "c": message.params["code"]}))["data"][
        "confirmRegistration"
    ]
    assert good == {"__typename": "Ticket", "status": "REGISTERED", "confirmed": True}
    assert OUTBOX.last_to(email, "ticket_confirmed")
    again = (await other_api.gql(CONFIRM, {"t": res["ticketCode"], "c": "999999"}))["data"]["confirmRegistration"]
    assert again["status"] == "REGISTERED"  # confirming twice is harmless

    assert await counters(conf["id"]) == {"registered": 1, "confirmed": 1, "waitlisted": 0, "checked_in": 0}
    note = await Notification.find_one({"kind": "new_registration", "params.name": "Nimal Silva"})
    assert note is not None
    await no_drift(conf["id"])


async def test_same_email_twice_resends_the_link_without_revealing_the_ticket(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=10)
    email = unique_email("att")
    first = await register(other_api, conf["slug"], email)
    second = await register(other_api, conf["slug"], f"  {email.upper()} ")
    assert second == {"__typename": "AlreadyRegistered", "email": email}
    assert OUTBOX.last_to(email, "ticket_link").params["link"].endswith(first["ticketCode"])
    assert await counters(conf["id"]) == {"registered": 1, "confirmed": 0, "waitlisted": 0, "checked_in": 0}


async def test_registration_rules(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=10)
    assert (await register(other_api, "no-such-conference"))["code"] == "NOT_FOUND"
    bad = await other_api.gql(REGISTER, {"slug": conf["slug"], "input": {"name": " ", "email": unique_email()}})
    assert bad["data"]["registerForConference"]["code"] == "VALIDATION"
    await api.gql(CANCEL, {"id": conf["id"]})
    assert (await register(other_api, conf["slug"]))["code"] == "REGISTRATION_CLOSED"

    ended = await conference(api, capacity=10)
    await Conference.get_pymongo_collection().update_one(
        {"slug": ended["slug"]}, {"$set": {"ends_at": datetime.now(UTC) - timedelta(hours=1)}}
    )
    assert (await register(other_api, ended["slug"]))["code"] == "REGISTRATION_CLOSED"


# ── Waitlist ─────────────────────────────────────────────────────────────────────────────────────────


async def test_full_conference_waitlists_and_promotes_the_oldest_confirmed(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=2)
    holders = [await confirmed(other_api, conf["slug"]) for _ in range(2)]

    unconfirmed_email, confirmed_email = unique_email("wait"), unique_email("wait")
    w1 = await register(other_api, conf["slug"], unconfirmed_email)
    w2 = await register(other_api, conf["slug"], confirmed_email)
    assert (w1["__typename"], w1["position"]) == ("Waitlisted", 1) and w2["position"] == 2
    assert OUTBOX.last_to(confirmed_email, "confirm_waitlist")
    code = OUTBOX.last_to(confirmed_email).params["code"]
    still = (await other_api.gql(CONFIRM, {"t": w2["ticketCode"], "c": code}))["data"]["confirmRegistration"]
    assert still == {"__typename": "Ticket", "status": "WAITLISTED", "confirmed": True}

    assert (await other_api.gql(CANCEL_REG, {"t": holders[0]}))["data"]["cancelRegistration"]["status"] == "CANCELLED"
    # The unconfirmed waitlister is skipped; the confirmed one gets the seat.
    first_ticket = (await other_api.gql(TICKET, {"t": w1["ticketCode"]}))["data"]["ticket"]
    second_ticket = (await other_api.gql(TICKET, {"t": w2["ticketCode"]}))["data"]["ticket"]
    assert first_ticket["status"] == "WAITLISTED" and first_ticket["waitlistPosition"] == 1
    assert second_ticket["status"] == "REGISTERED"
    assert OUTBOX.last_to(confirmed_email, "promoted")
    assert await counters(conf["id"]) == {"registered": 2, "confirmed": 2, "waitlisted": 1, "checked_in": 0}
    await no_drift(conf["id"])


async def test_no_waitlist_means_full(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=1, waitlist=False)
    await register(other_api, conf["slug"])
    assert await register(other_api, conf["slug"]) == {"__typename": "ConferenceFull", "capacity": 1}
    assert await counters(conf["id"]) == {"registered": 1, "confirmed": 0, "waitlisted": 0, "checked_in": 0}


async def test_expired_holds_are_released_and_seats_move_up(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=1)
    held = await register(other_api, conf["slug"])
    waiting_email = unique_email("wait")
    waiting = await register(other_api, conf["slug"], waiting_email)
    await other_api.gql(CONFIRM, {"t": waiting["ticketCode"], "c": OUTBOX.last_to(waiting_email).params["code"]})
    stale = await register(other_api, conf["slug"])  # unconfirmed waitlister

    past = datetime.now(UTC) - timedelta(minutes=1)
    await Registration.get_pymongo_collection().update_many(
        {"ticket_code": {"$in": [held["ticketCode"], stale["ticketCode"]]}}, {"$set": {"hold_expires_at": past}}
    )
    assert await service.release_expired_holds() >= 2
    statuses = {
        code: (await other_api.gql(TICKET, {"t": code}))["data"]["ticket"]["status"]
        for code in (held["ticketCode"], waiting["ticketCode"], stale["ticketCode"])
    }
    assert statuses == {
        held["ticketCode"]: "RELEASED",
        waiting["ticketCode"]: "REGISTERED",
        stale["ticketCode"]: "RELEASED",
    }
    assert await counters(conf["id"]) == {"registered": 1, "confirmed": 1, "waitlisted": 0, "checked_in": 0}
    await no_drift(conf["id"])


async def test_capacity_changes(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=2)
    for _ in range(2):
        await confirmed(other_api, conf["slug"])
    waiting = [await register(other_api, conf["slug"], e) for e in (unique_email("w"), unique_email("w"))]
    for w in waiting:
        ticket = (await other_api.gql(TICKET, {"t": w["ticketCode"]}))["data"]["ticket"]
        email_addr = (await repo.by_ticket(w["ticketCode"])).email  # type: ignore[union-attr]
        await other_api.gql(CONFIRM, {"t": w["ticketCode"], "c": OUTBOX.last_to(email_addr).params["code"]})
        assert ticket["status"] == "WAITLISTED"

    lower = (await api.gql(UPDATE, {"id": conf["id"], "input": conf_input(capacity=1)}))["data"]["updateConference"]
    assert lower["code"] == "CAPACITY_BELOW_TAKEN" and lower["field"] == "capacity"
    raised = (await api.gql(UPDATE, {"id": conf["id"], "input": conf_input(capacity=3)}))["data"]["updateConference"]
    assert raised["capacity"] == 3
    assert await counters(conf["id"]) == {"registered": 3, "confirmed": 3, "waitlisted": 1, "checked_in": 0}
    await no_drift(conf["id"])


# ── Cancelling ───────────────────────────────────────────────────────────────────────────────────────


async def test_cancel_frees_the_seat_and_is_final(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    code = await confirmed(other_api, conf["slug"])
    assert (await other_api.gql(CANCEL_REG, {"t": code}))["data"]["cancelRegistration"]["status"] == "CANCELLED"
    assert (await other_api.gql(CANCEL_REG, {"t": code}))["data"]["cancelRegistration"][
        "code"
    ] == "REGISTRATION_INACTIVE"
    assert await counters(conf["id"]) == {"registered": 0, "confirmed": 0, "waitlisted": 0, "checked_in": 0}
    # The same email can register again afterwards.
    email_addr = (await repo.by_ticket(code)).email  # type: ignore[union-attr]
    assert (await register(other_api, conf["slug"], email_addr))["__typename"] == "Registered"


async def test_cancelling_the_conference_emails_everyone_registered(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    emails = [unique_email("c") for _ in range(3)]
    for e in emails:
        await register(other_api, conf["slug"], e)
    await api.gql(CANCEL, {"id": conf["id"]})
    for e in emails:
        assert OUTBOX.last_to(e, "conference_cancelled")


# ── Organizer: attendees and check-in ────────────────────────────────────────────────────────────────


async def test_check_in_rules(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=2)
    good = await confirmed(other_api, conf["slug"])
    held = (await register(other_api, conf["slug"]))["ticketCode"]
    waiting = (await register(other_api, conf["slug"]))["ticketCode"]

    first = (await api.gql(CHECK_IN, {"c": conf["id"], "code": good.lower()}))["data"]["checkIn"]
    assert first["__typename"] == "CheckedIn" and first["attendee"]["name"] == "Nimal Silva"
    again = (await api.gql(CHECK_IN, {"c": conf["id"], "code": f"{good[:4]} {good[4:8]}-{good[8:]}"}))["data"][
        "checkIn"
    ]
    assert again["__typename"] == "AlreadyCheckedIn" and again["checkedInAt"] == first["attendee"]["checkedInAt"]
    assert (await api.gql(CHECK_IN, {"c": conf["id"], "code": held}))["data"]["checkIn"][
        "code"
    ] == "CHECKIN_UNCONFIRMED"
    assert (await api.gql(CHECK_IN, {"c": conf["id"], "code": waiting}))["data"]["checkIn"][
        "code"
    ] == "CHECKIN_WAITLISTED"
    assert (await api.gql(CHECK_IN, {"c": conf["id"], "code": "AAAAAAAAAAAA"}))["data"]["checkIn"][
        "code"
    ] == "NOT_FOUND"
    assert (await other_api.gql(CANCEL_REG, {"t": good}))["data"]["cancelRegistration"]["code"] == "INVALID_STATE"
    assert (await counters(conf["id"]))["checked_in"] == 1

    registration = await repo.by_ticket(good)
    assert registration is not None and registration.id is not None
    events = await CheckInEvent.find({"registration_id": registration.id}).to_list()
    assert len(events) == 1 and events[0].meta.conference_id == registration.conference_id

    undo = "mutation($c: ID!, $a: ID!) { undoCheckIn(conferenceId: $c, attendeeId: $a) { ... on Attendee { checkedInAt } } }"
    assert (await api.gql(undo, {"c": conf["id"], "a": str(registration.id)}))["data"]["undoCheckIn"][
        "checkedInAt"
    ] is None
    assert (await counters(conf["id"]))["checked_in"] == 0
    await no_drift(conf["id"])


async def test_only_the_owner_sees_attendees_and_checks_in(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api, "Owner")
    conf = await conference(api, capacity=5)
    code = await confirmed(other_api, conf["slug"])
    assert (await other_api.gql(ATTENDEES, {"c": conf["id"]}))["data"]["attendees"]["code"] == "NOT_AUTHENTICATED"
    await sign_in_organizer(other_api, "Rival")
    assert (await other_api.gql(ATTENDEES, {"c": conf["id"]}))["data"]["attendees"]["code"] == "NOT_FOUND"
    assert (await other_api.gql(CHECK_IN, {"c": conf["id"], "code": code}))["data"]["checkIn"]["code"] == "NOT_FOUND"
    # A ticket for another conference is not accepted at this desk.
    rival_conf = await conference(other_api, capacity=5)
    assert (await other_api.gql(CHECK_IN, {"c": rival_conf["id"], "code": code}))["data"]["checkIn"][
        "code"
    ] == "NOT_FOUND"


async def test_attendee_list_filters_and_pages(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=3)
    tag = uuid.uuid4().hex[:6]
    for i in range(3):
        await confirmed(other_api, conf["slug"], f"ok{i}.{tag}@example.com")
    await register(other_api, conf["slug"], f"late.{tag}@example.com", name="Late Comer")

    everyone = (await api.gql(ATTENDEES, {"c": conf["id"], "first": 2}))["data"]["attendees"]
    assert everyone["totalCount"] == 4 and len(everyone["edges"]) == 2 and everyone["pageInfo"]["hasNextPage"]
    rest = (await api.gql(ATTENDEES, {"c": conf["id"], "first": 2, "after": everyone["pageInfo"]["endCursor"]}))[
        "data"
    ]["attendees"]
    assert len(rest["edges"]) == 2 and not rest["pageInfo"]["hasNextPage"]
    names = [e["node"]["name"] for e in everyone["edges"] + rest["edges"]]
    assert names[-1] == "Late Comer"

    waiting = (await api.gql(ATTENDEES, {"c": conf["id"], "f": {"statuses": ["WAITLISTED"]}}))["data"]["attendees"]
    assert [e["node"]["email"] for e in waiting["edges"]] == [f"late.{tag}@example.com"]
    found = (await api.gql(ATTENDEES, {"c": conf["id"], "f": {"q": "LATE"}}))["data"]["attendees"]
    assert found["totalCount"] == 1


async def test_organizer_can_remove_an_attendee(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=1)
    seat = await confirmed(other_api, conf["slug"])
    waiting_email = unique_email("w")
    waiting = await register(other_api, conf["slug"], waiting_email)
    await other_api.gql(CONFIRM, {"t": waiting["ticketCode"], "c": OUTBOX.last_to(waiting_email).params["code"]})

    registration = await repo.by_ticket(seat)
    assert registration is not None
    remove = "mutation($c: ID!, $a: ID!) { removeAttendee(conferenceId: $c, attendeeId: $a) { ... on Attendee { status cancelledBy } } }"
    res = (await api.gql(remove, {"c": conf["id"], "a": str(registration.id)}))["data"]["removeAttendee"]
    assert res == {"status": "CANCELLED", "cancelledBy": "organizer"}
    assert OUTBOX.last_to(registration.email, "removed_by_organizer")
    assert (await other_api.gql(TICKET, {"t": waiting["ticketCode"]}))["data"]["ticket"]["status"] == "REGISTERED"
    await no_drift(conf["id"])


async def test_unknown_ticket_is_null(api: Api) -> None:
    assert (await api.gql(TICKET, {"t": "NOPE"}))["data"]["ticket"] is None


# ── Concurrency: the seat limit holds under load ─────────────────────────────────────────────────────


async def test_concurrent_registrations_never_overbook(api: Api) -> None:
    await sign_in_organizer(api)
    capacity, people = 25, 200
    conf = await conference(api, capacity=capacity)

    async def one(i: int) -> service.RegisterOutcome:
        return await service.register(ip(), conf["slug"], name=f"Person {i}", email=f"load{i}.{conf['id']}@example.com")

    outcomes = await asyncio.gather(*(one(i) for i in range(people)))
    seated = [o for o in outcomes if isinstance(o, service.Registered)]
    waiting = [o for o in outcomes if isinstance(o, service.Waitlisted)]
    assert len(seated) == capacity and len(waiting) == people - capacity
    assert await counters(conf["id"]) == {
        "registered": capacity,
        "confirmed": 0,
        "waitlisted": people - capacity,
        "checked_in": 0,
    }
    assert (
        await Registration.find({"conference_id": seated[0].registration.conference_id, "status": "held"}).count()
        == capacity
    )
    await no_drift(conf["id"])


async def test_the_same_email_at_the_same_moment_registers_once(api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=50)
    email = unique_email("twin")
    outcomes = await asyncio.gather(
        *(service.register(ip(), conf["slug"], name="Twin", email=email) for _ in range(10))
    )
    assert sum(isinstance(o, service.Registered) for o in outcomes) == 1
    assert all(isinstance(o, service.Registered | service.AlreadyRegistered) for o in outcomes)
    assert await counters(conf["id"]) == {"registered": 1, "confirmed": 0, "waitlisted": 0, "checked_in": 0}


async def test_concurrent_cancellations_promote_exactly_as_many(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=10)

    async def join(prefix: str) -> str:
        # Each person comes from their own address, as in real life (the rate limit is per IP).
        e = unique_email(prefix)
        outcome = await service.register(ip(), conf["slug"], name=prefix, email=e)
        assert isinstance(outcome, service.Registered | service.Waitlisted)
        await service.confirm(ip(), outcome.registration.ticket_code, OUTBOX.last_to(e).params["code"])
        return outcome.registration.ticket_code

    seats = [await join("seat") for _ in range(10)]
    for _ in range(15):
        await join("queue")

    await asyncio.gather(*(service.cancel(ip(), code) for code in seats[:6]))
    assert await counters(conf["id"]) == {"registered": 10, "confirmed": 10, "waitlisted": 9, "checked_in": 0}
    await no_drift(conf["id"])
    assert await Notification.find({"kind": "new_waitlister", "params.title": "Galle Literary Days"}).count() >= 15
