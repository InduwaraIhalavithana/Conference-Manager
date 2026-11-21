"""Repository for sign-in sessions and password-reset tokens."""

from datetime import datetime

from beanie import PydanticObjectId
from pymongo.results import UpdateResult

from app.models import AuthSession, PasswordReset
from app.models.common import utcnow


async def create_session(session: AuthSession) -> AuthSession:
    await session.insert()
    return session


async def session_by_id(session_id: str) -> AuthSession | None:
    try:
        oid = PydanticObjectId(session_id)
    except Exception:
        return None
    return await AuthSession.get(oid)


async def rotate(session: AuthSession, *, old_jti: str, new_jti: str, expires_at: datetime) -> bool:
    """Swap the refresh token id atomically. False when another request already rotated it (or it was revoked)."""
    result = await AuthSession.find_one({"_id": session.id, "current_jti": old_jti, "revoked_at": None}).update(
        {"$set": {"current_jti": new_jti, "expires_at": expires_at, "last_used_at": utcnow()}}
    )
    return isinstance(result, UpdateResult) and result.modified_count == 1


async def revoke(session: AuthSession, reason: str) -> None:
    await AuthSession.find_one({"_id": session.id, "revoked_at": None}).update(
        {"$set": {"revoked_at": utcnow(), "revoked_reason": reason}}
    )


async def revoke_all(subject_type: str, subject_id: PydanticObjectId, reason: str, *, keep: str | None = None) -> int:
    query: dict[str, object] = {"subject_type": subject_type, "subject_id": subject_id, "revoked_at": None}
    if keep:
        query["_id"] = {"$ne": PydanticObjectId(keep)}
    result = await AuthSession.find(query).update({"$set": {"revoked_at": utcnow(), "revoked_reason": reason}})
    return result.modified_count if isinstance(result, UpdateResult) else 0


async def insert_reset(reset: PasswordReset) -> None:
    await reset.insert()


async def reset_by_hash(token_hash: str) -> PasswordReset | None:
    return await PasswordReset.find_one({"token_hash": token_hash})


async def delete_resets_for(organizer_id: PydanticObjectId) -> None:
    await PasswordReset.find({"organizer_id": organizer_id}).delete()
