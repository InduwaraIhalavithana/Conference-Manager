"""Sign-in sessions and password-reset tokens."""

from datetime import datetime
from typing import Annotated, Literal

from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.common import utcnow


class AuthSession(Document):
    """One signed-in device. The refresh token is rotated on every use; ``current_jti`` is the only one that works.

    Presenting an older refresh token means it was copied, so the whole session is revoked (reuse detection).
    MongoDB deletes the document by itself after ``expires_at`` (TTL index).
    """

    subject_type: Literal["organizer", "admin"]
    subject_id: PydanticObjectId
    current_jti: str
    expires_at: datetime
    revoked_at: datetime | None = None
    revoked_reason: str | None = None
    user_agent: str | None = None
    created_at: datetime = Field(default_factory=utcnow)
    last_used_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "auth_sessions"
        indexes = [
            IndexModel([("subject_type", ASCENDING), ("subject_id", ASCENDING)]),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]


class PasswordReset(Document):
    organizer_id: PydanticObjectId
    # Only the SHA-256 of the emailed token is stored.
    token_hash: Annotated[str, Indexed(unique=True)]
    expires_at: datetime
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "password_resets"
        indexes = [
            IndexModel([("organizer_id", ASCENDING)]),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
