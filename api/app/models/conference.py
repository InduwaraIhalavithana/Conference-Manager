"""A conference is one MongoDB document (the aggregate). Phase 0 fields only; Phase 2 adds days, tracks,
sessions, speakers, venue and capacity."""

from datetime import datetime
from typing import Annotated, Literal

from beanie import Document, Indexed
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.common import LocalizedText, utcnow


class Conference(Document):
    slug: Annotated[str, Indexed(unique=True)]
    status: Literal["draft", "published", "cancelled", "archived"] = "draft"
    title: LocalizedText
    summary: LocalizedText | None = None
    city: str
    starts_at: datetime
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "conferences"
        indexes = [IndexModel([("status", ASCENDING), ("starts_at", ASCENDING)])]
