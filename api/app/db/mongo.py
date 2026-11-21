"""MongoDB connection: one async PyMongo client per process, Beanie models registered on start."""

from typing import Any

from beanie import init_beanie
from pymongo import AsyncMongoClient

from app.models import DOCUMENT_MODELS

_client: AsyncMongoClient[dict[str, Any]] | None = None


async def connect(url: str, db_name: str) -> None:
    global _client
    _client = AsyncMongoClient(url, tz_aware=True)
    await init_beanie(database=_client[db_name], document_models=DOCUMENT_MODELS)


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


def client() -> AsyncMongoClient[dict[str, Any]]:
    if _client is None:
        raise RuntimeError("MongoDB is not connected")
    return _client


async def ping() -> bool:
    if _client is None:
        return False
    try:
        await _client.admin.command("ping")
    except Exception:
        return False
    return True
