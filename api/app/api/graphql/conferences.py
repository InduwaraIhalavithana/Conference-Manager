"""Public conference queries (Phase 0 spike shape; Phase 2 adds the full aggregate)."""

from datetime import datetime

import strawberry

from app import models
from app.services import conferences as service


@strawberry.type
class LocalizedText:
    en: str
    si: str | None
    ta: str | None

    @classmethod
    def from_model(cls, text: models.LocalizedText) -> "LocalizedText":
        return cls(en=text.en, si=text.si, ta=text.ta)


@strawberry.type
class Conference:
    id: strawberry.ID
    slug: str
    title: LocalizedText
    summary: LocalizedText | None
    city: str
    starts_at: datetime

    @classmethod
    def from_doc(cls, doc: models.Conference) -> "Conference":
        return cls(
            id=strawberry.ID(str(doc.id)),
            slug=doc.slug,
            title=LocalizedText.from_model(doc.title),
            summary=LocalizedText.from_model(doc.summary) if doc.summary else None,
            city=doc.city,
            starts_at=doc.starts_at,
        )


@strawberry.type
class ConferenceQuery:
    @strawberry.field(description="Published conferences, soonest first.")
    async def conferences(self, first: int = 20) -> list[Conference]:
        docs = await service.list_published(first)
        return [Conference.from_doc(d) for d in docs]

    @strawberry.field(description="One published conference by its URL slug.")
    async def conference(self, slug: str) -> Conference | None:
        doc = await service.published_by_slug(slug)
        return Conference.from_doc(doc) if doc else None
