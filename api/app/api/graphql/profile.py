"""The signed-in person's own account: profile, other devices and notifications."""

from datetime import datetime
from typing import Annotated, Any

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from app.api.graphql.context import Context
from app.api.graphql.types import Done, DoneResult, Organizer, UserError, guarded
from app.models import Notification as NotificationDoc
from app.services import profile as service


@strawberry.input
class BioInput:
    en: str | None = None
    si: str | None = None
    ta: str | None = None


@strawberry.input
class ProfileInput:
    first_name: str
    last_name: str
    phone: str | None = None
    organization: str | None = None
    bio: BioInput | None = None
    avatar_url: str | None = None
    lang: str = "en"


@strawberry.type(
    description="Translated in the web app from `kind` and `params`, so it reads in the viewer's language."
)
class Notification:
    id: strawberry.ID
    kind: str
    params: JSON
    link: str | None
    read: bool
    created_at: datetime

    @classmethod
    def from_doc(cls, doc: NotificationDoc) -> "Notification":
        params: dict[str, Any] = {
            k: (str(v) if not isinstance(v, (str, int, float, bool)) else v) for k, v in doc.params.items()
        }
        return cls(
            id=strawberry.ID(str(doc.id)),
            kind=doc.kind,
            params=JSON(params),
            link=doc.link,
            read=doc.read_at is not None,
            created_at=doc.created_at,
        )


@strawberry.type
class NotificationPage:
    items: list[Notification]
    has_next_page: bool
    end_cursor: str | None
    unread: int


@strawberry.type
class UnreadCount:
    unread: int


NotificationPageResult = Annotated[NotificationPage | UserError, strawberry.union("NotificationPageResult")]
UnreadCountResult = Annotated[UnreadCount | UserError, strawberry.union("UnreadCountResult")]
ProfileResult = Annotated[Organizer | UserError, strawberry.union("ProfileResult")]


@strawberry.type
class ProfileQuery:
    @strawberry.field(description="The signed-in person's notifications, newest first.")
    async def notifications(
        self, info: Info[Context, None], first: int = service.NOTIFICATION_PAGE, after: str | None = None
    ) -> NotificationPageResult:
        async def run() -> NotificationPage:
            page = await service.notifications(info.context.viewer, first, after)
            return NotificationPage(
                items=[Notification.from_doc(n) for n in page.items],
                has_next_page=page.has_next,
                end_cursor=str(page.items[-1].id) if page.items and page.has_next else None,
                unread=page.unread,
            )

        return await guarded(run)

    @strawberry.field(description="How many notifications are unread (for the bell in the header).")
    async def unread_notifications(self, info: Info[Context, None]) -> UnreadCountResult:
        async def run() -> UnreadCount:
            return UnreadCount(unread=await service.unread_notifications(info.context.viewer))

        return await guarded(run)


@strawberry.type
class ProfileMutation:
    @strawberry.mutation(description="Update the signed-in organizer's profile.")
    async def update_profile(self, info: Info[Context, None], input: ProfileInput) -> ProfileResult:
        async def run() -> Organizer:
            bio = None if input.bio is None else {"en": input.bio.en, "si": input.bio.si, "ta": input.bio.ta}
            doc = await service.update_profile(
                info.context.viewer,
                first_name=input.first_name,
                last_name=input.last_name,
                phone=input.phone,
                organization=input.organization,
                bio=bio,
                avatar_url=input.avatar_url,
                lang=input.lang,
            )
            return Organizer.from_doc(doc)

        return await guarded(run)

    @strawberry.mutation(description="Sign out every other device; this one stays signed in.")
    async def sign_out_other_devices(self, info: Info[Context, None]) -> DoneResult:
        async def run() -> Done:
            await service.sign_out_other_devices(info.context.viewer)
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Mark notifications read: the given ids, or all of them when `ids` is left out.")
    async def mark_notifications_read(
        self, info: Info[Context, None], ids: list[strawberry.ID] | None = None
    ) -> UnreadCountResult:
        async def run() -> UnreadCount:
            unread = await service.mark_notifications_read(
                info.context.viewer, None if ids is None else [str(i) for i in ids]
            )
            return UnreadCount(unread=unread)

        return await guarded(run)
