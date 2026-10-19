from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta

from jose import JWTError, jwt
from passlib.context import CryptContext

import app.core.config  # noqa: F401  (loads backend/.env before SECRET_KEY is read)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is not set")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# pbkdf2_sha256 — compatible with Python 3.14+. bcrypt extra breaks on 3.14.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_token(token: str) -> str:
    """Emailed link tokens are stored hashed, so a database leak cannot be used to click them."""
    return hashlib.sha256(token.encode()).hexdigest()


def new_link_token() -> tuple[str, str]:
    """A fresh token for an emailed link: (raw value for the link, hash to store)."""
    raw = secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict) -> str:
    expire = datetime.now(UTC) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {**data, "exp": expire}
    if "sub" in payload:
        payload["sub"] = str(payload["sub"])
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None
