"""Read-only database health check. Prints one line per rule; exits 1 if any rule fails.

    python -m scripts.check_integrity
"""
from __future__ import annotations

import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.core.config import CONFIRM_HOLD_HOURS, REMINDER_INTERVAL_SECONDS, UPLOAD_DIR
from app.db.database import engine

# An unconfirmed registration should be gone within one loop round after its hold ends.
_STALE_HOLD = datetime.now(UTC) - timedelta(hours=CONFIRM_HOLD_HOURS, seconds=REMINDER_INTERVAL_SECONDS + 300)

CHECKS = {
    "attendees without a conference":
        "select count(*) from attendees a left join conferences c on c.id = a.conference_id where c.id is null",
    "conferences without an organizer":
        "select count(*) from conferences c left join organizers o on o.id = c.organizer_id where o.id is null",
    "speakers or sessions without a conference":
        "select (select count(*) from speakers s left join conferences c on c.id = s.conference_id where c.id is null)"
        " + (select count(*) from sessions s left join conferences c on c.id = s.conference_id where c.id is null)",
    "sessions pointing at another conference's speaker":
        "select count(*) from sessions s join speakers p on p.id = s.speaker_id where p.conference_id <> s.conference_id",
    "attendees without a ticket code": "select count(*) from attendees where ticket_code is null",
    "duplicate ticket codes":
        "select count(*) from (select ticket_code from attendees group by ticket_code having count(*) > 1) x",
    "same email twice in one conference":
        "select count(*) from (select conference_id, lower(email) from attendees group by 1, 2 having count(*) > 1) x",
    "conferences over capacity":
        "select count(*) from conferences c where max_attendees is not null and (select count(*) from attendees a"
        " where a.conference_id = c.id and a.status = 'registered') > c.max_attendees",
    # Only confirmed people are promoted, so an unconfirmed waitlister may wait next to a free seat.
    "people waiting while seats are free":
        "select count(*) from conferences c where (select count(*) from attendees a where a.conference_id = c.id"
        " and a.status = 'waitlisted' and a.confirmed_at is not null) > 0 and (c.max_attendees is null or (select count(*) from attendees a"
        " where a.conference_id = c.id and a.status = 'registered') < c.max_attendees)",
    "checked in while on the waitlist":
        "select count(*) from attendees where checked_in_at is not null and status <> 'registered'",
    "checked in without a confirmed email":
        "select count(*) from attendees where checked_in_at is not null and confirmed_at is null",
    "confirmed tickets still holding a confirmation link":
        "select count(*) from attendees where confirmed_at is not null and confirm_token is not null",
    "verified organizers still holding a verification link":
        "select count(*) from organizers where email_verified_at is not null and verify_token is not null",
    "unconfirmed seat holds past their time":
        f"select count(*) from attendees where confirmed_at is null and registered_at < '{_STALE_HOLD.isoformat()}'",
    "unknown attendee status": "select count(*) from attendees where status not in ('registered', 'waitlisted')",
    "unknown conference status or topic":
        "select count(*) from conferences where status not in ('published', 'draft') or (category is not null and"
        " category not in ('Tech', 'Health', 'Education', 'Business', 'Science', 'Arts', 'Other'))",
    "end time before start time": "select count(*) from conferences where end_time <= time",
    "notifications for deleted organizers":
        "select count(*) from notifications n left join organizers o on o.id = n.recipient_id"
        " where n.recipient_type = 'organizer' and o.id is null",
    "notifications for deleted admins":
        "select count(*) from notifications n left join admins a on a.id = n.recipient_id"
        " where n.recipient_type = 'admin' and a.id is null",
    "feedback without an organizer":
        "select count(*) from feedback f left join organizers o on o.id = f.organizer_id where o.id is null",
    "admins without an email": "select count(*) from admins where email is null",
}


def main() -> int:
    failed = 0
    print(f"Database: {engine.url.render_as_string(hide_password=True)}")
    with engine.connect() as conn:
        for name, sql in CHECKS.items():
            n = conn.execute(text(sql)).scalar() or 0
            failed += bool(n)
            print(f"{'OK  ' if not n else 'FAIL'} {name}: {n}")
        refs: set[str] = set()
        for sql in ("select avatar from organizers", "select cover_image from conferences", "select photo from speakers"):
            refs |= {r[0] for r in conn.execute(text(sql)) if r[0]}
    missing = [r for r in refs if not (UPLOAD_DIR / r.removeprefix("/uploads/")).exists()]
    stray = {f"/uploads/{p.parent.name}/{p.name}" for p in UPLOAD_DIR.glob("*/*.webp")} - refs
    failed += bool(missing)
    print(f"{'OK  ' if not missing else 'FAIL'} images referenced but missing on disk: {len(missing)}")
    print(f"{'OK  ' if not stray else 'NOTE'} image files no row uses: {len(stray)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
