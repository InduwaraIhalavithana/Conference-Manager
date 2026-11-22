"""Repository for organizers and admins: all reads and writes of those two collections go through here."""

from datetime import datetime

from beanie import PydanticObjectId
from pymongo.errors import DuplicateKeyError

from app.models import Admin, Organizer
from app.models.common import utcnow


class EmailTakenError(Exception):
    pass


def normalise_email(email: str) -> str:
    return email.strip().lower()


async def organizer_by_id(organizer_id: PydanticObjectId | str) -> Organizer | None:
    try:
        oid = PydanticObjectId(organizer_id)
    except Exception:
        return None
    return await Organizer.get(oid)


async def organizers_by_ids(ids: list[PydanticObjectId]) -> list[Organizer]:
    return await Organizer.find({"_id": {"$in": ids}}).to_list()


async def organizer_by_email(email: str) -> Organizer | None:
    return await Organizer.find_one({"email": normalise_email(email)})


async def insert_organizer(organizer: Organizer) -> Organizer:
    organizer.email = normalise_email(organizer.email)
    try:
        await organizer.insert()
    except DuplicateKeyError as err:
        raise EmailTakenError(organizer.email) from err
    return organizer


async def save_organizer(organizer: Organizer) -> None:
    organizer.updated_at = utcnow()
    await organizer.save()


async def delete_unverified_before(cutoff: datetime) -> int:
    """Organizers who never entered their sign-up code, older than `cutoff` (they cannot have conferences)."""
    result = await Organizer.find({"email_verified_at": None, "created_at": {"$lt": cutoff}}).delete()
    return result.deleted_count if result else 0


async def admin_by_id(admin_id: PydanticObjectId | str) -> Admin | None:
    try:
        oid = PydanticObjectId(admin_id)
    except Exception:
        return None
    return await Admin.get(oid)


async def admin_by_login(identifier: str) -> Admin | None:
    """Admins sign in with their email; the username ("admin") still works, as in v2."""
    ident = identifier.strip()
    return await Admin.find_one({"$or": [{"email": ident.lower()}, {"username": ident}]})


async def any_admin() -> Admin | None:
    return await Admin.find_one({})


async def insert_admin(admin: Admin) -> Admin:
    admin.email = normalise_email(admin.email)
    await admin.insert()
    return admin


async def save_admin(admin: Admin) -> None:
    await admin.save()


async def avatar_in_use(url: str) -> bool:
    return await Organizer.find({"avatar_url": url}).count() > 0


async def all_admin_ids() -> list[PydanticObjectId]:
    return [a.id for a in await Admin.find_all().to_list() if a.id is not None]
