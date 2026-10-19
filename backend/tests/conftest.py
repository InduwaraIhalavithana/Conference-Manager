import os
import tempfile
from datetime import UTC, datetime
from pathlib import Path

# Must run before any app import: tests use their own SQLite file and upload folder,
# skip migrations / the reminder loop, and never touch the real conference_db.
_TMP = Path(tempfile.mkdtemp(prefix="cm-tests-"))
os.environ["CM_TESTING"] = "1"
os.environ["DATABASE_URL"] = f"sqlite:///{(_TMP / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_TMP / "uploads")
os.environ.setdefault("SECRET_KEY", "test-secret-key-that-is-long-enough-123")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import event  # noqa: E402

import app.models  # noqa: E402,F401
from app.core import email  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models.admin import Admin  # noqa: E402
from app.models.organizer import Organizer  # noqa: E402

assert engine.url.get_backend_name() == "sqlite", "tests must never run against Postgres"


@event.listens_for(engine, "connect")
def _sqlite_fk(dbapi_conn, _):
    # Make ON DELETE CASCADE / SET NULL behave like Postgres.
    dbapi_conn.execute("PRAGMA foreign_keys=ON")


@pytest.fixture(autouse=True)
def reset_db():
    Base.metadata.create_all(bind=engine)
    email.OUTBOX.clear()
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_organizer(db, email_addr="test@example.com", password="password123", first="Test"):
    org = Organizer(first_name=first, last_name="Organizer", email=email_addr, password_hash=hash_password(password),
                    email_verified_at=datetime.now(UTC))
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@pytest.fixture
def organizer_token(db):
    org = make_organizer(db)
    return create_access_token({"sub": org.id, "type": "organizer"}), org


@pytest.fixture
def other_organizer_token(db):
    org = make_organizer(db, "other@example.com", first="Other")
    return create_access_token({"sub": org.id, "type": "organizer"}), org


@pytest.fixture
def admin_token(db):
    admin = Admin(username="testadmin", email="admin@example.com", password_hash=hash_password("Admin@12345"))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return create_access_token({"sub": admin.id, "type": "admin"}), admin


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def emailed_link(to: str) -> str:
    """The button link of the latest email sent to this address."""
    return next(m["link"] for m in reversed(email.OUTBOX) if m["to"] == to)


def emailed_code(to: str) -> str:
    """The 6-digit code in the latest email that carried one to this address."""
    return next(m["code"] for m in reversed(email.OUTBOX) if m["to"] == to and m.get("code"))


def confirm(client, attendee: dict) -> dict:
    """Enter the code that was emailed to a newly registered attendee."""
    code = emailed_code(attendee["email"])
    res = client.post(f"/api/tickets/{attendee['ticket_code']}/confirm", json={"code": code})
    assert res.status_code == 200, res.text
    return res.json()["attendee"]
