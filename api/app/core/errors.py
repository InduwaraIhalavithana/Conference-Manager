"""Domain errors. Services raise DomainError with a stable code; the API layer turns it into a GraphQL UserError.

The codes are part of the public API: the web app translates each one into English, Sinhala and Tamil,
so a code is never renamed, only added.
"""

from enum import StrEnum
from typing import Any


class ErrorCode(StrEnum):
    VALIDATION = "validation"
    NOT_AUTHENTICATED = "not_authenticated"
    FORBIDDEN = "forbidden"
    CSRF_FAILED = "csrf_failed"
    RATE_LIMITED = "rate_limited"
    EMAIL_TAKEN = "email_taken"
    INVALID_CREDENTIALS = "invalid_credentials"
    ACCOUNT_SUSPENDED = "account_suspended"
    EMAIL_NOT_VERIFIED = "email_not_verified"
    CODE_INVALID = "code_invalid"
    CODE_EXPIRED = "code_expired"
    CODE_LOCKED = "code_locked"
    SESSION_EXPIRED = "session_expired"
    SESSION_REUSED = "session_reused"
    RESET_INVALID = "reset_invalid"
    RESET_EXPIRED = "reset_expired"
    PASSWORD_UNCHANGED = "password_unchanged"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    NOT_PUBLISHABLE = "not_publishable"
    INVALID_STATE = "invalid_state"
    SESSION_CLASH = "session_clash"
    FILE_TYPE = "file_type"
    FILE_TOO_LARGE = "file_too_large"
    FILE_NOT_IMAGE = "file_not_image"


class DomainError(Exception):
    """A failure the user can understand and act on (wrong code, email taken, too many tries)."""

    def __init__(self, code: ErrorCode, message: str, *, field: str | None = None, **extra: Any) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.field = field
        self.extra = extra
