from tests.conftest import emailed_link


def test_register(client):
    res = client.post("/auth/register", json={
        "first_name": "Alice", "last_name": "Smith",
        "email": "alice@example.com", "password": "secure123",
    })
    assert res.status_code == 201
    # No token until the email is verified; the link goes to the inbox instead.
    assert "access_token" not in res.json() and res.json()["code"] == "verify_sent"
    assert "verify-email?token=" in emailed_link("alice@example.com")


def test_register_duplicate_email(client):
    data = {"first_name": "A", "last_name": "B", "email": "dup@example.com", "password": "secure123"}
    client.post("/auth/register", json=data)
    res = client.post("/auth/register", json=data)
    assert res.status_code == 409


def test_register_short_password(client):
    res = client.post("/auth/register", json={
        "first_name": "A", "last_name": "B", "email": "a@b.com", "password": "short",
    })
    assert res.status_code == 422


def test_login_requires_verified_email(client):
    client.post("/auth/register", json={
        "first_name": "Bob", "last_name": "Jones",
        "email": "bob@example.com", "password": "password99",
    })
    res = client.post("/auth/login", json={"email": "bob@example.com", "password": "password99"})
    assert res.status_code == 403 and res.json()["code"] == "email_not_verified"
    token = emailed_link("bob@example.com").split("token=")[1]
    verified = client.post("/auth/verify-email", json={"token": token})
    assert verified.status_code == 200 and "access_token" in verified.json()
    res = client.post("/auth/login", json={"email": "bob@example.com", "password": "password99"})
    assert res.status_code == 200
    assert "access_token" in res.json()
    # One use only.
    again = client.post("/auth/verify-email", json={"token": token})
    assert again.status_code == 400 and again.json()["code"] == "verify_invalid"


def test_wrong_password_does_not_reveal_unverified(client):
    client.post("/auth/register", json={"first_name": "E", "last_name": "F", "email": "e@f.com",
                                        "password": "password99"})
    res = client.post("/auth/login", json={"email": "e@f.com", "password": "wrongpass1"})
    assert res.status_code == 401


def test_resend_verification_replaces_the_link(client):
    client.post("/auth/register", json={"first_name": "G", "last_name": "H", "email": "g@h.com",
                                        "password": "password99"})
    old = emailed_link("g@h.com").split("token=")[1]
    res = client.post("/auth/resend-verification", json={"email": "g@h.com"})
    assert res.status_code == 200 and res.json()["code"] == "verify_sent"
    new = emailed_link("g@h.com").split("token=")[1]
    assert old != new
    assert client.post("/auth/verify-email", json={"token": old}).status_code == 400
    assert client.post("/auth/verify-email", json={"token": new}).status_code == 200
    # Unknown addresses get the same answer.
    assert client.post("/auth/resend-verification", json={"email": "nobody@x.com"}).json()["code"] == "verify_sent"


def test_expired_verification_link(client, db):
    from datetime import UTC, datetime, timedelta

    from app.models.organizer import Organizer
    client.post("/auth/register", json={"first_name": "I", "last_name": "J", "email": "i@j.com",
                                        "password": "password99"})
    token = emailed_link("i@j.com").split("token=")[1]
    org = db.query(Organizer).filter_by(email="i@j.com").one()
    org.verify_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    res = client.post("/auth/verify-email", json={"token": token})
    assert res.status_code == 400 and res.json()["code"] == "verify_expired"


def test_password_reset_also_verifies_email(client):
    client.post("/auth/register", json={"first_name": "K", "last_name": "L", "email": "k@l.com",
                                        "password": "password99"})
    client.post("/auth/forgot-password", json={"email": "k@l.com"})
    reset = emailed_link("k@l.com").split("token=")[1]
    client.post("/auth/reset-password", json={"token": reset, "new_password": "newpassword1"})
    assert client.post("/auth/login", json={"email": "k@l.com", "password": "newpassword1"}).status_code == 200


def test_login_wrong_password(client):
    client.post("/auth/register", json={
        "first_name": "C", "last_name": "D",
        "email": "c@d.com", "password": "password99",
    })
    res = client.post("/auth/login", json={"email": "c@d.com", "password": "wrongpass"})
    assert res.status_code == 401


def test_token_refresh(client, organizer_token):
    token, _ = organizer_token
    res = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_get_me(client, organizer_token):
    token, org = organizer_token
    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == org.email


def test_forgot_password_never_returns_the_token(client, organizer_token):
    _, org = organizer_token
    res = client.post("/auth/forgot-password", json={"email": org.email})
    assert res.status_code == 200
    assert "reset_token" not in res.json()
    assert "token" not in res.text.lower().replace("reset link", "")


def test_forgot_password_unknown_email(client):
    res = client.post("/auth/forgot-password", json={"email": "nobody@nowhere.com"})
    assert res.status_code == 200
    assert "reset_token" not in res.json()


def _emailed_token(org_email):
    from app.core import email
    link = next(m["link"] for m in reversed(email.OUTBOX) if m["to"] == org_email)
    return link.split("token=")[1]


def test_reset_password(client, organizer_token):
    _, org = organizer_token
    client.post("/auth/forgot-password", json={"email": org.email})
    reset_token = _emailed_token(org.email)
    res = client.post("/auth/reset-password", json={"token": reset_token, "new_password": "newpassword1"})
    assert res.status_code == 200
    login = client.post("/auth/login", json={"email": org.email, "password": "newpassword1"})
    assert login.status_code == 200
    # The link works once only.
    again = client.post("/auth/reset-password", json={"token": reset_token, "new_password": "another-pass1"})
    assert again.status_code == 400
    assert again.json()["code"] == "reset_invalid"


def test_reset_tokens_are_stored_hashed(client, organizer_token, db):
    from app.models.password_reset import PasswordResetToken
    _, org = organizer_token
    client.post("/auth/forgot-password", json={"email": org.email})
    raw = _emailed_token(org.email)
    stored = db.query(PasswordResetToken).filter_by(organizer_id=org.id).one().token
    assert stored != raw and len(stored) == 64
