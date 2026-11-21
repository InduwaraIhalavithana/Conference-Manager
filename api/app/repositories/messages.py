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


async def notifications_for(recipient_type: str, recipient_id: PydanticObjectId) -> list[Notification]:
    return (
        await Notification.find({"recipient.type": recipient_type, "recipient.id": recipient_id})
        .sort("-created_at")
        .to_list()
    )
