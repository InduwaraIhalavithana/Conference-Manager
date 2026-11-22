"""The admin area: who may use it, organizer accounts, hiding conferences, the inbox, feedback, the activity
log and the System card."""

from typing import Any

from app.models import Conference, ContactMessage, Notification, Organizer, Registration
from app.services import system
from tests.conftest import ADMIN_PASSWORD, OUTBOX, Api, sign_in_organizer
from tests.test_registrations import conference, confirmed

ADMIN_LOGIN = "mutation($e: String!, $p: String!) { adminLogin(email: $e, password: $p) { __typename } }"
OVERVIEW = "{ adminOverview { __typename ... on AdminOverview { organizersActive organizersSuspended conferencesUpcoming conferencesHidden contactsOpen feedbackOpen } ... on UserError { code } } }"
ORGANIZERS = """query($q: String, $s: OrganizerFilter!) { adminOrganizers(q: $q, status: $s) {
  __typename ... on AdminOrganizerPage { total items { suspended conferences organizer { id email } } } ... on UserError { code } } }"""
SUSPEND = "mutation($id: ID!) { suspendOrganizer(id: $id) { __typename ... on AdminOrganizer { suspended } ... on UserError { code } } }"
RESTORE = "mutation($id: ID!) { restoreOrganizer(id: $id) { __typename ... on AdminOrganizer { suspended } ... on UserError { code } } }"
DELETE = "mutation($id: ID!) { deleteOrganizer(id: $id) { __typename ... on Removed { registrations conferences } ... on UserError { code } } }"
HIDE = "mutation($id: ID!, $h: Boolean!) { setConferenceHidden(id: $id, hidden: $h) { __typename ... on AdminConference { hidden hiddenReason } ... on UserError { code } } }"
CONFERENCES = """query($q: String) { adminConferences(q: $q) { __typename ... on AdminConferencePage { total items { id title organizerEmail hidden } } } }"""
CONTACTS = "{ contactMessages(status: OPEN) { __typename ... on ContactPage { total items { id email topic } } } }"
REPLY_CONTACT = "mutation($id: ID!, $m: String!) { replyToContact(id: $id, message: $m) { __typename ... on ContactMessage { status } ... on UserError { code field } } }"
SEND_FEEDBACK = "mutation($s: String!, $m: String!) { sendFeedback(subject: $s, message: $m) { __typename ... on FeedbackItem { id status } ... on UserError { code field } } }"
ADMIN_FEEDBACK = (
    "{ adminFeedback(status: OPEN) { __typename ... on FeedbackPage { total items { id subject organizerEmail } } } }"
)
REPLY_FEEDBACK = "mutation($id: ID!, $r: String!) { replyToFeedback(id: $id, reply: $r) { __typename ... on FeedbackItem { status reply } ... on UserError { code } } }"
MY_FEEDBACK = "{ myFeedback { __typename ... on FeedbackList { items { subject status reply } } } }"
ACTIVITY = """query($a: String) { activityLog(action: $a) { __typename ... on ActivityPage { total actions items { actorType actorName action target } } } }"""
SYSTEM = "{ systemStatus { __typename ... on SystemStatus { mongo redis workerRunning queueLength jobs { name ok } } ... on UserError { code } } }"
PUBLIC = "query($q: String!) { conferences(filter: { q: $q }) { edges { node { slug } } } }"


async def sign_in_admin(api: Api) -> None:
    assert (await api.gql(ADMIN_LOGIN, {"e": "admin", "p": ADMIN_PASSWORD}))["data"]["adminLogin"][
        "__typename"
    ] == "SignedIn"


async def organizer_id(email: str) -> str:
    found = await Organizer.find_one({"email": email})
    assert found is not None
    return str(found.id)


