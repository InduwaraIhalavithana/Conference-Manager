"""Six-digit email codes (organizer sign-up now; attendee confirmation in Phase 3).

Only an HMAC of the code is stored, so a database leak does not reveal it. Rules carried over from v2:
valid for VERIFY_CODE_MINUTES, 5 wrong tries lock it, a new code may be sent once a minute.
"""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from pydantic import BaseModel

from app.core.errors import DomainError, ErrorCode

MAX_ATTEMPTS = 5
RESEND_SECONDS = 60


class EmailCode(BaseModel):
    """Embedded in the document that owns the code (for example ``Organizer.verify``)."""

    code_hmac: str
    expires_at: datetime
    attempts: int = 0
    sent_at: datetime


def _digest(secret: str, purpose: str, owner_id: str, code: str) -> str:
    return hmac.new(secret.encode(), f"{purpose}:{owner_id}:{code}".encode(), hashlib.sha256).hexdigest()


def issue(secret: str, purpose: str, owner_id: str, minutes: int) -> tuple[EmailCode, str]:
    """A fresh code (the previous one stops working): (what to store, the code to email)."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(UTC)
    stored = EmailCode(
        code_hmac=_digest(secret, purpose, owner_id, code),
        expires_at=now + timedelta(minutes=minutes),
        sent_at=now,
    )
    return stored, code


def resend_wait(stored: EmailCode | None) -> int:
    """Seconds before another code may be sent (0 when it can go now)."""
    if stored is None:
        return 0
    left = RESEND_SECONDS - (datetime.now(UTC) - stored.sent_at).total_seconds()
    return max(0, int(left + 0.999))


class CodeCheck(BaseModel):
    ok: bool
    stored: EmailCode | None  # what to save back: None once accepted, the counted attempt otherwise


def check(secret: str, purpose: str, owner_id: str, stored: EmailCode | None, entered: str) -> CodeCheck:
    """Accept the code, or count the wrong try. Raises DomainError for expired or locked codes.

    The caller must save ``result.stored`` before raising for a wrong code, so the attempt counts.
    """
    code = "".join(ch for ch in entered if not ch.isspace())
    if stored is None:
        raise DomainError(ErrorCode.CODE_EXPIRED, "No active code: ask for a new one")
    if stored.attempts >= MAX_ATTEMPTS:
        raise DomainError(ErrorCode.CODE_LOCKED, "Too many wrong codes: ask for a new one")
    if stored.expires_at < datetime.now(UTC):
        raise DomainError(ErrorCode.CODE_EXPIRED, "This code has expired: ask for a new one")
    good = (
        len(code) == 6
        and code.isdigit()
        and hmac.compare_digest(stored.code_hmac, _digest(secret, purpose, owner_id, code))
    )
    if good:
        return CodeCheck(ok=True, stored=None)
    return CodeCheck(ok=False, stored=stored.model_copy(update={"attempts": stored.attempts + 1}))


def wrong_code_error(stored: EmailCode) -> DomainError:
    if stored.attempts >= MAX_ATTEMPTS:
        return DomainError(ErrorCode.CODE_LOCKED, "Too many wrong codes: ask for a new one")
    return DomainError(ErrorCode.CODE_INVALID, "That code is not right", remaining=MAX_ATTEMPTS - stored.attempts)
