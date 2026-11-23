"""Move the v2 data (PostgreSQL, exported to JSON) into v3 (MongoDB). A dry run unless --yes is given.

Export first (read-only on v2), one JSON array per table, into a git-ignored folder, e.g.:

    psql "$V2_URL" -At -c "select coalesce(json_agg(row_to_json(t)), '[]'::json) from organizers t" > organizers.json
    (and the same for admins, notifications, activity_logs, feedback, contact_messages)

Then:

    uv run python -m scripts.migrate_v2 ../backups/v2-export-2026-11-23 --uploads ../backups/v2-local-files-2026-11-23/uploads          # dry run
    uv run python -m scripts.migrate_v2 ../backups/v2-export-2026-11-23 --uploads ../backups/v2-local-files-2026-11-23/uploads --yes    # write

What moves (Phase 8 decisions in the plan):
- Organizers, with their v2 password hashes (PBKDF2; replaced by Argon2 at the next sign-in) and profile photo
  (re-encoded like every v3 upload). An organizer whose email is already in v3 is left alone, and so are their rows.
- The admin: the v2 password hash is copied onto the v3 admin with the same email, so the password stays exactly
  as it is (or the admin is created if v3 has none with that email). Passwords are never read or printed.
- Notifications and activity that belong to a moved organizer; rows about test or deleted accounts stay behind
  in the v2 backup. Feedback and contact messages, if any.
- Not moved: password-reset tokens and email codes (short-lived), conferences and registrations (none in v2).

Refuses to run against a production database unless --production is given (Phase 9).
"""

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from beanie import PydanticObjectId

from app.core.settings import get_settings
from app.db import mongo
from app.models import ActivityLog, Admin, ContactMessage, Feedback, Notification, Organizer
from app.models.common import ActorRef, LocalizedText
from app.services import uploads

LANGS = {"en", "si", "ta"}
TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


@dataclass
class Report:
    lines: list[str] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)

    def add(self, what: str, n: int = 1) -> None:
        self.counts[what] = self.counts.get(what, 0) + n

    def say(self, line: str) -> None:
        self.lines.append(line)


