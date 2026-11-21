"""Small shapes shared by several documents."""

from datetime import UTC, datetime
from typing import Literal

from beanie import PydanticObjectId
from pydantic import BaseModel


def utcnow() -> datetime:
    return datetime.now(UTC)


class LocalizedText(BaseModel):
    """Text an organizer writes, kept in all three app languages."""

    en: str
    si: str | None = None
    ta: str | None = None


class ActorRef(BaseModel):
    """Who did something or who should hear about it."""

    type: Literal["organizer", "admin", "system"]
    id: PydanticObjectId | None = None


Lang = Literal["en", "si", "ta"]
