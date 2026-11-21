"""Conference rules. Phase 0/1: only the public listing; Phase 2 adds organizer editing and publishing."""

from app.models import Conference
from app.repositories import conferences as repo

MAX_PAGE = 50


async def list_published(first: int) -> list[Conference]:
    return await repo.list_published(limit=max(1, min(first, MAX_PAGE)))


async def published_by_slug(slug: str) -> Conference | None:
    return await repo.get_published_by_slug(slug)
