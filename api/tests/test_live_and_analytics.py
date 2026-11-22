"""Offline scan times, live check-in events, and the organizer's analytics."""

import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any

from beanie import PydanticObjectId

from app.models import CheckInEvent
from app.services import live
from tests.conftest import Api, sign_in_organizer
from tests.test_registrations import CHECK_IN, conference, confirmed, register

CHECK_IN_AT = """mutation($c: ID!, $code: String!, $at: DateTime) { checkIn(conferenceId: $c, code: $code, scannedAt: $at) {
  __typename ... on CheckedIn { attendee { checkedInAt } } ... on UserError { code } } }"""
ANALYTICS = """query($c: ID!) { conferenceAnalytics(conferenceId: $c) {
  __typename
  ... on ConferenceAnalytics { registered confirmed waitlisted checkedIn capacity everConfirmed totalSignups
    byDay { day registered left waitlisted } arrivals { at count } byStatus { key count } byLanguage { key count } }
  ... on UserError { code } } }"""
OVERVIEW = """{ analyticsOverview(days: 30) { __typename
  ... on AnalyticsOverview { byDay { day registered } conferences { id title registered checkedIn capacity } }
  ... on UserError { code } } }"""


async def test_an_offline_scan_keeps_its_time_but_not_a_wrong_one(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    earlier = datetime.now(UTC) - timedelta(hours=2)
    first = await confirmed(other_api, conf["slug"])
    res = (await api.gql(CHECK_IN_AT, {"c": conf["id"], "code": first, "at": earlier.isoformat()}))["data"]["checkIn"]
    stored = datetime.fromisoformat(res["attendee"]["checkedInAt"])
    assert abs((stored - earlier).total_seconds()) < 1

    # A clock far in the future is not believed: the server time is used.
    second = await confirmed(other_api, conf["slug"])
    future = datetime.now(UTC) + timedelta(days=3)
    res = (await api.gql(CHECK_IN_AT, {"c": conf["id"], "code": second, "at": future.isoformat()}))["data"]["checkIn"]
    assert datetime.fromisoformat(res["attendee"]["checkedInAt"]) < datetime.now(UTC) + timedelta(minutes=1)
    events = await CheckInEvent.find({"meta.conference_id": PydanticObjectId(conf["id"])}).to_list()
    assert any(abs((e.at.replace(tzinfo=UTC) - earlier).total_seconds()) < 1 for e in events)


async def test_check_ins_are_published_to_open_desks(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    ticket = await confirmed(other_api, conf["slug"])
    received: list[dict[str, Any]] = []

    async def desk() -> None:
        async for event in live.events(conf["id"], heartbeat=0.2):
            if event["type"] != "ping":
                received.append(event)
                return

    listening = asyncio.create_task(desk())
    await asyncio.sleep(0.3)  # the desk is subscribed (it has sent at least one heartbeat)
    assert (await api.gql(CHECK_IN, {"c": conf["id"], "code": ticket}))["data"]["checkIn"]["__typename"] == "CheckedIn"
    await asyncio.wait_for(listening, timeout=5)
    assert received[0]["type"] == "checked_in" and received[0]["checkedIn"] == 1 and received[0]["name"]


async def test_the_live_stream_is_only_for_the_owner(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=5)
    assert (await other_api.http.get(f"/conferences/{conf['id']}/live")).json()["code"] == "not_authenticated"
    await sign_in_organizer(other_api, "Other")
    assert (await other_api.http.get(f"/conferences/{conf['id']}/live")).json()["code"] == "not_found"


async def test_conference_analytics(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await conference(api, capacity=2)
    tickets = [await confirmed(other_api, conf["slug"]) for _ in range(2)]
    await register(other_api, conf["slug"])  # waitlisted, not confirmed
    await api.gql(CHECK_IN, {"c": conf["id"], "code": tickets[0]})

    a = (await api.gql(ANALYTICS, {"c": conf["id"]}))["data"]["conferenceAnalytics"]
    assert a["__typename"] == "ConferenceAnalytics"
    assert (a["registered"], a["confirmed"], a["waitlisted"], a["checkedIn"], a["capacity"]) == (2, 2, 1, 1, 2)
    assert a["totalSignups"] == 3 and a["everConfirmed"] == 2
    assert sum(d["registered"] for d in a["byDay"]) == 3 and a["byDay"][-1]["waitlisted"] == 1
    assert sum(s["count"] for s in a["arrivals"]) == 1
    assert {s["key"]: s["count"] for s in a["byStatus"]} == {"registered": 2, "waitlisted": 1}
    assert a["byLanguage"] == [{"key": "si", "count": 3}]

    # Another organizer's conference looks like a missing one.
    await sign_in_organizer(other_api, "Snoop")
    assert (await other_api.gql(ANALYTICS, {"c": conf["id"]}))["data"]["conferenceAnalytics"]["code"] == "NOT_FOUND"

    overview = (await api.gql(OVERVIEW))["data"]["analyticsOverview"]
    assert [c["id"] for c in overview["conferences"]] == [conf["id"]]
    assert overview["conferences"][0]["registered"] == 2 and sum(d["registered"] for d in overview["byDay"]) == 3
