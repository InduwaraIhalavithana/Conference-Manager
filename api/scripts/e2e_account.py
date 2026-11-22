"""Create (or reset) the verified organizer the end-to-end tests sign in as.

Reads E2E_ORGANIZER_EMAIL and E2E_ORGANIZER_PASSWORD from the environment; refuses to run in production and
only accepts addresses on example domains, which are never emailed. Run with `uv run python -m scripts.e2e_account`.
"""

import asyncio
import os
import sys
from datetime import UTC, datetime

from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.db import mongo as db
from app.models import Organizer


async def main() -> int:
    settings = get_settings()
    if settings.environment == "production":
        print("Refusing to create a test account in production.", file=sys.stderr)
        return 1
    email = os.environ.get("E2E_ORGANIZER_EMAIL", "e2e.organizer@example.com").lower()
    password = os.environ.get("E2E_ORGANIZER_PASSWORD")
    if not password or len(password) < 12:
        print("Set E2E_ORGANIZER_PASSWORD (12+ characters).", file=sys.stderr)
        return 1
    if email.rsplit("@", 1)[-1] not in {"example.com", "example.org", "example.net"}:
        print("Use an example.com/.org/.net address: they are never emailed.", file=sys.stderr)
        return 1

    await db.connect(settings.mongo_url, settings.mongo_db)
    try:
        organizer = await Organizer.find_one({"email": email})
        if organizer is None:
            organizer = Organizer(first_name="Eesha", last_name="Tester", email=email, password_hash="")
        organizer.password_hash = hash_password(password)
        organizer.email_verified_at = organizer.email_verified_at or datetime.now(UTC)
        organizer.is_suspended = False
        organizer.organization = "End-to-end tests"
        await organizer.save()
        print(f"Test organizer ready: {email}")
    finally:
        await db.disconnect()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
