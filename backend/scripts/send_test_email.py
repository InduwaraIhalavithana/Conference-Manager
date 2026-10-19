"""Send one test email through the configured Gmail account, to check GMAIL_USER / GMAIL_APP_PASSWORD.

    python -m scripts.send_test_email you@example.com
"""
from __future__ import annotations

import asyncio
import logging
import sys

from app.core import email
from app.core.config import FRONTEND_URL


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print(__doc__)
        return 2
    if not email.email_enabled():
        print("Gmail is not configured: set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env")
        return 1
    logging.basicConfig(level=logging.INFO)
    msg = email.Message(
        to=sys.argv[1], lang="en", name="there",
        subject="ConferenceHub test email", heading="Email is working",
        paragraphs=[f"This test was sent from {email.GMAIL_USER}. Verification links, tickets and reminders "
                    "will now reach real inboxes."],
        button_label="Open ConferenceHub", button_url=FRONTEND_URL,
    )
    ok = asyncio.run(email.send_message(msg))
    print("Sent." if ok else "Failed: see the error above (a wrong app password shows as an authentication error).")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
