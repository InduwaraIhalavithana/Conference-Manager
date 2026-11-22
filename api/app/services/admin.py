"""The admin area's rules: platform numbers, organizer accounts, hiding conferences, the contact inbox,
organizer feedback and the activity log. Every action is admin-only and written to the activity log."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Literal

from beanie import PydanticObjectId
from bson.errors import InvalidId
from pydantic import BaseModel, Field, field_validator

from app.core.errors import DomainError, ErrorCode
from app.models import ActivityLog, ActorRef, Admin, Conference, ContactMessage, Feedback, Organizer
from app.models.common import utcnow
from app.repositories import accounts, messages, sessions
from app.repositories import admin as repo
from app.repositories import conferences as conference_repo
from app.services import email, ratelimit
from app.services.auth import Viewer, validate
from app.services.registrations import notify_conference_cancelled

MAX_PAGE = 100
FEEDBACK = ratelimit.Limit("feedback", 10, window_seconds=3600)


def require_admin(viewer: Viewer | None) -> Admin:
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    if viewer.admin is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only administrators can do this")
    return viewer.admin


def _oid(value: str, what: str) -> PydanticObjectId:
    try:
        return PydanticObjectId(value)
    except (InvalidId, TypeError, ValueError) as err:
        raise DomainError(ErrorCode.NOT_FOUND, f"{what} not found") from err


def _actor(admin: Admin) -> ActorRef:
    assert admin.id is not None
    return ActorRef(type="admin", id=admin.id)


def _page(first: int, offset: int) -> tuple[int, int]:
    return max(0, offset), max(1, min(first, MAX_PAGE))


@dataclass(frozen=True)
class Page[T]:
    items: list[T]
    total: int


# ── Overview ─────────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Overview:
    organizers_active: int
    organizers_suspended: int
    organizers_unverified: int
    conferences_upcoming: int
    conferences_drafts: int
    conferences_cancelled: int
    conferences_hidden: int
    registrations_active: int
    registrations_week: int
    contacts_open: int
    feedback_open: int


async def overview(viewer: Viewer | None) -> Overview:
    require_admin(viewer)
    now = utcnow()
    orgs = await repo.organizer_counts()
    confs = await repo.conference_counts(now)
    return Overview(
        organizers_active=orgs["active"],
        organizers_suspended=orgs["suspended"],
        organizers_unverified=orgs["unverified"],
        conferences_upcoming=confs["upcoming"],
        conferences_drafts=confs["drafts"],
        conferences_cancelled=confs["cancelled"],
        conferences_hidden=confs["hidden"],
        registrations_active=await repo.active_registrations(),
        registrations_week=await repo.registrations_since(now - timedelta(days=7)),
        contacts_open=await repo.open_contacts(),
        feedback_open=await repo.open_feedback(),
    )


# ── Organizers ───────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class OrganizerRow:
    organizer: Organizer
    conferences: int


OrganizerStatus = Literal["all", "active", "suspended", "unverified"]


async def organizers(
    viewer: Viewer | None, q: str | None, status: OrganizerStatus, first: int, offset: int
) -> Page[OrganizerRow]:
    require_admin(viewer)
    skip, limit = _page(first, offset)
    items, total = await repo.organizers(q, status, skip, limit)
    counts = await repo.conference_counts_by_organizer([o.id for o in items if o.id is not None])
    return Page([OrganizerRow(o, counts.get(o.id, 0) if o.id else 0) for o in items], total)


async def _organizer(organizer_id: str) -> Organizer:
    organizer = await accounts.organizer_by_id(_oid(organizer_id, "Organizer"))
    if organizer is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Organizer not found")
    return organizer


async def suspend(viewer: Viewer | None, organizer_id: str) -> Organizer:
    """Signs them out everywhere and hides their conferences from the public until restored."""
    admin = require_admin(viewer)
    organizer = await _organizer(organizer_id)
    assert organizer.id is not None
    if not organizer.is_suspended:
        organizer.is_suspended = True
        await accounts.save_organizer(organizer)
        await sessions.revoke_all("organizer", organizer.id, "suspended")
        hidden = await repo.set_hidden_for_organizer(organizer.id, True)
        await messages.log_activity(_actor(admin), "suspend_organizer", organizer.email, {"hidden": hidden})
    return organizer


async def restore(viewer: Viewer | None, organizer_id: str) -> Organizer:
    admin = require_admin(viewer)
    organizer = await _organizer(organizer_id)
    assert organizer.id is not None
    if organizer.is_suspended:
        organizer.is_suspended = False
        await accounts.save_organizer(organizer)
        shown = await repo.set_hidden_for_organizer(organizer.id, False)
        await messages.notify([ActorRef(type="organizer", id=organizer.id)], "account_restored", {}, "/dashboard")
        await messages.log_activity(_actor(admin), "restore_organizer", organizer.email, {"shown": shown})
    return organizer


async def delete_organizer(viewer: Viewer | None, organizer_id: str) -> dict[str, int]:
    """Removes the account and everything it owns. People registered for an upcoming conference are told by
    email that it is cancelled first, so nobody turns up to an event that no longer exists."""
    admin = require_admin(viewer)
    organizer = await _organizer(organizer_id)
    assert organizer.id is not None
    now = utcnow()
    for conference in await conference_repo.for_organizer(organizer.id):
        if conference.status == "published" and conference.ends_at > now:
            await notify_conference_cancelled(conference)
    removed = await repo.delete_organizer_data(organizer.id)
    await messages.log_activity(_actor(admin), "delete_organizer", organizer.email, removed)
    return removed


# ── Conferences ──────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ConferenceRow:
    conference: Conference
    organizer: Organizer | None


ConferenceFilter = Literal["all", "upcoming", "past", "draft", "cancelled", "hidden"]


async def conferences(
    viewer: Viewer | None, q: str | None, status: ConferenceFilter, first: int, offset: int
) -> Page[ConferenceRow]:
    require_admin(viewer)
    skip, limit = _page(first, offset)
    items, total = await repo.conferences(q, status, skip, limit, utcnow())
    owners = {o.id: o for o in await accounts.organizers_by_ids(list({c.organizer_id for c in items}))}
    return Page([ConferenceRow(c, owners.get(c.organizer_id)) for c in items], total)


async def set_hidden(viewer: Viewer | None, conference_id: str, hidden: bool) -> Conference:
    """Hides a conference from the public (the organizer is told), or shows it again."""
    admin = require_admin(viewer)
    conference = await conference_repo.by_id(_oid(conference_id, "Conference"))
    if conference is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
    if conference.hidden == hidden:
        return conference
    conference.hidden = hidden
    conference.hidden_reason = "admin" if hidden else None
    await conference_repo.save(conference)
    if hidden:
        await messages.notify(
            [ActorRef(type="organizer", id=conference.organizer_id)],
            "conference_removed",
            {"title": conference.title.en},
            f"/dashboard/conferences/{conference.id}",
        )
    await messages.log_activity(_actor(admin), "hide_conference" if hidden else "show_conference", conference.slug)
    return conference


# ── Contact inbox ────────────────────────────────────────────────────────────────────────────────────


class ReplyInput(BaseModel):
    message: str = Field(min_length=2, max_length=5000)

    @field_validator("message", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


async def contacts(
    viewer: Viewer | None, status: Literal["open", "resolved"] | None, first: int, offset: int
) -> Page[ContactMessage]:
    require_admin(viewer)
    skip, limit = _page(first, offset)
    items, total = await repo.contacts(status, skip, limit)
    return Page(items, total)


async def _contact(message_id: str) -> ContactMessage:
    found = await repo.contact_by_id(_oid(message_id, "Message"))
    if found is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Message not found")
    return found


async def set_contact_resolved(viewer: Viewer | None, message_id: str, resolved: bool) -> ContactMessage:
    admin = require_admin(viewer)
    found = await _contact(message_id)
    found.status = "resolved" if resolved else "open"
    found.resolved_at = utcnow() if resolved else None
    await found.save()
    await messages.log_activity(_actor(admin), "resolve_contact" if resolved else "reopen_contact", found.email)
    return found


async def reply_to_contact(viewer: Viewer | None, message_id: str, text: str) -> ContactMessage:
    """Emails the reply to whoever wrote (in English: the contact form does not ask for a language), and marks
    the message resolved."""
    admin = require_admin(viewer)
    body = validate(ReplyInput, message=text)
    found = await _contact(message_id)
    await email.send(
        email.EmailMessage(
            to=found.email, kind="contact_reply", lang="en", params={"name": found.name, "quote": body.message}
        )
    )
    found.status = "resolved"
    found.resolved_at = utcnow()
    await found.save()
    await messages.log_activity(_actor(admin), "reply_contact", found.email)
    return found


# ── Organizer feedback ───────────────────────────────────────────────────────────────────────────────


class FeedbackInput(BaseModel):
    subject: str = Field(min_length=2, max_length=150)
    message: str = Field(min_length=5, max_length=5000)

    @field_validator("subject", "message", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


async def submit_feedback(viewer: Viewer | None, subject: str, message: str) -> Feedback:
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    organizer = viewer.organizer
    if organizer is None or organizer.id is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only organizers send feedback")
    await ratelimit.enforce(FEEDBACK, str(organizer.id))
    body = validate(FeedbackInput, subject=subject, message=message)
    item = await Feedback(organizer_id=organizer.id, subject=body.subject, message=body.message).insert()
    admins = [ActorRef(type="admin", id=i) for i in await accounts.all_admin_ids()]
    await messages.notify(
        admins, "new_feedback", {"organizer": organizer.full_name, "subject": body.subject}, "/admin/feedback"
    )
    await messages.log_activity(ActorRef(type="organizer", id=organizer.id), "send_feedback", body.subject)
    return item


async def my_feedback(viewer: Viewer | None) -> list[Feedback]:
    if viewer is None or viewer.organizer is None or viewer.organizer.id is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    items, _ = await repo.feedback(None, viewer.organizer.id, 0, MAX_PAGE)
    return items


@dataclass(frozen=True)
class FeedbackRow:
    feedback: Feedback
    organizer: Organizer | None


async def feedback(
    viewer: Viewer | None, status: Literal["open", "replied", "closed"] | None, first: int, offset: int
) -> Page[FeedbackRow]:
    require_admin(viewer)
    skip, limit = _page(first, offset)
    items, total = await repo.feedback(status, None, skip, limit)
    owners = {o.id: o for o in await accounts.organizers_by_ids(list({f.organizer_id for f in items}))}
    return Page([FeedbackRow(f, owners.get(f.organizer_id)) for f in items], total)


async def reply_to_feedback(viewer: Viewer | None, feedback_id: str, text: str) -> Feedback:
    admin = require_admin(viewer)
    body = validate(ReplyInput, message=text)
    item = await repo.feedback_by_id(_oid(feedback_id, "Feedback"))
    if item is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Feedback not found")
    item.reply = body.message
    item.status = "replied"
    item.replied_at = utcnow()
    await item.save()
    organizer = await accounts.organizer_by_id(item.organizer_id)
    if organizer is not None:
        await messages.notify(
            [ActorRef(type="organizer", id=item.organizer_id)],
            "feedback_reply",
            {"subject": item.subject},
            "/dashboard/help",
        )
        await email.send(
            email.EmailMessage(
                to=organizer.email,
                kind="feedback_reply",
                lang=organizer.lang,
                params={"name": organizer.first_name, "subject": item.subject, "quote": body.message},
            )
        )
    await messages.log_activity(_actor(admin), "reply_feedback", item.subject)
    return item


async def close_feedback(viewer: Viewer | None, feedback_id: str) -> Feedback:
    admin = require_admin(viewer)
    item = await repo.feedback_by_id(_oid(feedback_id, "Feedback"))
    if item is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Feedback not found")
    item.status = "closed"
    await item.save()
    await messages.log_activity(_actor(admin), "close_feedback", item.subject)
    return item


# ── Activity log ─────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class ActivityRow:
    entry: ActivityLog
    actor_name: str | None


async def activity(
    viewer: Viewer | None, actor_type: Literal["organizer", "admin"] | None, action: str | None, first: int, offset: int
) -> Page[ActivityRow]:
    require_admin(viewer)
    skip, limit = _page(first, offset)
    items, total = await repo.activity(actor_type, action, skip, limit)
    org_ids = list({e.actor.id for e in items if e.actor.type == "organizer" and e.actor.id is not None})
    names = {o.id: o.full_name for o in await accounts.organizers_by_ids(org_ids)}
    rows = []
    for e in items:
        if e.actor.type == "admin" and e.actor.id is not None:
            found = await accounts.admin_by_id(e.actor.id)
            name = found.username if found else None
        else:
            name = names.get(e.actor.id)
        rows.append(ActivityRow(e, name))
    return Page(rows, total)


async def activity_actions(viewer: Viewer | None) -> list[str]:
    require_admin(viewer)
    return await repo.activity_actions()