def when(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def load(folder: Path, table: str) -> list[dict[str, Any]]:
    path = folder / f"{table}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


async def move_organizers(
    rows: list[dict[str, Any]], v2_uploads: Path | None, write: bool, r: Report
) -> dict[int, PydanticObjectId]:
    """Returns v2 id -> v3 id for the organizers moved in this run."""
    moved: dict[int, PydanticObjectId] = {}
    for row in rows:
        email = row["email"].strip().lower()
        if await Organizer.find_one({"email": email}):
            r.say(f"organizer {email}: already in v3, left alone (and their notifications and activity)")
            r.add("organizers already there")
            continue
        avatar_url = None
        if row.get("avatar") and v2_uploads:
            source = v2_uploads / row["avatar"].removeprefix("/uploads/")
            if source.is_file():
                avatar_url = (
                    await uploads.save_image("avatar", TYPES.get(source.suffix.lower()), source.read_bytes())
                    if write
                    else "(re-encoded)"
                )
            else:
                r.say(f"organizer {email}: photo {row['avatar']} not found, moved without it")
        organizer = Organizer(
            first_name=row["first_name"],
            last_name=row["last_name"],
            email=email,
            password_hash=row["password_hash"],
            phone=row.get("phone"),
            organization=row.get("organization") or None,
            bio=LocalizedText(en=row["bio"]) if row.get("bio") else None,
            avatar_url=avatar_url,
            lang=row["lang"] if row.get("lang") in LANGS else "en",
            is_suspended=bool(row.get("is_suspended")),
            email_verified_at=when(row.get("email_verified_at")),
            created_at=when(row["created_at"]) or datetime.now(),
        )
        if write:
            await organizer.insert()
        else:
            organizer.id = PydanticObjectId()
        assert organizer.id is not None
        moved[row["id"]] = organizer.id
        r.say(
            f"organizer {email}: moved (verified: {organizer.email_verified_at is not None}, photo: {bool(avatar_url)})"
        )
        r.add("organizers moved")
    return moved


async def move_admins(rows: list[dict[str, Any]], write: bool, r: Report) -> dict[int, PydanticObjectId]:
    ids: dict[int, PydanticObjectId] = {}
    for row in rows:
        email = (row.get("email") or "").strip().lower()
        existing = await Admin.find_one({"email": email}) if email else None
        if existing:
            assert existing.id is not None
            same = existing.password_hash == row["password_hash"]
            if write and not same:
                await existing.set({"password_hash": row["password_hash"]})
            r.say(f"admin {email}: {'password already the v2 one' if same else 'v2 password hash copied in'}")
            r.add("admins updated" if not same else "admins unchanged")
            ids[row["id"]] = existing.id
        else:
            admin = Admin(
                username=row["username"],
                email=email,
                password_hash=row["password_hash"],
                created_at=when(row["created_at"]) or datetime.now(),
            )
            if write:
                await admin.insert()
            else:
                admin.id = PydanticObjectId()
            assert admin.id is not None
            ids[row["id"]] = admin.id
            r.say(f"admin {email}: created with the v2 password")
            r.add("admins created")
    return ids


async def move_notifications(
    rows: list[dict[str, Any]], organizers: dict[int, PydanticObjectId], admins: dict[int, PydanticObjectId],
    names: set[str], write: bool, r: Report,
) -> None:  # fmt: skip
    for row in rows:
        kind, params = row["kind"], row.get("params") or {}
        recipient = (
            ActorRef(type="admin", id=admins.get(row["recipient_id"]))
            if row["recipient_type"] == "admin"
            else ActorRef(type="organizer", id=organizers.get(row["recipient_id"]))
        )
        # Keep it only if its reader is moved and, for news about an organizer, that organizer was moved too.
        about_moved = kind != "new_organizer" or params.get("name") in names
        if recipient.id is None or not about_moved:
            r.add("notifications left behind")
            continue
        created = when(row["created_at"]) or datetime.now()
        note = Notification(recipient=recipient, kind=kind, params=params, link=row.get("link"),
                            read_at=created if row.get("is_read") else None, created_at=created)  # fmt: skip
        if write:
            await note.insert()
        r.add("notifications moved")


async def move_activity(
    rows: list[dict[str, Any]], organizers: dict[int, PydanticObjectId], write: bool, r: Report
) -> None:
    for row in rows:
        actor_id = organizers.get(row.get("organizer_id"))  # type: ignore[arg-type]
        if actor_id is None:
            r.add("activity left behind")
            continue
        entry = ActivityLog(actor=ActorRef(type="organizer", id=actor_id), action=row["action"], target=row.get("target"),
                            meta={"from": "v2"}, created_at=when(row["created_at"]) or datetime.now())  # fmt: skip
        if write:
            await entry.insert()
        r.add("activity moved")


async def move_messages(
    feedback: list[dict[str, Any]],
    contacts: list[dict[str, Any]],
    organizers: dict[int, PydanticObjectId],
    write: bool,
    r: Report,
) -> None:
    for row in feedback:
        organizer_id = organizers.get(row.get("organizer_id"))  # type: ignore[arg-type]
        if organizer_id is None:
            r.add("feedback left behind")
            continue
        doc = Feedback.model_validate(
            {**{k: v for k, v in row.items() if k not in ("id", "organizer_id")}, "organizer_id": organizer_id}
        )
        if write:
            await doc.insert()
        r.add("feedback moved")
    for row in contacts:
        doc = ContactMessage.model_validate({k: v for k, v in row.items() if k != "id"})
        if write:
            await doc.insert()
        r.add("contact messages moved")


async def main(folder: Path, v2_uploads: Path | None, write: bool, production: bool) -> int:
    settings = get_settings()
    if settings.is_production and not production:
        print("This is a production database: add --production to really mean it.", file=sys.stderr)
        return 2
    await mongo.connect(settings.mongo_url, settings.mongo_db)
    r = Report()
    org_rows = load(folder, "organizers")
    organizers = await move_organizers(org_rows, v2_uploads, write, r)
    names = {f"{row['first_name']} {row['last_name']}" for row in org_rows if row["id"] in organizers}
    admins = await move_admins(load(folder, "admins"), write, r)
    await move_notifications(load(folder, "notifications"), organizers, admins, names, write, r)
    await move_activity(load(folder, "activity_logs"), organizers, write, r)
    await move_messages(load(folder, "feedback"), load(folder, "contact_messages"), organizers, write, r)

    print("WRITTEN to" if write else "DRY RUN (nothing written) for", f"database {settings.mongo_db}:")
    for line in r.lines:
        print("  -", line)
    for what, n in sorted(r.counts.items()):
        print(f"  {what}: {n}")
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("folder", type=Path, help="folder with the v2 JSON export")
    parser.add_argument("--uploads", type=Path, help="v2 backend/uploads folder (for profile photos)")
    parser.add_argument("--yes", action="store_true", help="really write (otherwise a dry run)")
    parser.add_argument("--production", action="store_true", help="allow a production database")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.folder, args.uploads, args.yes, args.production)))
