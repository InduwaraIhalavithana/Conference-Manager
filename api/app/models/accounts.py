"""Accounts: organizers (self-registered) and the admin (created from environment variables)."""

from datetime import datetime
from typing import Annotated

from beanie import Document, Indexed
from pydantic import Field

from app.core.codes import EmailCode
from app.models.common import Lang, LocalizedText, utcnow


class Organizer(Document):
    first_name: str
    last_name: str
    # Stored lower-case, so the unique index also means "unique ignoring case".
    email: Annotated[str, Indexed(unique=True)]
    password_hash: str
    phone: str | None = None
    organization: str | None = None
    bio: LocalizedText | None = None
    avatar_url: str | None = None
    lang: Lang = "en"
    is_suspended: bool = False
    # Set when the organizer enters the code from the sign-up email; sign-in is refused until then.
    email_verified_at: datetime | None = None
    verify: EmailCode | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "organizers"

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Admin(Document):
    username: Annotated[str, Indexed(unique=True)]
    email: Annotated[str, Indexed(unique=True)]
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "admins"
