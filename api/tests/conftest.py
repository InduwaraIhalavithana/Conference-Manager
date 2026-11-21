"""Tests run against the real MongoDB and Redis from docker-compose.dev.yml, in a throw-away database and
Redis key prefix. Environment variables win over api/.env, so a developer's real secrets are never used."""

import os
import random
import tempfile
import uuid
from collections.abc import AsyncIterator
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from pymongo import AsyncMongoClient

RUN_ID = uuid.uuid4().hex[:8]
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "SECRET_KEY": "test-secret-key-that-is-long-enough-for-hs256-0123456789",
        "MONGO_DB": f"cm_test_{RUN_ID}",
        "REDIS_PREFIX": f"cm_test_{RUN_ID}",
        "ADMIN_EMAIL": "admin@example.com",
        # A throw-away password that only exists in this test database.
        "ADMIN_INITIAL_PASSWORD": "Test-only-admin-pass-1",
        "LOG_FORMAT": "console",
        "LOG_LEVEL": "WARNING",
        "SENTRY_DSN": "",
        "UPLOAD_DIR": tempfile.mkdtemp(prefix="cm3-test-uploads-"),
    }
)

from app.core.settings import get_settings  # noqa: E402
from app.db import redis as redis_db  # noqa: E402
from app.main import app  # noqa: E402
from app.services import email  # noqa: E402

ADMIN_PASSWORD = os.environ["ADMIN_INITIAL_PASSWORD"]
OUTBOX = email.MemoryEmailSender()
email.use_sender(OUTBOX)


@pytest.fixture(scope="session", autouse=True)
async def running_app() -> AsyncIterator[None]:
    settings = get_settings()
    async with app.router.lifespan_context(app):
        yield
        keys = [k async for k in redis_db.client().scan_iter(f"{settings.redis_prefix}:*")]
        if keys:
            await redis_db.client().delete(*keys)
    mongo: AsyncMongoClient[dict[str, Any]] = AsyncMongoClient(settings.mongo_url)
    await mongo.drop_database(settings.mongo_db)
    await mongo.close()


class Api:
    """A browser-like client: keeps cookies, sends the CSRF header, comes from its own IP address."""

    def __init__(self, client: AsyncClient) -> None:
        self.http = client

    async def gql(self, query: str, variables: dict[str, Any] | None = None, *, csrf: bool = True) -> dict[str, Any]:
        headers = {}
        if csrf:
            token = self.http.cookies.get("cm_csrf")
            if token is None:
                token = (await self.http.get("/auth/csrf")).json()["csrfToken"]
            headers["X-CSRF-Token"] = token
        res = await self.http.post("/graphql", json={"query": query, "variables": variables or {}}, headers=headers)
        return res.json()  # type: ignore[no-any-return]


def _random_ip() -> str:
    return f"10.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"


@pytest.fixture
async def api() -> AsyncIterator[Api]:
    transport = ASGITransport(app=app, client=(_random_ip(), 50000))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield Api(client)


@pytest.fixture
async def other_api() -> AsyncIterator[Api]:
    transport = ASGITransport(app=app, client=(_random_ip(), 50001))
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield Api(client)


def unique_email(prefix: str = "org") -> str:
    return f"{prefix}.{uuid.uuid4().hex[:10]}@example.com"


REGISTER_MUTATION = """
mutation($input: RegisterInput!) { register(input: $input) { __typename } }"""
VERIFY_MUTATION = """
mutation($email: String!, $code: String!) { verifyEmail(email: $email, code: $code) { __typename } }"""


async def sign_in_organizer(api: Api, first_name: str = "Asha") -> str:
    """Register, verify and sign in a fresh organizer on this client. Returns the email."""
    email = unique_email(first_name.lower())
    data = {"firstName": first_name, "lastName": "Perera", "email": email, "password": "Str0ng-enough-pass"}
    assert (await api.gql(REGISTER_MUTATION, {"input": data}))["data"]["register"]["__typename"] == "CodeSent"
    code = OUTBOX.last_to(email, "verify_code").params["code"]
    assert (await api.gql(VERIFY_MUTATION, {"email": email, "code": code}))["data"]["verifyEmail"][
        "__typename"
    ] == "SignedIn"
    return email
