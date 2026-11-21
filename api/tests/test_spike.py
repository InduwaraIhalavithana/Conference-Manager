from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from pymongo.errors import DuplicateKeyError

from app.models import Conference, LocalizedText

LIST_QUERY = "{ conferences { slug city title { en si ta } startsAt } }"
ONE_QUERY = "query($s: String!) { conference(slug: $s) { slug } }"


async def test_health_reports_mongo(client: AsyncClient) -> None:
    res = await client.get("/health")
    assert res.json() == {"status": "ok", "mongo": "ok"}


async def test_graphql_returns_published_conferences_soonest_first(client: AsyncClient) -> None:
    await Conference(
        slug="t-later",
        status="published",
        title=LocalizedText(en="Later"),
        city="Kandy",
        starts_at=datetime(2027, 6, 1, tzinfo=UTC),
    ).insert()
    await Conference(
        slug="t-sooner",
        status="published",
        title=LocalizedText(en="Sooner", si="ඉක්මනින්"),
        city="Colombo",
        starts_at=datetime(2027, 5, 1, tzinfo=UTC),
    ).insert()
    await Conference(
        slug="t-draft",
        title=LocalizedText(en="Hidden"),
        city="Galle",
        starts_at=datetime(2027, 4, 1, tzinfo=UTC),
    ).insert()

    body = (await client.post("/graphql", json={"query": LIST_QUERY})).json()

    assert "errors" not in body
    confs = body["data"]["conferences"]
    assert [c["slug"] for c in confs] == ["t-sooner", "t-later"]
    assert confs[0]["title"] == {"en": "Sooner", "si": "ඉක්මනින්", "ta": None}


async def test_conference_by_slug_hides_drafts(client: AsyncClient) -> None:
    found = (await client.post("/graphql", json={"query": ONE_QUERY, "variables": {"s": "t-sooner"}})).json()
    hidden = (await client.post("/graphql", json={"query": ONE_QUERY, "variables": {"s": "t-draft"}})).json()
    assert found["data"]["conference"] == {"slug": "t-sooner"}
    assert hidden["data"]["conference"] is None


async def test_slug_is_unique(client: AsyncClient) -> None:
    with pytest.raises(DuplicateKeyError):
        await Conference(
            slug="t-later",
            title=LocalizedText(en="Dup"),
            city="X",
            starts_at=datetime(2027, 1, 1, tzinfo=UTC),
        ).insert()
