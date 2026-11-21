"""Health of the services the API depends on."""

from app.db import mongo, redis


async def status() -> dict[str, str]:
    return {
        "status": "ok",
        "mongo": "ok" if await mongo.ping() else "down",
        "redis": "ok" if await redis.ping() else "down",
    }
