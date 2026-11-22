"""The signed-in person's own account: profile, other devices, notifications."""

from datetime import timedelta

from app.models import ActorRef, Notification, Organizer
from app.models.common import utcnow
from app.services import uploads
from tests.conftest import Api, sign_in_organizer
from tests.test_uploads import image_bytes, upload

ME = "{ me { ... on Organizer { firstName lastName phone organization avatarUrl lang bio { en si ta } } } }"
UPDATE = """mutation($i: ProfileInput!) { updateProfile(input: $i) {
  __typename ... on Organizer { firstName organization avatarUrl bio { en si } } ... on UserError { code field } } }"""
NOTES = """query($first: Int!, $after: String) { notifications(first: $first, after: $after) {
  __typename ... on NotificationPage { unread hasNextPage endCursor items { id kind params link read } } } }"""
UNREAD = "{ unreadNotifications { __typename ... on UnreadCount { unread } } }"
MARK = """mutation($ids: [ID!]) { markNotificationsRead(ids: $ids) {
  __typename ... on UnreadCount { unread } ... on UserError { code } } }"""


async def test_organizer_updates_their_profile_with_a_photo(api: Api) -> None:
    await sign_in_organizer(api, "Nimal")
    status, body = await upload(api, "avatar", image_bytes(size=(900, 700)))
    assert status == 200 and body["url"].startswith("/uploads/avatars/")
    profile = {
        "firstName": " Nimal ",
        "lastName": "Silva",
        "organization": "  ",
        "phone": "+94 77 123 4567",
        "avatarUrl": body["url"],
        "bio": {"en": "Runs community tech meetups.", "si": "", "ta": None},
        "lang": "si",
    }
    result = (await api.gql(UPDATE, {"i": profile}))["data"]["updateProfile"]
    assert result == {
        "__typename": "Organizer",
        "firstName": "Nimal",
        "organization": None,
        "avatarUrl": body["url"],
        "bio": {"en": "Runs community tech meetups.", "si": None},
    }
    me = (await api.gql(ME))["data"]["me"]
    assert me["lang"] == "si" and me["phone"] == "+94 77 123 4567"

    # The photo is kept by the nightly clean-up because a profile uses it.
    await uploads.delete_unused_before(utcnow() + timedelta(days=1))
    assert (uploads.upload_root() / body["url"].removeprefix("/uploads/")).is_file()


async def test_profile_rejects_bad_input_and_foreign_images(api: Api) -> None:
    await sign_in_organizer(api, "Kamal")
    base = {"firstName": "Kamal", "lastName": "Perera"}
    bad_name = (await api.gql(UPDATE, {"i": {**base, "firstName": "  "}}))["data"]["updateProfile"]
    assert bad_name == {"__typename": "UserError", "code": "VALIDATION", "field": "first_name"}
    bad_phone = (await api.gql(UPDATE, {"i": {**base, "phone": "call me"}}))["data"]["updateProfile"]
    assert bad_phone["field"] == "phone"
    foreign = (await api.gql(UPDATE, {"i": {**base, "avatarUrl": "https://evil.example/x.png"}}))["data"]
    assert foreign["updateProfile"]["code"] == "VALIDATION"
    cover_as_avatar_status, cover = await upload(api, "cover", image_bytes())
    assert cover_as_avatar_status == 200
    wrong_folder = (await api.gql(UPDATE, {"i": {**base, "avatarUrl": cover["url"]}}))["data"]["updateProfile"]
    assert wrong_folder["code"] == "VALIDATION"


async def test_profile_needs_an_organizer(api: Api) -> None:
    result = (await api.gql(UPDATE, {"i": {"firstName": "A", "lastName": "B"}}))["data"]["updateProfile"]
    assert result["code"] == "NOT_AUTHENTICATED"


async def test_sign_out_other_devices_keeps_this_one(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Dilani")
    login = """mutation($e: String!, $p: String!) { login(email: $e, password: $p) { __typename } }"""
    assert (await other_api.gql(login, {"e": email, "p": "Str0ng-enough-pass"}))["data"]["login"][
        "__typename"
    ] == "SignedIn"
    assert (await other_api.gql(ME))["data"]["me"] is not None

    done = (await api.gql("mutation { signOutOtherDevices { __typename } }"))["data"]["signOutOtherDevices"]
    assert done["__typename"] == "Done"
    assert (await api.gql(ME))["data"]["me"] is not None
    # The other device's access token may live for a few minutes, but its session can no longer refresh.
    refreshed = (await other_api.gql("mutation { refresh { __typename } }"))["data"]["refresh"]
    assert refreshed["__typename"] == "UserError"


async def test_notifications_are_paged_counted_and_marked_read(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Ruwan")
    organizer = await Organizer.find_one({"email": email})
    assert organizer is not None and organizer.id is not None
    me = ActorRef(type="organizer", id=organizer.id)
    await Notification.insert_many(
        [
            Notification(recipient=me, kind="new_registration", params={"name": f"P{i}", "title": "Day"})
            for i in range(5)
        ]
    )
    page1 = (await api.gql(NOTES, {"first": 3}))["data"]["notifications"]
    assert page1["unread"] == 5 and page1["hasNextPage"] and len(page1["items"]) == 3
    assert [n["params"]["name"] for n in page1["items"]] == ["P4", "P3", "P2"]
    page2 = (await api.gql(NOTES, {"first": 3, "after": page1["endCursor"]}))["data"]["notifications"]
    assert [n["params"]["name"] for n in page2["items"]] == ["P1", "P0"] and not page2["hasNextPage"]

    one = (await api.gql(MARK, {"ids": [page1["items"][0]["id"]]}))["data"]["markNotificationsRead"]
    assert one == {"__typename": "UnreadCount", "unread": 4}

    # Someone else cannot read or mark these.
    await sign_in_organizer(other_api, "Other")
    assert (await other_api.gql(NOTES, {"first": 10}))["data"]["notifications"]["items"] == []
    assert (await other_api.gql(MARK, {"ids": [page1["items"][1]["id"]]}))["data"]["markNotificationsRead"][
        "unread"
    ] == 0
    assert (await api.gql(UNREAD))["data"]["unreadNotifications"]["unread"] == 4

    everything = (await api.gql(MARK, {}))["data"]["markNotificationsRead"]
    assert everything["unread"] == 0
    assert (await api.gql(MARK, {"ids": ["not-an-id"]}))["data"]["markNotificationsRead"]["code"] == "VALIDATION"


async def test_notifications_need_sign_in(api: Api) -> None:
    assert (await api.gql(UNREAD))["data"]["unreadNotifications"]["__typename"] == "UserError"
