"""The three cookies v3 uses. Tokens live only in httpOnly cookies, so page scripts can never read them."""

import secrets
from datetime import UTC, datetime

from fastapi import Request, Response

from app.core.settings import get_settings
from app.core.tokens import new_csrf_token

ACCESS = "cm_access"
REFRESH = "cm_refresh"
# Readable by the web app, which copies it into the X-CSRF-Token header on every mutation (double submit).
CSRF = "cm_csrf"
CSRF_HEADER = "x-csrf-token"


def _max_age(expires_at: datetime) -> int:
    return max(0, int((expires_at - datetime.now(UTC)).total_seconds()))


def set_session(
    response: Response, *, access: str, access_expires: datetime, refresh: str, refresh_expires: datetime
) -> None:
    secure = get_settings().cookie_secure
    response.set_cookie(
        ACCESS, access, max_age=_max_age(access_expires), httponly=True, secure=secure, samesite="lax", path="/"
    )
    response.set_cookie(
        REFRESH, refresh, max_age=_max_age(refresh_expires), httponly=True, secure=secure, samesite="lax", path="/"
    )


def clear_session(response: Response) -> None:
    secure = get_settings().cookie_secure
    for name in (ACCESS, REFRESH):
        response.delete_cookie(name, httponly=True, secure=secure, samesite="lax", path="/")


def ensure_csrf(request: Request, response: Response) -> str:
    """The request's CSRF token, setting a new cookie when it has none."""
    token = request.cookies.get(CSRF)
    if not token:
        token = new_csrf_token()
        response.set_cookie(
            CSRF,
            token,
            max_age=60 * 60 * 24 * 30,
            httponly=False,
            secure=get_settings().cookie_secure,
            samesite="lax",
            path="/",
        )
    return token


def csrf_ok(request: Request) -> bool:
    cookie = request.cookies.get(CSRF)
    header = request.headers.get(CSRF_HEADER)
    return bool(cookie and header and secrets.compare_digest(cookie, header))


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"
