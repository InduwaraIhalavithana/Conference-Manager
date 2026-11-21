"""Creates the admin account on first start, from ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD.

The password only ever comes from the environment: it is not generated, printed, logged or stored anywhere
except as an Argon2 hash. Without it, no admin is created and the API says so in its log.
"""

from app.core.logging import get_logger
from app.core.passwords import hash_password
from app.core.settings import Settings
from app.models import Admin
from app.repositories import accounts

log = get_logger("admin_seed")


async def ensure_admin(settings: Settings) -> Admin | None:
    existing = await accounts.any_admin()
    if existing is not None:
        return existing
    if settings.admin_initial_password is None:
        log.warning("no admin account yet: set ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD in api/.env and restart")
        return None
    admin = Admin(
        username="admin",
        email=settings.admin_email,
        password_hash=hash_password(settings.admin_initial_password.get_secret_value()),
    )
    await accounts.insert_admin(admin)
    log.info("admin account created", email=admin.email)
    return admin
