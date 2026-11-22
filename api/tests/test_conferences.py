"""Conferences and agenda over GraphQL: ownership, validation, publishing, agenda rules and public reads."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from app.models import Conference
from app.repositories import conferences as repo
from app.repositories import registrations as registration_repo
from tests.conftest import ADMIN_PASSWORD, Api, sign_in_organizer

SL = "+05:30"

CREATE = """mutation($input: ConferenceInput!) {
  createConference(input: $input) {
    __typename
    ... on Conference { id slug status days { date } publishProblems venue { city } }
    ... on UserError { code field message }
  }
}"""
UPDATE = """mutation($id: ID!, $input: ConferenceInput!) {
  updateConference(id: $id, input: $input) { __typename ... on Conference { id capacity days { date } } ... on UserError { code field message } }
}"""
PUBLISH = "mutation($id: ID!) { publishConference(id: $id) { __typename ... on Conference { status } ... on UserError { code message } } }"
UNPUBLISH = "mutation($id: ID!) { unpublishConference(id: $id) { __typename ... on Conference { status } ... on UserError { code } } }"
CANCEL = "mutation($id: ID!) { cancelConference(id: $id) { __typename ... on Conference { status } ... on UserError { code } } }"
DELETE = "mutation($id: ID!) { deleteConference(id: $id) { __typename ... on UserError { code } } }"
DUPLICATE = "mutation($id: ID!) { duplicateConference(id: $id) { __typename ... on Conference { id slug status sessions { title { en } } } } }"
PUBLIC = """query($slug: String!) { conference(slug: $slug) {
  slug status seatsLeft organizer { name organization } title { en si }
  sessions { title { en } room kind track { name { en } } speakers { name } }
} }"""
MINE = "{ myConferences { __typename ... on ConferenceList { items { slug status } } ... on UserError { code } } }"
UPSERT_SPEAKER = """mutation($c: ID!, $s: ID, $input: SpeakerInput!) {
  upsertSpeaker(conferenceId: $c, speakerId: $s, input: $input) { __typename ... on Speaker { id name } ... on UserError { code field } } }"""
UPSERT_TRACK = """mutation($c: ID!, $input: TrackInput!) {
  upsertTrack(conferenceId: $c, input: $input) { __typename ... on Track { id } ... on UserError { code } } }"""
UPSERT_SESSION = """mutation($c: ID!, $s: ID, $input: SessionInput!) {
  upsertSession(conferenceId: $c, sessionId: $s, input: $input) {
    __typename ... on AgendaSession { id day room speakers { name } track { id } } ... on UserError { code field message } } }"""


def day(offset: int, hour: int = 9, minute: int = 0) -> str:
    """An ISO time in Sri Lanka, `offset` days from today in Sri Lanka (which can be a different date than UTC)."""
    d = datetime.now(ZoneInfo("Asia/Colombo")).date() + timedelta(days=offset)
    return f"{d.isoformat()}T{hour:02d}:{minute:02d}:00{SL}"


def conf_input(**extra: Any) -> dict[str, Any]:
    data: dict[str, Any] = {
        "title": {"en": "Galle Literary Days", "si": "ගාල්ල සාහිත්‍ය දින"},
        "startsAt": day(40, 9),
        "endsAt": day(41, 17),
        "city": "Galle",
        "category": "ARTS",
        "tags": ["Books", "books", " poetry "],
    }
    data.update(extra)
    return data


async def create(api: Api, **extra: Any) -> dict[str, Any]:
    res = (await api.gql(CREATE, {"input": conf_input(**extra)}))["data"]["createConference"]
    assert res["__typename"] == "Conference", res
    return res  # type: ignore[no-any-return]


async def create_published(api: Api, **extra: Any) -> dict[str, Any]:
    conf = await create(api, capacity=100, **extra)
    assert (await api.gql(PUBLISH, {"id": conf["id"]}))["data"]["publishConference"]["status"] == "PUBLISHED"
    return conf


# ── Creating and publishing ──────────────────────────────────────────────────────────────────────────


async def test_create_makes_a_private_draft_with_its_days(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create(api)
    assert conf["status"] == "DRAFT"
    assert conf["slug"].startswith("galle-literary-days-")
    assert len(conf["days"]) == 2
    assert conf["publishProblems"] == ["set how many people can attend"]

    mine = (await api.gql(MINE))["data"]["myConferences"]["items"]
    assert {"slug": conf["slug"], "status": "DRAFT"} in mine
    assert (await other_api.gql(PUBLIC, {"slug": conf["slug"]}))["data"]["conference"] is None

    doc = await repo.by_slug(conf["slug"])
    assert doc is not None and doc.tags == ["books", "poetry"]


async def test_publish_needs_a_complete_conference(api: Api, other_api: Api) -> None:
    email = await sign_in_organizer(api, "Kamal")
    conf = await create(api)
    refused = (await api.gql(PUBLISH, {"id": conf["id"]}))["data"]["publishConference"]
    assert refused["code"] == "NOT_PUBLISHABLE" and "attend" in refused["message"]

    updated = (await api.gql(UPDATE, {"id": conf["id"], "input": conf_input(capacity=50)}))["data"]["updateConference"]
    assert updated["capacity"] == 50
    assert (await api.gql(PUBLISH, {"id": conf["id"]}))["data"]["publishConference"]["status"] == "PUBLISHED"

    public = (await other_api.gql(PUBLIC, {"slug": conf["slug"]}))["data"]["conference"]
    assert public["status"] == "PUBLISHED" and public["seatsLeft"] == 50
    assert public["organizer"] == {"name": "Kamal Perera", "organization": None}
    assert public["title"] == {"en": "Galle Literary Days", "si": "ගාල්ල සාහිත්‍ය දින"}
    assert email not in str(public)


@pytest.mark.parametrize(
    ("extra", "field"),
    [
        ({"startsAt": day(-2, 9), "endsAt": day(-1, 9)}, "startsAt"),
        ({"endsAt": day(39, 9)}, None),
        ({"endsAt": day(60, 9)}, "endsAt"),
        ({"latitude": 6.9}, None),
        ({"onlineUrl": "javascript:alert(1)"}, "online_url"),
        ({"title": {"si": "සිංහල පමණයි"}}, "title"),
        ({"capacity": 0}, "capacity"),
        ({"timezone": "Mars/Base"}, "timezone"),
    ],
)
async def test_create_rejects_bad_input(api: Api, extra: dict[str, Any], field: str | None) -> None:
    await sign_in_organizer(api)
    res = (await api.gql(CREATE, {"input": conf_input(**extra)}))["data"]["createConference"]
    assert res["code"] == "VALIDATION", res
    if field:
        assert res["field"].startswith(field) or res["field"] == field


async def test_only_organizers_create_and_only_owners_change(api: Api, other_api: Api) -> None:
    anonymous = (await api.gql(CREATE, {"input": conf_input()}))["data"]["createConference"]
    assert anonymous["code"] == "NOT_AUTHENTICATED"

    admin_login = "mutation($e: String!, $p: String!) { adminLogin(email: $e, password: $p) { __typename } }"
    await other_api.gql(admin_login, {"e": "admin", "p": ADMIN_PASSWORD})
    assert (await other_api.gql(CREATE, {"input": conf_input()}))["data"]["createConference"]["code"] == "FORBIDDEN"

    await sign_in_organizer(api, "Owner")
    conf = await create(api)
    other = Api(other_api.http)
    await other.gql("mutation { logout { ok } }")
    await sign_in_organizer(other, "Intruder")
    for mutation in (PUBLISH, CANCEL, DELETE, DUPLICATE):
        res = (await other.gql(mutation, {"id": conf["id"]}))["data"]
        assert next(iter(res.values()))["__typename"] != "Conference"
    assert (await other.gql(UPDATE, {"id": conf["id"], "input": conf_input()}))["data"]["updateConference"][
        "code"
    ] == "NOT_FOUND"
    mine_query = "query($id: ID!) { myConference(id: $id) { __typename ... on UserError { code } } }"
    assert (await other.gql(mine_query, {"id": conf["id"]}))["data"]["myConference"] == {
        "__typename": "UserError",
        "code": "NOT_FOUND",
    }


# ── Lifecycle ────────────────────────────────────────────────────────────────────────────────────────


async def test_unpublish_cancel_and_delete(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create_published(api)
    assert (await api.gql(UNPUBLISH, {"id": conf["id"]}))["data"]["unpublishConference"]["status"] == "DRAFT"
    assert (await api.gql(CANCEL, {"id": conf["id"]}))["data"]["cancelConference"]["code"] == "INVALID_STATE"
    await api.gql(PUBLISH, {"id": conf["id"]})
    assert (await api.gql(CANCEL, {"id": conf["id"]}))["data"]["cancelConference"]["status"] == "CANCELLED"

    public = (await other_api.gql(PUBLIC, {"slug": conf["slug"]}))["data"]["conference"]
    assert public["status"] == "CANCELLED"
    edit = (await api.gql(UPDATE, {"id": conf["id"], "input": conf_input(capacity=10)}))["data"]["updateConference"]
    assert edit["code"] == "INVALID_STATE"

    assert (await api.gql(DELETE, {"id": conf["id"]}))["data"]["deleteConference"]["__typename"] == "Done"
    assert await repo.by_id(conf["id"]) is None


async def test_registered_people_block_unpublish_and_delete(api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create_published(api)
    doc = await repo.by_id(conf["id"])
    assert doc is not None and doc.id is not None
    await registration_repo.bump(doc.id, registered=3)
    assert (await api.gql(UNPUBLISH, {"id": conf["id"]}))["data"]["unpublishConference"]["code"] == "INVALID_STATE"
    assert (await api.gql(DELETE, {"id": conf["id"]}))["data"]["deleteConference"]["code"] == "INVALID_STATE"


async def test_duplicate_makes_a_new_draft_with_the_agenda(api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create_published(api)
    session = {"title": {"en": "Opening"}, "startsAt": day(40, 9), "endsAt": day(40, 10)}
    await api.gql(UPSERT_SESSION, {"c": conf["id"], "input": session})
    copy = (await api.gql(DUPLICATE, {"id": conf["id"]}))["data"]["duplicateConference"]
    assert copy["status"] == "DRAFT" and copy["id"] != conf["id"] and copy["slug"] != conf["slug"]
    assert copy["sessions"] == [{"title": {"en": "Opening"}}]


async def test_two_editors_cannot_overwrite_each_other(api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create(api)
    first = await repo.by_id(conf["id"])
    second = await repo.by_id(conf["id"])
    assert first is not None and second is not None
    first.capacity = 10
    await repo.save(first)
    second.capacity = 20
    with pytest.raises(repo.StaleWriteError):
        await repo.save(second)


# ── Agenda ───────────────────────────────────────────────────────────────────────────────────────────


async def test_agenda_rules(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create_published(api)
    c = conf["id"]
    track = (await api.gql(UPSERT_TRACK, {"c": c, "input": {"name": {"en": "Poetry"}, "color": "#ff0066"}}))["data"][
        "upsertTrack"
    ]
    speaker = (
        await api.gql(UPSERT_SPEAKER, {"c": c, "input": {"name": "Ruwan Silva", "links": ["https://example.com"]}})
    )["data"]["upsertSpeaker"]
    assert speaker["__typename"] == "Speaker"

    talk = {"title": {"en": "Reading"}, "startsAt": day(40, 10), "endsAt": day(40, 11), "room": "Hall A",
            "trackId": track["id"], "speakerIds": [speaker["id"]]}  # fmt: skip
    first = (await api.gql(UPSERT_SESSION, {"c": c, "input": talk}))["data"]["upsertSession"]
    assert first["speakers"] == [{"name": "Ruwan Silva"}] and first["track"] == {"id": track["id"]}

    clash = {**talk, "title": {"en": "Clash"}, "startsAt": day(40, 10, 30), "endsAt": day(40, 11, 30), "room": "hall a"}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "input": clash}))["data"]["upsertSession"]["code"] == "SESSION_CLASH"
    other_room = {**clash, "room": "Hall B"}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "input": other_room}))["data"]["upsertSession"][
        "__typename"
    ] == "AgendaSession"
    # Editing a session does not clash with itself.
    moved = {**talk, "endsAt": day(40, 11, 15)}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "s": first["id"], "input": moved}))["data"]["upsertSession"][
        "__typename"
    ] == "AgendaSession"

    outside = {**talk, "startsAt": day(45, 10), "endsAt": day(45, 11), "room": None}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "input": outside}))["data"]["upsertSession"]["code"] == "VALIDATION"
    overnight = {**talk, "startsAt": day(40, 22), "endsAt": day(41, 1), "room": None}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "input": overnight}))["data"]["upsertSession"]["field"] == "endsAt"
    ghost = {**talk, "speakerIds": ["000000000000"], "room": None}
    assert (await api.gql(UPSERT_SESSION, {"c": c, "input": ghost}))["data"]["upsertSession"]["field"] == "speakerIds"

    # Moving the conference away from its sessions is refused.
    moved_conf = conf_input(capacity=100, startsAt=day(50, 9), endsAt=day(51, 17))
    assert (await api.gql(UPDATE, {"id": c, "input": moved_conf}))["data"]["updateConference"]["code"] == "VALIDATION"

    remove_speaker = "mutation($c: ID!, $s: ID!) { removeSpeaker(conferenceId: $c, speakerId: $s) { __typename } }"
    remove_track = "mutation($c: ID!, $t: ID!) { removeTrack(conferenceId: $c, trackId: $t) { __typename } }"
    await api.gql(remove_speaker, {"c": c, "s": speaker["id"]})
    await api.gql(remove_track, {"c": c, "t": track["id"]})
    public = (await other_api.gql(PUBLIC, {"slug": conf["slug"]}))["data"]["conference"]
    assert [s["title"]["en"] for s in public["sessions"]] == ["Reading", "Clash"]  # sorted by time
    assert all(s["speakers"] == [] and s["track"] is None for s in public["sessions"])


async def test_day_labels(api: Api) -> None:
    await sign_in_organizer(api)
    conf = await create(api)
    first_day = conf["days"][0]["date"]
    label = 'mutation($c: ID!, $d: Date!) { setDayLabel(conferenceId: $c, day: $d, label: {en: "Workshops", ta: "பட்டறைகள்"}) { __typename ... on Conference { days { date label { en ta } } } } }'
    res = (await api.gql(label, {"c": conf["id"], "d": first_day}))["data"]["setDayLabel"]
    assert res["days"][0]["label"] == {"en": "Workshops", "ta": "பட்டறைகள்"}


# ── Public browsing and search ───────────────────────────────────────────────────────────────────────

BROWSE = """query($f: ConferenceFilter, $first: Int, $after: String) {
  conferences(filter: $f, first: $first, after: $after) {
    edges { cursor node { slug distanceKm city organizer { name } } }
    pageInfo { hasNextPage endCursor }
  } }"""


async def browse(api: Api, **variables: Any) -> dict[str, Any]:
    return (await api.gql(BROWSE, variables))["data"]["conferences"]  # type: ignore[no-any-return]


def slugs(page: dict[str, Any]) -> list[str]:
    return [e["node"]["slug"] for e in page["edges"]]


async def test_text_search_in_three_languages_and_filters(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    word = f"zq{uuid.uuid4().hex[:6]}"
    a = await create_published(
        api, title={"en": f"Batik {word} fair", "ta": f"பாடிக் {word}"}, category="ARTS", city="Matara"
    )
    b = await create_published(api, title={"en": "Robotics day", "si": f"රොබෝ {word}"}, category="TECH", city="Jaffna")
    await create(api, title={"en": f"Draft {word}"}, capacity=5)  # drafts never show

    assert set(slugs(await browse(other_api, f={"q": word}))) == {a["slug"], b["slug"]}
    assert slugs(await browse(other_api, f={"q": word, "category": "TECH"})) == [b["slug"]]
    assert slugs(await browse(other_api, f={"q": word, "city": "matara"})) == [a["slug"]]


async def test_pagination_with_cursors(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    word = f"pg{uuid.uuid4().hex[:6]}"
    made = [
        await create_published(api, title={"en": f"Event {word} {i}"}, startsAt=day(30 + i, 9), endsAt=day(30 + i, 17))
        for i in range(3)
    ]
    first = await browse(other_api, f={"q": word}, first=2)
    assert slugs(first) == [made[0]["slug"], made[1]["slug"]] and first["pageInfo"]["hasNextPage"] is True
    rest = await browse(other_api, f={"q": word}, first=2, after=first["pageInfo"]["endCursor"])
    assert slugs(rest) == [made[2]["slug"]] and rest["pageInfo"]["hasNextPage"] is False
    assert (await browse(other_api, f={"q": word}, first=2, after="not-a-cursor"))["edges"]


async def test_near_me_orders_by_distance_and_respects_the_radius(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    # Somewhere in the southern Indian Ocean, so no other test's conferences are nearby.
    base_lat, base_lng = -40.0, 80.0
    near = await create_published(api, title={"en": "Near"}, latitude=base_lat + 0.05, longitude=base_lng)
    far = await create_published(api, title={"en": "Far"}, latitude=base_lat + 0.3, longitude=base_lng)
    await create_published(api, title={"en": "Out of range"}, latitude=base_lat + 2, longitude=base_lng)

    page = await browse(other_api, f={"near": {"latitude": base_lat, "longitude": base_lng, "radiusKm": 50}})
    assert slugs(page) == [near["slug"], far["slug"]]
    distances = [e["node"]["distanceKm"] for e in page["edges"]]
    assert 5 <= distances[0] <= 6 and 33 <= distances[1] <= 34

    second = await browse(other_api, f={"near": {"latitude": base_lat, "longitude": base_lng, "radiusKm": 50}}, first=1)
    after = await browse(
        other_api, f={"near": {"latitude": base_lat, "longitude": base_lng, "radiusKm": 50}}, first=1,
        after=second["pageInfo"]["endCursor"],
    )  # fmt: skip
    assert slugs(second) == [near["slug"]] and slugs(after) == [far["slug"]]


async def test_hidden_and_ended_conferences_are_not_listed(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    word = f"hd{uuid.uuid4().hex[:6]}"
    hidden = await create_published(api, title={"en": f"Hidden {word}"})
    ended = await create_published(api, title={"en": f"Ended {word}"})
    hidden_doc, ended_doc = await repo.by_id(hidden["id"]), await repo.by_id(ended["id"])
    assert hidden_doc is not None and ended_doc is not None
    hidden_doc.hidden = True
    await repo.save(hidden_doc)
    # A save never writes the seat counters back (they only change through atomic increments).
    await registration_repo.bump(hidden_doc.id, registered=2)  # type: ignore[arg-type]
    hidden_doc.title.en = f"Hidden {word} renamed"
    await repo.save(hidden_doc)
    reloaded = await repo.by_id(hidden["id"])
    assert reloaded is not None and reloaded.counters.registered == 2 and reloaded.title.en.endswith("renamed")
    await Conference.get_pymongo_collection().update_one(
        {"_id": ended_doc.id},
        {
            "$set": {
                "starts_at": datetime.now(UTC) - timedelta(days=3),
                "ends_at": datetime.now(UTC) - timedelta(days=2),
            }
        },
    )
    assert slugs(await browse(other_api, f={"q": word})) == []
    assert (await other_api.gql(PUBLIC, {"slug": hidden["slug"]}))["data"]["conference"] is None
    past = await browse(other_api, f={"q": word, "startsFrom": (datetime.now(UTC) - timedelta(days=10)).isoformat()})
    assert slugs(past) == [ended["slug"]]


async def test_organizer_names_come_from_one_batched_lookup(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api, "Batch")
    word = f"dl{uuid.uuid4().hex[:6]}"
    for i in range(3):
        await create_published(api, title={"en": f"Loader {word} {i}"})
    page = await browse(other_api, f={"q": word})
    assert {e["node"]["organizer"]["name"] for e in page["edges"]} == {"Batch Perera"}


async def test_past_conferences_are_listed_latest_first(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    word = f"ps{uuid.uuid4().hex[:6]}"
    made = [await create_published(api, title={"en": f"Old {word} {i}"}) for i in range(3)]
    for i, conf in enumerate(made):  # 30, 20 and 10 days ago
        await Conference.get_pymongo_collection().update_one(
            {"slug": conf["slug"]},
            {"$set": {"starts_at": datetime.now(UTC) - timedelta(days=30 - 10 * i, hours=8),
                      "ends_at": datetime.now(UTC) - timedelta(days=30 - 10 * i)}},
        )  # fmt: skip
    assert slugs(await browse(other_api, f={"q": word})) == []  # upcoming by default
    first = await browse(other_api, f={"q": word, "timeframe": "PAST"}, first=2)
    assert slugs(first) == [made[2]["slug"], made[1]["slug"]]
    rest = await browse(other_api, f={"q": word, "timeframe": "PAST"}, first=2, after=first["pageInfo"]["endCursor"])
    assert slugs(rest) == [made[0]["slug"]]
    assert len(slugs(await browse(other_api, f={"q": word, "timeframe": "ALL"}))) == 3
