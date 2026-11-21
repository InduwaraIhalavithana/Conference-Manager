"""Tests run against the real MongoDB from docker-compose.dev.yml, in a throw-away database."""

import os
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

os.environ["MONGO_DB"] = f"cm_test_{uuid.uuid4().hex[:8]}"

from app.main import app  # noqa: E402
from app.settings import get_settings  # noqa: E402


@pytest.fixture(scope="session")
async def client() -> AsyncIterator[AsyncClient]:
    settings = get_settings()
    async with (
        app.router.lifespan_context(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c,
    ):
        yield c
    mongo: AsyncMongoClient[dict[str, Any]] = AsyncMongoClient(settings.mongo_url)
    await mongo.drop_database(settings.mongo_db)
    await mongo.close()