async def test_only_admins_get_in(api: Api, other_api: Api) -> None:
    assert (await api.gql(OVERVIEW))["data"]["adminOverview"]["code"] == "NOT_AUTHENTICATED"
    await sign_in_organizer(api)
    for query in (OVERVIEW, SYSTEM):
        result = next(iter((await api.gql(query))["data"].values()))
        assert result["code"] == "FORBIDDEN"
    assert (await api.gql(SUSPEND, {"id": "0" * 24}))["data"]["suspendOrganizer"]["code"] == "FORBIDDEN"
    assert (await api.http.get("/metrics")).status_code == 403
    await sign_in_admin(other_api)
    metrics = await other_api.http.get("/metrics")
    assert metrics.status_code == 200 and 'conferencehub_up{service="mongo"} 1' in metrics.text


async def test_suspending_hides_conferences_until_restored(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Suspendable")
    shown = await conference(api, capacity=5)
    by_hand = await conference(api, capacity=5)
    await sign_in_admin(other_api)
    assert (await other_api.gql(HIDE, {"id": by_hand["id"], "h": True}))["data"]["setConferenceHidden"] == {
        "__typename": "AdminConference", "hidden": True, "hiddenReason": "admin",
    }  # fmt: skip
    oid = await organizer_id(email)

    assert (await other_api.gql(SUSPEND, {"id": oid}))["data"]["suspendOrganizer"]["suspended"] is True
    assert (await api.gql("{ me { __typename } }"))["data"]["me"] is None  # signed out everywhere
    assert (await Conference.get(shown["id"])).hidden_reason == "suspended"  # type: ignore[union-attr]
    found = await other_api.gql(ORGANIZERS, {"q": "suspendable", "s": "SUSPENDED"})
    assert [i["organizer"]["email"] for i in found["data"]["adminOrganizers"]["items"]] == [email]
    assert found["data"]["adminOrganizers"]["items"][0]["conferences"] == 2

    assert (await other_api.gql(RESTORE, {"id": oid}))["data"]["restoreOrganizer"]["suspended"] is False
    assert (await Conference.get(shown["id"])).hidden is False  # type: ignore[union-attr]
    # The one hidden by hand stays hidden: restoring only undoes what the suspension did.
    assert (await Conference.get(by_hand["id"])).hidden is True  # type: ignore[union-attr]
    owner = await Conference.get(shown["id"])
    assert owner is not None
    assert await Notification.find_one({"kind": "account_restored", "recipient.id": owner.organizer_id}) is not None
    assert await Notification.find_one({"kind": "conference_removed"}) is not None


async def test_hidden_conferences_leave_the_public_list(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api, "Hider")
    conf = await conference(api, capacity=5)
    slug_part = conf["slug"].split("-")[0]
    assert any(
        e["node"]["slug"] == conf["slug"]
        for e in (await other_api.gql(PUBLIC, {"q": slug_part}))["data"]["conferences"]["edges"]
    )
    await sign_in_admin(other_api)
    await other_api.gql(HIDE, {"id": conf["id"], "h": True})
    assert all(
        e["node"]["slug"] != conf["slug"]
        for e in (await other_api.gql(PUBLIC, {"q": slug_part}))["data"]["conferences"]["edges"]
    )
    listed = (await other_api.gql(CONFERENCES, {"q": conf["slug"]}))["data"]["adminConferences"]
    assert listed["total"] == 1 and listed["items"][0]["hidden"] is True


async def test_deleting_an_organizer_removes_their_data_and_tells_attendees(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Leaving")
    conf = await conference(api, capacity=5)
    attendee = "attendee.leaving@example.com"
    await confirmed(other_api, conf["slug"], attendee)
    await sign_in_admin(other_api)
    removed = (await other_api.gql(DELETE, {"id": await organizer_id(email)}))["data"]["deleteOrganizer"]
    assert removed == {"__typename": "Removed", "registrations": 1, "conferences": 1}
    assert await Organizer.find_one({"email": email}) is None
    assert await Registration.find({"email": attendee}).count() == 0
    assert OUTBOX.last_to(attendee, "conference_cancelled")


async def test_contact_inbox_reply_is_emailed(api: Api, other_api: Api) -> None:
    contact = """mutation($i: ContactInput!) { sendContactMessage(input: $i) { __typename } }"""
    sender = "writer.inbox@example.com"
    await api.gql(
        contact,
        {"i": {"name": "Writer", "email": sender, "topic": "TECHNICAL", "message": "The map does not load for me."}},
    )
    await sign_in_admin(other_api)
    items = (await other_api.gql(CONTACTS))["data"]["contactMessages"]["items"]
    mine = next(i for i in items if i["email"] == sender)
    assert mine["topic"] == "technical"
    bad = (await other_api.gql(REPLY_CONTACT, {"id": mine["id"], "m": " "}))["data"]["replyToContact"]
    assert bad["code"] == "VALIDATION"
    done = (await other_api.gql(REPLY_CONTACT, {"id": mine["id"], "m": "Please try again now."}))["data"][
        "replyToContact"
    ]
    assert done == {"__typename": "ContactMessage", "status": "RESOLVED"}
    sent = OUTBOX.last_to(sender, "contact_reply")
    assert sent.params["quote"] == "Please try again now."
    assert (await ContactMessage.find_one({"email": sender})).status == "resolved"  # type: ignore[union-attr]


async def test_feedback_round_trip(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Asker")
    sent: dict[str, Any] = (await api.gql(SEND_FEEDBACK, {"s": "Map pins", "m": "Could the pin snap to roads?"}))[
        "data"
    ]["sendFeedback"]
    assert sent["status"] == "OPEN"
    assert (await api.gql(SEND_FEEDBACK, {"s": "x", "m": "short"}))["data"]["sendFeedback"]["code"] == "VALIDATION"
    assert await Notification.find_one({"kind": "new_feedback", "params.subject": "Map pins"}) is not None

    await sign_in_admin(other_api)
    open_items = (await other_api.gql(ADMIN_FEEDBACK))["data"]["adminFeedback"]["items"]
    item = next(i for i in open_items if i["organizerEmail"] == email)
    replied = (await other_api.gql(REPLY_FEEDBACK, {"id": item["id"], "r": "Good idea, noted."}))["data"][
        "replyToFeedback"
    ]
    assert replied == {"__typename": "FeedbackItem", "status": "REPLIED", "reply": "Good idea, noted."}
    assert OUTBOX.last_to(email, "feedback_reply").params["subject"] == "Map pins"
    mine = (await api.gql(MY_FEEDBACK))["data"]["myFeedback"]["items"]
    assert mine == [{"subject": "Map pins", "status": "REPLIED", "reply": "Good idea, noted."}]


async def test_activity_log_and_overview(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Logged")
    await sign_in_admin(other_api)
    await other_api.gql(SUSPEND, {"id": await organizer_id(email)})
    log = (await other_api.gql(ACTIVITY, {"a": "suspend_organizer"}))["data"]["activityLog"]
    assert log["items"][0] == {
        "actorType": "admin",
        "actorName": "admin",
        "action": "suspend_organizer",
        "target": email,
    }
    assert "suspend_organizer" in log["actions"]
    overview = (await other_api.gql(OVERVIEW))["data"]["adminOverview"]
    assert overview["__typename"] == "AdminOverview" and overview["organizersSuspended"] >= 1


async def test_system_status_shows_the_worker_and_jobs(api: Api) -> None:
    await sign_in_admin(api)
    await system.heartbeat()

    async def job() -> int:
        return 3

    assert await system.tracked("release_holds", job) == 3
    status = (await api.gql(SYSTEM))["data"]["systemStatus"]
    assert status["mongo"] and status["redis"] and status["workerRunning"]
    assert {"name": "release_holds", "ok": True} in status["jobs"]
    assert status["queueLength"] >= 0
