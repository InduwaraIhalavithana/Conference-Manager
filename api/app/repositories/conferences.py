"""Repository pattern: every read and write of the conferences collection goes through here."""

from app.models import Conference


async def list_published(limit: int = 50) -> list[Conference]:
    return await Conference.find({"status": "published"}).sort("+starts_at").limit(limit).to_list()


async def get_published_by_slug(slug: str) -> Conference | None:
    return await Conference.find_one({"slug": slug, "status": "published"})
