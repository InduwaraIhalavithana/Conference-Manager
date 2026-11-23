"""The v2 -> v3 data move: dry run writes nothing; organizers keep their password and photo; the admin keeps the
v2 password; only rows about moved accounts come along; running it twice changes nothing."""

import base64
import hashlib
import io
import json
import os
from pathlib import Path

from PIL import Image

from app.models import ActivityLog, Admin, Notification, Organizer
from scripts import migrate_v2
from tests.conftest import Api, unique_email

LOGIN = """mutation($e: String!, $p: String!) { login(email: $e, password: $p) {
  __typename ... on UserError { code } } }"""


def v2_hash(password: str) -> str:
    """A passlib pbkdf2_sha256 hash, as v2 stored them."""
    salt, rounds = os.urandom(16), 1000
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, rounds)

    def ab64(raw: bytes) -> str:
        return base64.b64encode(raw).decode().rstrip("=").replace("+", ".")

    return f"$pbkdf2-sha256${rounds}${ab64(salt)}${ab64(digest)}"


def export(tmp_path: Path, organizer_email: str, admin_email: str) -> tuple[Path, Path]:
    """A tiny v2 export: one real organizer with a photo, a test organizer's leftovers, one admin."""
    uploads = tmp_path / "uploads" / "avatars"
    uploads.mkdir(parents=True)
    photo = io.BytesIO()
    Image.new("RGB", (40, 40), "teal").save(photo, "JPEG")
    (uploads / "me.jpg").write_bytes(photo.getvalue())
    folder = tmp_path / "export"
    folder.mkdir()
    tables = {
        "organizers": [{
            "id": 190, "first_name": "Kamala", "last_name": "Perera", "email": organizer_email.upper(),
            "password_hash": v2_hash("old-v2-password-1"), "phone": None, "is_suspended": False,
            "created_at": "2026-10-19T21:07:13+05:30", "organization": "", "bio": "Hello", "avatar": "/uploads/avatars/me.jpg",
            "lang": "si", "email_verified_at": "2026-10-19T21:07:41+05:30",
        }],
        "admins": [{"id": 1, "username": "v2-admin", "email": admin_email, "password_hash": v2_hash("admin-v2-pass-1"),
                    "created_at": "2026-07-05T18:54:07+05:30"}],
        "notifications": [
            {"id": 1, "recipient_type": "admin", "recipient_id": 1, "kind": "new_organizer", "params": {"name": "Kamala Perera"},
             "link": "/admin/organizers", "is_read": False, "created_at": "2026-10-19T21:07:13+05:30"},
            {"id": 2, "recipient_type": "admin", "recipient_id": 1, "kind": "new_organizer", "params": {"name": "I18n Tester"},
             "link": "/admin/organizers", "is_read": False, "created_at": "2026-10-23T05:14:36+05:30"},
        ],
        "activity_logs": [
            {"id": 1, "organizer_id": 190, "action": "login", "target": organizer_email, "created_at": "2026-10-19T21:10:36+05:30"},
            {"id": 2, "organizer_id": None, "action": "login", "target": "i18n.cm@example.com", "created_at": "2026-10-23T05:14:54+05:30"},
        ],
    }  # fmt: skip
    for name, rows in tables.items():
        (folder / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")
    return folder, tmp_path / "uploads"


async def test_the_v2_data_moves_once_and_keeps_passwords(api: Api, tmp_path: Path) -> None:
    organizer_email, admin_email = unique_email("v2org"), unique_email("v2admin")
    folder, uploads = export(tmp_path, organizer_email, admin_email)

    assert await migrate_v2.main(folder, uploads, write=False, production=False) == 0  # dry run
    assert await Organizer.find_one({"email": organizer_email}) is None
    assert await Admin.find_one({"email": admin_email}) is None

    assert await migrate_v2.main(folder, uploads, write=True, production=False) == 0
    organizer = await Organizer.find_one({"email": organizer_email})
    assert organizer is not None and organizer.lang == "si" and organizer.email_verified_at is not None
    assert organizer.bio is not None and organizer.bio.en == "Hello"
    assert organizer.avatar_url and organizer.avatar_url.endswith(".webp")  # re-encoded like every v3 upload
    admin = await Admin.find_one({"email": admin_email})
    assert admin is not None and admin.password_hash.startswith("$pbkdf2-sha256$")

    notes = await Notification.find({"recipient.id": admin.id}).to_list()
    assert [n.params["name"] for n in notes] == ["Kamala Perera"]  # the test account's news stays behind
    assert await ActivityLog.find({"actor.id": organizer.id}).count() == 1

    # The organizer signs in with the v2 password; the hash is upgraded to Argon2 on the way.
    signed_in = (await api.gql(LOGIN, {"e": organizer_email, "p": "old-v2-password-1"}))["data"]["login"]
    assert signed_in["__typename"] == "SignedIn"
    upgraded = await Organizer.find_one({"email": organizer_email})
    assert upgraded is not None and upgraded.password_hash.startswith("$argon2")

    # A second run moves nothing again (the sign-in above logged one entry of its own).
    activity = await ActivityLog.find({"actor.id": organizer.id}).count()
    assert await migrate_v2.main(folder, uploads, write=True, production=False) == 0
    assert await Organizer.find({"email": organizer_email}).count() == 1
    assert await Notification.find({"recipient.id": admin.id}).count() == 1
    assert await ActivityLog.find({"actor.id": organizer.id}).count() == activity


async def test_an_existing_admin_gets_the_v2_password_hash(tmp_path: Path) -> None:
    admin_email = unique_email("v3admin")
    await Admin(username=f"admin-{admin_email[:12]}", email=admin_email, password_hash="$argon2id$placeholder").insert()
    folder, uploads = export(tmp_path, unique_email("v2org"), admin_email)
    assert await migrate_v2.main(folder, uploads, write=True, production=False) == 0
    admin = await Admin.find_one({"email": admin_email})
    assert admin is not None and admin.password_hash.startswith("$pbkdf2-sha256$")
