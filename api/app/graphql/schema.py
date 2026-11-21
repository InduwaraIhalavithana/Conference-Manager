"""GraphQL schema (code-first with Strawberry). Phase 0 spike: public conference queries only."""

from datetime import datetime

import strawberry

from app import models
from app.repositories import conferences as repo


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
class Query:
    @strawberry.field(description="Published conferences, soonest first.")
    async def conferences(self, first: int = 20) -> list[Conference]:
        docs = await repo.list_published(limit=max(1, min(first, 50)))
        return [Conference.from_doc(d) for d in docs]

    @strawberry.field(description="One published conference by its URL slug.")
    async def conference(self, slug: str) -> Conference | None:
        doc = await repo.get_published_by_slug(slug)
        return Conference.from_doc(doc) if doc else None


schema = strawberry.Schema(query=Query)
