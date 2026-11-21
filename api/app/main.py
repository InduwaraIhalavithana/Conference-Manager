"""ConferenceHub v3 API entry point: wires settings, logging, error tracking, databases and the HTTP layer."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter

from app.api.graphql.context import get_context
from app.api.graphql.schema import build_schema
from app.api.middleware import RequestContextMiddleware
from app.api.rest.routes import router as rest_router
from app.core.logging import configure_logging, get_logger
from app.core.settings import get_settings
from app.db import mongo, redis
from app.services.admin_seed import ensure_admin

settings = get_settings()
configure_logging(settings)
log = get_logger("app")

if settings.sentry_dsn:
    # Error tracking only: no request bodies, cookies or personal data are sent.
    sentry_sdk.init(
        dsn=settings.sentry_dsn, environment=settings.environment, send_default_pii=False, traces_sample_rate=0.0
    )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await mongo.connect(settings.mongo_url, settings.mongo_db)
    await redis.connect(settings.redis_url, settings.redis_prefix)
    await ensure_admin(settings)
    log.info("api started", environment=settings.environment, mongo_db=settings.mongo_db)
    yield
    await redis.disconnect()
    await mongo.disconnect()


app = FastAPI(
    title="ConferenceHub API",
    version="3.0.0a1",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
)
app.add_middleware(RequestContextMiddleware)
app.include_router(rest_router)
app.include_router(
    GraphQLRouter(
        build_schema(settings.is_production),
        context_getter=get_context,
        graphql_ide=None if settings.is_production else "graphiql",
    ),
    prefix="/graphql",
)
