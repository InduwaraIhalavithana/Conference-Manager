"""A conference is one MongoDB document (the aggregate). Phase 0 spike: only the fields the spike shows."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from beanie import Document, Indexed
from pydantic import BaseModel, Field
from pymongo import ASCENDING, IndexModel


class LocalizedText(BaseModel):
    """Text an organizer writes, kept in all three app languages."""

    en: str
    si: str | None = None
    ta: str | None = None


class Conference(Document):
    slug: Annotated[str, Indexed(unique=True)]
    status: Literal["draft", "published", "cancelled", "archived"] = "draft"
    title: LocalizedText
    summary: LocalizedText | None = None
    city: str
    starts_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    class Settings:
        name = "conferences"
        indexes = [IndexModel([("status", ASCENDING), ("starts_at", ASCENDING)])]
