from tests.conftest import emailed_code, emailed_link


def _signup(client, mail, password="password99"):
    res = client.post("/auth/register", json={"first_name": "A", "last_name": "B", "email": mail, "password": password})
    assert res.status_code == 201, res.text
    return res.json()


def _age_last_code(db, mail, seconds=61):
    """Pretend the last code went out a while ago, so a new one may be sent."""
    from datetime import UTC, datetime, timedelta

    from app.models.organizer import Organizer
    org = db.query(Organizer).filter_by(email=mail).one()
    org.verify_sent_at = datetime.now(UTC) - timedelta(seconds=seconds)
    db.commit()
    return org


def test_register(client):
    res = _signup(client, "alice@example.com")
    # No token until the email is verified; a 6-digit code goes to the inbox instead.
    assert "access_token" not in res and res["code"] == "verify_sent"
    code = emailed_code("alice@example.com")
    assert len(code) == 6 and code.isdigit()
    assert "verify-email?email=" in emailed_link("alice@example.com")


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
    _signup(client, "bob@example.com")
    res = client.post("/auth/login", json={"email": "bob@example.com", "password": "password99"})
    assert res.status_code == 403 and res.json()["code"] == "email_not_verified"
    code = emailed_code("bob@example.com")
    verified = client.post("/auth/verify-email", json={"email": "BOB@example.com", "code": f" {code[:3]} {code[3:]} "})
    assert verified.status_code == 200 and "access_token" in verified.json()
    res = client.post("/auth/login", json={"email": "bob@example.com", "password": "password99"})
    assert res.status_code == 200
    assert "access_token" in res.json()
    # One use only.
    again = client.post("/auth/verify-email", json={"email": "bob@example.com", "code": code})
    assert again.status_code == 400 and again.json()["code"] == "code_invalid"


def test_wrong_code_counts_down_then_locks(client):
    _signup(client, "c@d.com")
    code = emailed_code("c@d.com")
    wrong = "000000" if code != "000000" else "111111"
    for left in (4, 3, 2, 1):
        res = client.post("/auth/verify-email", json={"email": "c@d.com", "code": wrong})
        assert res.json()["code"] == "code_invalid" and res.json()["remaining"] == left
    assert client.post("/auth/verify-email", json={"email": "c@d.com", "code": wrong}).json()["code"] == "code_locked"
    # Even the right code no longer works: a new one has to be sent.
    assert client.post("/auth/verify-email", json={"email": "c@d.com", "code": code}).json()["code"] == "code_locked"


def test_wrong_password_does_not_reveal_unverified(client):
    _signup(client, "e@f.com")
    res = client.post("/auth/login", json={"email": "e@f.com", "password": "wrongpass1"})
    assert res.status_code == 401


def test_resend_verification_replaces_the_code(client, db):
    _signup(client, "g@h.com")
    old = emailed_code("g@h.com")
    sent = len(email_outbox())
    # Within a minute nothing new is sent, but the answer looks the same.
    assert client.post("/auth/resend-verification", json={"email": "g@h.com"}).json()["code"] == "verify_sent"
    assert len(email_outbox()) == sent
    _age_last_code(db, "g@h.com")
    res = client.post("/auth/resend-verification", json={"email": "g@h.com"})
    assert res.status_code == 200 and res.json()["code"] == "verify_sent"
    new = emailed_code("g@h.com")
    if new != old:  # 1 in a million they match
        assert client.post("/auth/verify-email", json={"email": "g@h.com", "code": old}).status_code == 400
    assert client.post("/auth/verify-email", json={"email": "g@h.com", "code": new}).status_code == 200
    # Unknown addresses get the same answer.
    assert client.post("/auth/resend-verification", json={"email": "nobody@x.com"}).json()["code"] == "verify_sent"


def test_expired_code(client, db):
    from datetime import UTC, datetime, timedelta

    from app.models.organizer import Organizer
    _signup(client, "i@j.com")
    code = emailed_code("i@j.com")
    org = db.query(Organizer).filter_by(email="i@j.com").one()
    org.verify_expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db.commit()
    res = client.post("/auth/verify-email", json={"email": "i@j.com", "code": code})
    assert res.status_code == 400 and res.json()["code"] == "code_expired"


def test_codes_are_stored_as_hmac(client, db):
    from app.models.organizer import Organizer
    _signup(client, "m@n.com")
    code = emailed_code("m@n.com")
    stored = db.query(Organizer).filter_by(email="m@n.com").one().verify_code
    assert code not in stored and len(stored) == 64


def test_password_reset_also_verifies_email(client):
    _signup(client, "k@l.com")
    client.post("/auth/forgot-password", json={"email": "k@l.com"})
    reset = emailed_link("k@l.com").split("token=")[1]
    client.post("/auth/reset-password", json={"token": reset, "new_password": "newpassword1"})
    assert client.post("/auth/login", json={"email": "k@l.com", "password": "newpassword1"}).status_code == 200


def email_outbox():
    from app.core import email
    return email.OUTBOX


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
