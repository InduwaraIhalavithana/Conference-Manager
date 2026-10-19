"""Six-digit email codes for verifying organizers and confirming attendee registrations.

A row keeps four fields per purpose, e.g. organizers use ``verify_code``, ``verify_expires_at``,
``verify_attempts`` and ``verify_sent_at``; attendees use the same with the ``confirm_`` prefix.
Only an HMAC of the code is stored, so neither a database leak nor guessing offline reveals it.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import VERIFY_CODE_MINUTES
from app.core.errors import AppError
from app.core.security import SECRET_KEY

MAX_ATTEMPTS = 5
RESEND_SECONDS = 60


def _digest(prefix: str, row_id: int, code: str) -> str:
    msg = f"{prefix}:{row_id}:{code}".encode()
    return hmac.new(SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()


def _aware(dt: datetime | None) -> datetime | None:
    return dt if dt is None or dt.tzinfo else dt.replace(tzinfo=UTC)


def issue(row, prefix: str) -> str:
    """Give the row a fresh code (the previous one stops working) and return it for the email."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = datetime.now(UTC)
    setattr(row, f"{prefix}_code", _digest(prefix, row.id, code))
    setattr(row, f"{prefix}_expires_at", now + timedelta(minutes=VERIFY_CODE_MINUTES))
    setattr(row, f"{prefix}_attempts", 0)
    setattr(row, f"{prefix}_sent_at", now)
    return code


def resend_wait(row, prefix: str) -> int:
    """Seconds before another code may be sent (0 when it can go now)."""
    sent = _aware(getattr(row, f"{prefix}_sent_at"))
    if sent is None:
        return 0
    left = RESEND_SECONDS - (datetime.now(UTC) - sent).total_seconds()
    return max(0, int(left + 0.999))


def clear(row, prefix: str) -> None:
    for field, value in (("code", None), ("expires_at", None), ("attempts", 0), ("sent_at", None)):
        setattr(row, f"{prefix}_{field}", value)


def check(db: Session, row, prefix: str, code: str) -> None:
    """Accept the code (and clear it) or raise. Wrong guesses are counted and committed before raising."""
    code = "".join(ch for ch in code if not ch.isspace())
    stored = getattr(row, f"{prefix}_code")
    if not stored:
        raise AppError(400, "code_expired", "No active code: ask for a new one")
    if getattr(row, f"{prefix}_attempts") >= MAX_ATTEMPTS:
        raise AppError(400, "code_locked", "Too many wrong codes: ask for a new one")
    if _aware(getattr(row, f"{prefix}_expires_at")) < datetime.now(UTC):
        raise AppError(400, "code_expired", "This code has expired: ask for a new one")
    if not (len(code) == 6 and code.isdigit() and hmac.compare_digest(stored, _digest(prefix, row.id, code))):
        attempts = getattr(row, f"{prefix}_attempts") + 1
        setattr(row, f"{prefix}_attempts", attempts)
        db.commit()
        if attempts >= MAX_ATTEMPTS:
            raise AppError(400, "code_locked", "Too many wrong codes: ask for a new one")
        raise AppError(400, "code_invalid", "That code is not right", {"remaining": MAX_ATTEMPTS - attempts})
    clear(row, prefix)
