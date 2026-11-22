"""Home-page numbers."""

from app.db import redis
from tests.conftest import Api, sign_in_organizer
from tests.test_conferences import create_published
from tests.test_registrations import confirmed

STATS = "{ platformStats { upcomingConferences registeredAttendees organizers registrationsThisWeek speakers } }"
TOPICS = "{ upcomingCategories { category count } upcomingCities(first: 50) { city count } }"


async def test_platform_numbers_and_topics(api: Api, other_api: Api) -> None:
    await redis.client().delete(redis.key("cache", "platform_stats"))
    before = (await other_api.gql(STATS))["data"]["platformStats"]

    await sign_in_organizer(api)
    conf = await create_published(api, city="Kurunegala", category="HEALTH")
    await confirmed(other_api, conf["slug"])

    cached = (await other_api.gql(STATS))["data"]["platformStats"]
    assert cached == before  # served from the one-minute cache
    await redis.client().delete(redis.key("cache", "platform_stats"))
    after = (await other_api.gql(STATS))["data"]["platformStats"]
    assert after["upcomingConferences"] == before["upcomingConferences"] + 1
    assert after["registeredAttendees"] == before["registeredAttendees"] + 1
    assert after["registrationsThisWeek"] == before["registrationsThisWeek"] + 1
    assert after["organizers"] >= 1

    data = (await other_api.gql(TOPICS))["data"]
    assert {"category": "HEALTH", "count": 1} in data["upcomingCategories"] or any(
        c["category"] == "HEALTH" and c["count"] >= 1 for c in data["upcomingCategories"]
    )
    assert any(c["city"] == "Kurunegala" for c in data["upcomingCities"])
