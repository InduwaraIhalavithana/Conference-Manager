"""GraphQL types shared across the schema: errors, viewers and small result shapes."""

from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Annotated

import strawberry

from app.core.errors import DomainError
from app.core.errors import ErrorCode as DomainErrorCode
from app.models import Admin as AdminDoc
from app.models import Organizer as OrganizerDoc

ErrorCode = strawberry.enum(DomainErrorCode, description="Stable error codes; the web app translates each one.")


@strawberry.type(description="Something the user can fix or retry, returned instead of a result.")
class UserError:
    code: ErrorCode  # type: ignore[valid-type]
    message: str
    field: str | None = None
    retry_after_seconds: int | None = None
    remaining_attempts: int | None = None

    @classmethod
    def from_domain(cls, err: DomainError) -> "UserError":
        return cls(
            code=err.code,
            message=err.message,
            field=err.field,
            retry_after_seconds=err.extra.get("retry_after"),
            remaining_attempts=err.extra.get("remaining"),
        )


@strawberry.type(description="Text in the three app languages (English always present).")
class ProfileBio:
    en: str
    si: str | None
    ta: str | None


@strawberry.type
class Organizer:
    id: strawberry.ID
    first_name: str
    last_name: str
    email: str
    phone: str | None
    organization: str | None
    bio: ProfileBio | None
    avatar_url: str | None
    lang: str
    email_verified: bool
    created_at: datetime

    @classmethod
    def from_doc(cls, doc: OrganizerDoc) -> "Organizer":
        return cls(
            id=strawberry.ID(str(doc.id)),
            first_name=doc.first_name,
            last_name=doc.last_name,
            email=doc.email,
            phone=doc.phone,
            organization=doc.organization,
            bio=ProfileBio(en=doc.bio.en, si=doc.bio.si, ta=doc.bio.ta) if doc.bio else None,
            avatar_url=doc.avatar_url,
            lang=doc.lang,
            email_verified=doc.email_verified_at is not None,
            created_at=doc.created_at,
        )


@strawberry.type
class Admin:
    id: strawberry.ID
    username: str
    email: str

    @classmethod
    def from_doc(cls, doc: AdminDoc) -> "Admin":
        return cls(id=strawberry.ID(str(doc.id)), username=doc.username, email=doc.email)


Viewer = Annotated[Organizer | Admin, strawberry.union("Viewer", description="Whoever is signed in.")]


def viewer_from(subject: OrganizerDoc | AdminDoc) -> Organizer | Admin:
    return Organizer.from_doc(subject) if isinstance(subject, OrganizerDoc) else Admin.from_doc(subject)


@strawberry.type
class Done:
    ok: bool = True


DoneResult = Annotated[Done | UserError, strawberry.union("DoneResult")]


async def guarded[T](action: Callable[[], Awaitable[T]]) -> T | UserError:
    """Run a service call and turn a DomainError into a UserError result (errors are data, not exceptions)."""
    try:
        return await action()
    except DomainError as err:
        return UserError.from_domain(err)
