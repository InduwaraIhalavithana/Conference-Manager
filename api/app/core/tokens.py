"""Signed tokens (PyJWT, HS256) and the random values behind emailed links and CSRF checks."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt

ALGORITHM = "HS256"
SubjectType = Literal["organizer", "admin"]
TokenKind = Literal["access", "refresh"]


@dataclass(frozen=True)
class TokenClaims:
    subject_id: str
    subject_type: SubjectType
    session_id: str
    kind: TokenKind
    jti: str
    expires_at: datetime


def encode_token(
    secret: str,
    *,
    subject_id: str,
    subject_type: SubjectType,
    session_id: str,
    kind: TokenKind,
    lifetime: timedelta,
    jti: str | None = None,
) -> tuple[str, TokenClaims]:
    now = datetime.now(UTC)
    claims = TokenClaims(
        subject_id=subject_id,
        subject_type=subject_type,
        session_id=session_id,
        kind=kind,
        jti=jti or secrets.token_urlsafe(16),
        expires_at=now + lifetime,
    )
    payload = {
        "sub": subject_id,
        "typ": subject_type,
        "sid": session_id,
        "knd": kind,
        "jti": claims.jti,
        "iat": now,
        "exp": claims.expires_at,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM), claims


def decode_token(secret: str, token: str, kind: TokenKind) -> TokenClaims | None:
    """The claims of a valid, unexpired token of the given kind, or None."""
    try:
        data = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"require": ["exp", "sub", "sid", "jti"]})
    except jwt.PyJWTError:
        return None
    if data.get("knd") != kind or data.get("typ") not in ("organizer", "admin"):
        return None
    return TokenClaims(
        subject_id=str(data["sub"]),
        subject_type=data["typ"],
        session_id=str(data["sid"]),
        kind=kind,
        jti=str(data["jti"]),
        expires_at=datetime.fromtimestamp(data["exp"], UTC),
    )


def new_link_token() -> tuple[str, str]:
    """A token for an emailed link: (raw value for the link, SHA-256 hash to store)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_link_token(raw)


def hash_link_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_csrf_token() -> str:
    return secrets.token_urlsafe(24)
