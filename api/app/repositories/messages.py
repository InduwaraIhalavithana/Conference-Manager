"""Repository for notifications and the activity log."""

from typing import Any

from beanie import PydanticObjectId

from app.models import ActivityLog, ActorRef, Notification


async def log_activity(
    actor: ActorRef, action: str, target: str | None = None, meta: dict[str, Any] | None = None
) -> None:
    await ActivityLog(actor=actor, action=action, target=target, meta=meta or {}).insert()


async def notify(recipients: list[ActorRef], kind: str, params: dict[str, Any], link: str | None = None) -> None:
    if recipients:
        await Notification.insert_many(
            [Notification(recipient=r, kind=kind, params=params, link=link) for r in recipients]
        )


async def activity_for(actor_type: str, actor_id: PydanticObjectId) -> list[ActivityLog]:
    return await ActivityLog.find({"actor.type": actor_type, "actor.id": actor_id}).sort("-created_at").to_list()


def _mine(recipient_type: str, recipient_id: PydanticObjectId) -> dict[str, Any]:
    return {"recipient.type": recipient_type, "recipient.id": recipient_id}


async def notifications_for(
    recipient_type: str, recipient_id: PydanticObjectId, limit: int = 50, before: PydanticObjectId | None = None
) -> list[Notification]:
    """Newest first. ObjectIds grow with time, so `_id < before` is a stable cursor for the next page."""
    query = _mine(recipient_type, recipient_id)
    if before is not None:
        query["_id"] = {"$lt": before}
    return await Notification.find(query).sort("-_id").limit(limit).to_list()


async def unread_count(recipient_type: str, recipient_id: PydanticObjectId) -> int:
    return await Notification.find({**_mine(recipient_type, recipient_id), "read_at": None}).count()


async def mark_read(
    recipient_type: str, recipient_id: PydanticObjectId, ids: list[PydanticObjectId] | None, now: Any
) -> int:
    """Marks the given notifications (or all) read; only the recipient's own are ever touched."""
    query: dict[str, Any] = {**_mine(recipient_type, recipient_id), "read_at": None}
    if ids is not None:
        query["_id"] = {"$in": ids}
    result = await Notification.get_pymongo_collection().update_many(query, {"$set": {"read_at": now}})
    return int(result.modified_count)
