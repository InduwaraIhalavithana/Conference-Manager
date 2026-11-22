"""The signed-in person's own account: profile details, other devices, and notifications."""

from dataclasses import dataclass
from typing import Literal

from beanie import PydanticObjectId
from bson.errors import InvalidId
from pydantic import BaseModel, Field, field_validator

from app.core.errors import DomainError, ErrorCode
from app.models import ActorRef, Notification, Organizer
from app.models.common import Lang, LocalizedText, utcnow
from app.repositories import accounts, messages, sessions
from app.services.auth import Viewer, validate
from app.services.uploads import require_own_upload

NOTIFICATION_PAGE = 30


def _signed_in(viewer: Viewer | None) -> Viewer:
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    return viewer


def _organizer(viewer: Viewer | None) -> Organizer:
    organizer = _signed_in(viewer).organizer
    if organizer is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only organizers have a profile")
    return organizer


def _actor(viewer: Viewer) -> ActorRef:
    assert viewer.subject.id is not None
    kind: Literal["organizer", "admin"] = viewer.subject_type
    return ActorRef(type=kind, id=viewer.subject.id)


def _me(viewer: Viewer) -> tuple[str, PydanticObjectId]:
    """The (type, id) pair notifications are addressed to."""
    assert viewer.subject.id is not None
    return viewer.subject_type, viewer.subject.id


# ── Profile ──────────────────────────────────────────────────────────────────────────────────────────


class ProfileInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    last_name: str = Field(min_length=1, max_length=60)
    phone: str | None = Field(default=None, max_length=30, pattern=r"^[0-9 +()-]*$")
    organization: str | None = Field(default=None, max_length=120)
    bio: LocalizedText | None = None
    avatar_url: str | None = None
    lang: Lang = "en"

    @field_validator("first_name", "last_name", "phone", "organization", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


async def update_profile(viewer: Viewer | None, **data: object) -> Organizer:
    organizer = _organizer(viewer)
    bio = data.get("bio")
    if isinstance(bio, dict):
        cleaned = {k: (v.strip() if isinstance(v, str) else v) or None for k, v in bio.items()}
        data["bio"] = cleaned if cleaned.get("en") else None
    body = validate(ProfileInput, **data)
    if body.avatar_url and body.avatar_url != organizer.avatar_url:
        require_own_upload(body.avatar_url, "avatar")
    if body.bio and len(" ".join(filter(None, [body.bio.en, body.bio.si, body.bio.ta]))) > 3000:
        raise DomainError(ErrorCode.VALIDATION, "Keep the bio under 1000 characters per language", field="bio")

    organizer.first_name = body.first_name
    organizer.last_name = body.last_name
    organizer.phone = body.phone
    organizer.organization = body.organization
    organizer.bio = body.bio
    organizer.avatar_url = body.avatar_url
    organizer.lang = body.lang
    await accounts.save_organizer(organizer)
    assert viewer is not None
    await messages.log_activity(_actor(viewer), "update_profile", organizer.email)
    return organizer


async def sign_out_other_devices(viewer: Viewer | None) -> None:
    signed_in = _signed_in(viewer)
    assert signed_in.subject.id is not None
    await sessions.revoke_all(
        signed_in.subject_type, signed_in.subject.id, "signed_out_elsewhere", keep=signed_in.session_id
    )
    await messages.log_activity(_actor(signed_in), "sign_out_other_devices", signed_in.subject.email)


# ── Notifications ────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class NotificationPage:
    items: list[Notification]
    has_next: bool
    unread: int


def _object_id(value: str, field: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except (InvalidId, TypeError, ValueError) as err:
        raise DomainError(ErrorCode.VALIDATION, "Not a valid id", field=field) from err


async def notifications(
    viewer: Viewer | None, first: int = NOTIFICATION_PAGE, after: str | None = None
) -> NotificationPage:
    kind, me = _me(_signed_in(viewer))
    limit = max(1, min(first, 100))
    before = _object_id(after, "after") if after else None
    items = await messages.notifications_for(kind, me, limit + 1, before)
    return NotificationPage(
        items=items[:limit], has_next=len(items) > limit, unread=await messages.unread_count(kind, me)
    )


async def unread_notifications(viewer: Viewer | None) -> int:
    kind, me = _me(_signed_in(viewer))
    return await messages.unread_count(kind, me)


async def mark_notifications_read(viewer: Viewer | None, ids: list[str] | None) -> int:
    """Marks the given notifications read (all of them when `ids` is None). Returns how many are left unread."""
    kind, me = _me(_signed_in(viewer))
    if ids is not None and len(ids) > 200:
        raise DomainError(ErrorCode.VALIDATION, "Mark at most 200 at a time", field="ids")
    object_ids = None if ids is None else [_object_id(i, "ids") for i in ids]
    await messages.mark_read(kind, me, object_ids, utcnow())
    return await messages.unread_count(kind, me)
