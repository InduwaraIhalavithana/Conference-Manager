"""Rate limits per IP (or per account) on the endpoints people could abuse: sign-in, sign-up, codes, resets."""

from dataclasses import dataclass

from app.core.errors import DomainError, ErrorCode
from app.core.settings import get_settings
from app.repositories import ratelimits


@dataclass(frozen=True)
class Limit:
    name: str
    requests: int
    window_seconds: int = 60


# Same numbers as v2's slowapi limits.
REGISTER = Limit("register", 10)
LOGIN = Limit("login", 10)
ADMIN_LOGIN = Limit("admin_login", 10)
VERIFY = Limit("verify", 10)
RESEND = Limit("resend", 3)
FORGOT = Limit("forgot", 5)
RESET = Limit("reset", 10)
REFRESH = Limit("refresh", 30)
UPLOAD = Limit("upload", 30)


async def enforce(limit: Limit, ident: str) -> None:
    count, reset_in = await ratelimits.hit(limit.name, ident, limit.window_seconds)
    # RATE_LIMIT_SCALE (end-to-end tests only; always 1 in production) multiplies the allowance.
    if count > limit.requests * get_settings().rate_limit_scale:
        raise DomainError(
            ErrorCode.RATE_LIMITED, "Too many attempts: wait a moment and try again", retry_after=reset_in
        )
