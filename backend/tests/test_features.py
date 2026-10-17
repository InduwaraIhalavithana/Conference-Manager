"""Waitlist, tickets and check-in, agenda, uploads, notifications, reminders, analytics, public pages."""
import io
from datetime import date, timedelta

from PIL import Image

from app.core import email
from app.core.email_text import TEXT
from tests.conftest import auth


def _future(days=30):
    return (date.today() + timedelta(days=days)).isoformat()


def _conf(client, token, **extra):
    body = {"title": "Conf", "date": _future(), "status": "published", **extra}
    res = client.post("/api/conferences/", headers=auth(token), json=body)
    assert res.status_code == 201, res.text
    return res.json()


def _register(client, conf_id, name, mail, lang="en"):
    res = client.post(f"/api/attendees/{conf_id}", json={"name": name, "email": mail, "lang": lang})
    assert res.status_code == 201, res.text
    return res.json()


def _png(size=(60, 60), color=(30, 120, 220)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, "PNG")
    return buf.getvalue()


# ── Admin sign-in and error codes ───────────────────────────────────────────

def test_admin_logs_in_with_email(client, admin_token):
    res = client.post("/auth/admin/login", json={"email": "ADMIN@example.com", "password": "Admin@12345"})
    assert res.status_code == 200
    me = client.get("/auth/admin/me", headers=auth(res.json()["access_token"])).json()
    assert me["email"] == "admin@example.com"


def test_admin_login_wrong_password_has_code(client, admin_token):
    res = client.post("/auth/admin/login", json={"email": "admin@example.com", "password": "nope"})
    assert res.status_code == 401
    assert res.json()["code"] == "invalid_credentials"


def test_validation_errors_are_readable(client):
    res = client.post("/auth/register", json={"first_name": "A", "last_name": "B", "email": "bad", "password": "x"})
    assert res.status_code == 422
    body = res.json()
    assert body["code"] == "validation_error"
    assert isinstance(body["detail"], str)
    assert {f["field"] for f in body["fields"]} >= {"email", "password"}


def test_organizer_cannot_use_admin_api(client, organizer_token):
    token, _ = organizer_token
    res = client.get("/api/admin/stats", headers=auth(token))
    assert res.status_code == 401
    assert res.json()["code"] == "not_authenticated"


def test_oversized_fields_are_rejected_not_crashing(client, organizer_token):
    token, _ = organizer_token
    res = client.post("/api/conferences/", headers=auth(token),
                      json={"title": "x" * 300, "date": _future(), "status": "published"})
    assert res.status_code == 422
    res = client.post("/api/conferences/", headers=auth(token),
                      json={"title": "ok", "date": _future(), "category": "Nonsense"})
    assert res.status_code == 422


# ── Waitlist ────────────────────────────────────────────────────────────────

def test_waitlist_promotes_when_organizer_cancels(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, max_attendees=1)
    first = _register(client, conf["id"], "First", "first@x.com")
    second = _register(client, conf["id"], "Second", "second@x.com")
    assert first["status"] == "registered"
    assert second["status"] == "waitlisted" and second["waitlist_position"] == 1

    assert client.delete(f"/api/attendees/{conf['id']}/{first['id']}", headers=auth(token)).status_code == 204
    people = client.get(f"/api/attendees/{conf['id']}", headers=auth(token)).json()
    assert [(p["name"], p["status"]) for p in people] == [("Second", "registered")]
    assert any(m["to"] == "second@x.com" and "seat opened" in m["subject"] for m in email.OUTBOX)


def test_waitlist_promotes_when_capacity_grows(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, max_attendees=1)
    _register(client, conf["id"], "A", "a@x.com")
    _register(client, conf["id"], "B", "b@x.com")
    _register(client, conf["id"], "C", "c@x.com")
    res = client.patch(f"/api/conferences/{conf['id']}", headers=auth(token), json={"max_attendees": 2})
    assert res.json()["attendee_count"] == 2
    assert res.json()["waitlist_count"] == 1


def test_attendee_can_cancel_own_ticket_and_waitlist_moves(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, max_attendees=1)
    a = _register(client, conf["id"], "A", "a@x.com")
    b = _register(client, conf["id"], "B", "b@x.com")
    assert client.delete(f"/api/tickets/{a['ticket_code']}").status_code == 204
    ticket = client.get(f"/api/tickets/{b['ticket_code']}").json()
    assert ticket["attendee"]["status"] == "registered"
    assert client.get(f"/api/tickets/{a['ticket_code']}").status_code == 404


def test_registration_emails_use_attendee_language(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, title="Kandy Tech")
    _register(client, conf["id"], "Nimal", "nimal@x.com", lang="si")
    mail = next(m for m in email.OUTBOX if m["to"] == "nimal@x.com")
    assert mail["lang"] == "si"
    assert mail["subject"] == TEXT["si"]["reg_subject"].format(title="Kandy Tech")


def test_duplicate_email_is_case_insensitive(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    _register(client, conf["id"], "A", "Same@X.com")
    res = client.post(f"/api/attendees/{conf['id']}", json={"name": "A", "email": "same@x.com"})
    assert res.status_code == 409 and res.json()["code"] == "already_registered"


def test_draft_conference_is_hidden_and_closed(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, status="draft")
    assert client.get(f"/api/conferences/{conf['id']}").status_code == 404
    res = client.post(f"/api/attendees/{conf['id']}", json={"name": "A", "email": "a@x.com"})
    assert res.status_code == 404


# ── Tickets and check-in ────────────────────────────────────────────────────

def test_check_in_by_code_and_qr_url(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    a = _register(client, conf["id"], "A", "a@x.com")
    scanned = f"http://localhost:5174/tickets/{a['ticket_code']}"
    res = client.post(f"/api/attendees/{conf['id']}/check-in", headers=auth(token), json={"code": scanned})
    assert res.status_code == 200 and res.json()["checked_in_at"]
    again = client.post(f"/api/attendees/{conf['id']}/check-in", headers=auth(token),
                        json={"code": a["ticket_code"].lower()})
    assert again.status_code == 409 and again.json()["code"] == "already_checked_in"
    assert again.json()["name"] == "A"


def test_waitlisted_ticket_cannot_check_in(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, max_attendees=1)
    _register(client, conf["id"], "A", "a@x.com")
    b = _register(client, conf["id"], "B", "b@x.com")
    res = client.post(f"/api/attendees/{conf['id']}/check-in", headers=auth(token), json={"code": b["ticket_code"]})
    assert res.status_code == 409 and res.json()["code"] == "ticket_waitlisted"


def test_other_organizer_cannot_check_in(client, organizer_token, other_organizer_token):
    token, _ = organizer_token
    other, _ = other_organizer_token
    conf = _conf(client, token)
    a = _register(client, conf["id"], "A", "a@x.com")
    res = client.post(f"/api/attendees/{conf['id']}/check-in", headers=auth(other), json={"code": a["ticket_code"]})
    assert res.status_code == 404
    assert client.get(f"/api/attendees/{conf['id']}", headers=auth(other)).status_code == 404
    assert client.get(f"/api/conferences/mine/{conf['id']}", headers=auth(other)).status_code == 404


def test_manual_check_in_toggle(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    a = _register(client, conf["id"], "A", "a@x.com")
    on = client.put(f"/api/attendees/{conf['id']}/{a['id']}/check-in?checked_in=true", headers=auth(token)).json()
    assert on["checked_in_at"]
    off = client.put(f"/api/attendees/{conf['id']}/{a['id']}/check-in?checked_in=false", headers=auth(token)).json()
    assert off["checked_in_at"] is None


def test_csv_export_has_status_and_ticket(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    _register(client, conf["id"], "නිමල්", "n@x.com")
    res = client.get(f"/api/attendees/{conf['id']}/export", headers=auth(token))
    assert "Ticket code" in res.text and "නිමල්" in res.text and "registered" in res.text


# ── Agenda and speakers ─────────────────────────────────────────────────────

def test_agenda_and_speakers(client, organizer_token, other_organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    base = f"/api/conferences/{conf['id']}"
    sp = client.post(f"{base}/speakers", headers=auth(token), json={"name": "Dr. Perera", "job_title": "CTO"}).json()
    s1 = client.post(f"{base}/sessions", headers=auth(token),
                     json={"title": "Keynote", "start_time": "09:00", "end_time": "10:00", "kind": "keynote",
                           "speaker_id": sp["id"]})
    assert s1.status_code == 201
    bad = client.post(f"{base}/sessions", headers=auth(token),
                      json={"title": "Bad", "start_time": "11:00", "end_time": "10:00"})
    assert bad.status_code == 422

    details = client.get(f"{base}/details").json()
    assert details["sessions"][0]["title"] == "Keynote"
    assert details["speakers"][0]["name"] == "Dr. Perera"
    assert details["conference"]["speaker_count"] == 1 and details["conference"]["session_count"] == 1

    other, _ = other_organizer_token
    assert client.post(f"{base}/speakers", headers=auth(other), json={"name": "X"}).status_code == 404

    assert client.delete(f"{base}/speakers/{sp['id']}", headers=auth(token)).status_code == 204
    details = client.get(f"{base}/details").json()
    assert details["sessions"][0]["speaker_id"] is None


def test_session_speaker_must_belong_to_conference(client, organizer_token):
    token, _ = organizer_token
    c1, c2 = _conf(client, token), _conf(client, token)
    sp = client.post(f"/api/conferences/{c1['id']}/speakers", headers=auth(token), json={"name": "A"}).json()
    res = client.post(f"/api/conferences/{c2['id']}/sessions", headers=auth(token),
                      json={"title": "T", "start_time": "09:00", "speaker_id": sp["id"]})
    assert res.status_code == 404 and res.json()["code"] == "speaker_not_found"


def test_calendar_file(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, title="Big, Day; 2026", time="09:30", end_time="17:00", location="Galle")
    res = client.get(f"/api/conferences/{conf['id']}/calendar.ics")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/calendar")
    assert "SUMMARY:Big\\, Day\\; 2026" in res.text and "T093000" in res.text and "LOCATION:Galle" in res.text


# ── Uploads ─────────────────────────────────────────────────────────────────

def test_profile_photo_upload_replace_remove(client, organizer_token):
    from app.core.config import UPLOAD_DIR
    token, _ = organizer_token
    first = client.post("/api/organizers/me/photo", headers=auth(token),
                        files={"file": ("me.png", _png(), "image/png")}).json()["avatar"]
    assert first.startswith("/uploads/avatars/") and first.endswith(".webp")
    second = client.post("/api/organizers/me/photo", headers=auth(token),
                         files={"file": ("me2.png", _png(color=(200, 0, 0)), "image/png")}).json()["avatar"]
    assert second != first
    assert not (UPLOAD_DIR / first.removeprefix("/uploads/")).exists()  # replaced file is gone
    assert client.get(second).status_code == 200
    cleared = client.delete("/api/organizers/me/photo", headers=auth(token)).json()
    assert cleared["avatar"] is None
    assert not (UPLOAD_DIR / second.removeprefix("/uploads/")).exists()


def test_upload_limits(client, organizer_token):
    token, _ = organizer_token
    wrong_type = client.post("/api/organizers/me/photo", headers=auth(token),
                             files={"file": ("x.gif", b"GIF89a", "image/gif")})
    assert wrong_type.status_code == 415 and wrong_type.json()["code"] == "file_type"
    fake = client.post("/api/organizers/me/photo", headers=auth(token),
                       files={"file": ("x.png", b"not really a png", "image/png")})
    assert fake.status_code == 415 and fake.json()["code"] == "file_not_image"
    big = client.post("/api/organizers/me/photo", headers=auth(token),
                      files={"file": ("big.png", b"\x89PNG" + b"0" * (2 * 1024 * 1024 + 10), "image/png")})
    assert big.status_code == 413 and big.json()["code"] == "file_too_large" and big.json()["max_mb"] == 2


def test_cover_and_speaker_photo(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    res = client.post(f"/api/conferences/{conf['id']}/cover", headers=auth(token),
                      files={"file": ("c.png", _png((1800, 900)), "image/png")})
    assert res.json()["cover_image"].startswith("/uploads/covers/")
    assert client.delete(f"/api/conferences/{conf['id']}/cover", headers=auth(token)).json()["cover_image"] is None
    sp = client.post(f"/api/conferences/{conf['id']}/speakers", headers=auth(token), json={"name": "S"}).json()
    res = client.post(f"/api/conferences/{conf['id']}/speakers/{sp['id']}/photo", headers=auth(token),
                      files={"file": ("s.png", _png(), "image/png")})
    assert res.json()["photo"].startswith("/uploads/speakers/")


# ── Notifications ───────────────────────────────────────────────────────────

def test_organizer_notifications_and_mark_seen(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, title="Notify Me")
    _register(client, conf["id"], "A", "a@x.com")
    _register(client, conf["id"], "B", "b@x.com")
    data = client.get("/api/notifications/", headers=auth(token)).json()
    assert data["unread"] == 2
    assert data["items"][0]["kind"] == "new_registration"
    assert data["items"][0]["params"] == {"attendee": "B", "conference": "Notify Me"}

    first_id = data["items"][0]["id"]
    assert client.put(f"/api/notifications/{first_id}/read", headers=auth(token)).status_code == 204
    assert client.get("/api/notifications/unread-count", headers=auth(token)).json()["unread"] == 1
    assert client.put("/api/notifications/read-all", headers=auth(token)).status_code == 204
    assert client.get("/api/notifications/unread-count", headers=auth(token)).json()["unread"] == 0


def test_admin_notified_and_lists_are_private(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    client.post("/auth/register", json={"first_name": "New", "last_name": "Org", "email": "new@x.com",
                                        "password": "password123"})
    client.post("/api/feedback/", headers=auth(o_token), json={"subject": "Hi", "message": "Hello admin"})
    kinds = [n["kind"] for n in client.get("/api/notifications/", headers=auth(a_token)).json()["items"]]
    assert {"new_organizer", "new_feedback"} <= set(kinds)
    admin_note = client.get("/api/notifications/", headers=auth(a_token)).json()["items"][0]["id"]
    # An organizer cannot mark the admin's notification.
    assert client.put(f"/api/notifications/{admin_note}/read", headers=auth(o_token)).status_code == 404
    assert client.get("/api/notifications/").status_code == 401


def test_feedback_reply_notifies_organizer(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    fb = client.post("/api/feedback/", headers=auth(o_token), json={"subject": "Bug", "message": "Help"}).json()
    client.put(f"/api/admin/feedback/{fb['id']}/reply", headers=auth(a_token), json={"reply": "Fixed"})
    kinds = [n["kind"] for n in client.get("/api/notifications/", headers=auth(o_token)).json()["items"]]
    assert "feedback_reply" in kinds


# ── Reminders ───────────────────────────────────────────────────────────────

def test_reminders_go_out_once_the_day_before(client, organizer_token):
    from app.core.reminders import collect_due
    token, _ = organizer_token
    conf = _conf(client, token, title="Tomorrow Conf")
    moved = client.patch(f"/api/conferences/{conf['id']}", headers=auth(token),
                         json={"date": (date.today() + timedelta(days=1)).isoformat()})
    assert moved.status_code == 200, moved.text
    _register(client, conf["id"], "A", "a@x.com", lang="ta")
    messages = collect_due()
    assert [m.to for m in messages] == ["a@x.com"]
    assert messages[0].subject == TEXT["ta"]["remind_subject"].format(title="Tomorrow Conf")
    assert collect_due() == []  # not sent twice
    kinds = [n["kind"] for n in client.get("/api/notifications/", headers=auth(token)).json()["items"]]
    assert "conference_tomorrow" in kinds


def test_send_reminders_now(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token)
    _register(client, conf["id"], "A", "a@x.com")
    res = client.post(f"/api/conferences/{conf['id']}/reminders", headers=auth(token))
    assert res.json() == {"sent": 1, "email_enabled": False}


# ── Search, analytics and public pages ──────────────────────────────────────

def test_public_search_filters(client, organizer_token):
    token, _ = organizer_token
    _conf(client, token, title="AI Summit", location="Kandy, Sri Lanka", category="Tech")
    _conf(client, token, title="Health Forum", location="Galle, Sri Lanka", category="Health")
    _conf(client, token, title="Old Event", date=(date.today() - timedelta(days=3)).isoformat())
    titles = lambda url: [c["title"] for c in client.get(url).json()["items"]]  # noqa: E731
    assert titles("/api/conferences/upcoming?q=summit") == ["AI Summit"]
    assert titles("/api/conferences/upcoming?city=galle") == ["Health Forum"]
    assert titles("/api/conferences/upcoming?category=Tech") == ["AI Summit"]
    assert titles("/api/conferences/upcoming?when=past") == ["Old Event"]


def test_suspended_organizer_conferences_are_hidden(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, org = organizer_token
    conf = _conf(client, o_token, title="Hidden")
    client.put(f"/api/admin/organizers/{org.id}/suspend", headers=auth(a_token))
    assert client.get("/api/conferences/upcoming").json()["total"] == 0
    assert client.post(f"/api/attendees/{conf['id']}", json={"name": "A", "email": "a@x.com"}).status_code == 404


def test_organizer_analytics(client, organizer_token):
    token, _ = organizer_token
    conf = _conf(client, token, max_attendees=2, category="Tech")
    a = _register(client, conf["id"], "A", "a@x.com")
    _register(client, conf["id"], "B", "b@x.com")
    _register(client, conf["id"], "C", "c@x.com")
    client.post(f"/api/attendees/{conf['id']}/check-in", headers=auth(token), json={"code": a["ticket_code"]})
    data = client.get("/api/organizers/me/analytics?days=14", headers=auth(token)).json()
    assert data["totals"]["registered"] == 2 and data["totals"]["waitlisted"] == 1
    assert data["totals"]["checked_in"] == 1 and data["totals"]["avg_fill"] == 100
    assert len(data["trend"]) == 14 and data["trend"][-1]["registrations"] == 3
    assert data["by_category"][0]["category"] == "Tech"


def test_admin_analytics_and_lists(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    conf = _conf(client, o_token, category="Tech", location="Colombo, Sri Lanka")
    _register(client, conf["id"], "A", "a@x.com")
    data = client.get("/api/admin/analytics", headers=auth(a_token)).json()
    assert data["by_category"] == [{"category": "Tech", "conferences": 1, "registered": 1}]
    assert len(data["by_month"]) == 12 and data["cities"][0]["city"] == "Colombo"
    orgs = client.get("/api/admin/organizers?q=test", headers=auth(a_token)).json()
    assert orgs["items"][0]["conference_count"] == 1 and orgs["items"][0]["attendee_count"] == 1
    assert "password_hash" not in orgs["items"][0]
    stats = client.get("/api/admin/stats", headers=auth(a_token)).json()
    assert stats["total_attendees"] == 1 and stats["open_contacts"] == 0


def test_public_stats_featured_and_contact(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    conf = _conf(client, o_token, location="Kandy, Sri Lanka")
    _register(client, conf["id"], "A", "a@x.com")
    stats = client.get("/api/public/stats").json()
    assert stats["upcoming"] == 1 and stats["attendees"] == 1
    assert stats["recent"][0]["title"] == "Conf" and "name" not in stats["recent"][0]
    assert client.get("/api/public/featured").json()["next"][0]["id"] == conf["id"]

    res = client.post("/api/public/contact", json={"name": "Visitor", "email": "v@x.com", "subject": "Question",
                                                   "message": "How do I join?"})
    assert res.status_code == 201
    msgs = client.get("/api/admin/contacts", headers=auth(a_token)).json()
    assert msgs[0]["subject"] == "Question"
    kinds = [n["kind"] for n in client.get("/api/notifications/", headers=auth(a_token)).json()["items"]]
    assert "new_contact" in kinds


def test_deleting_organizer_removes_their_data(client, admin_token, organizer_token, db):
    from app.models.attendee import Attendee
    from app.models.notification import Notification
    a_token, _ = admin_token
    o_token, org = organizer_token
    org_id = org.id
    conf = _conf(client, o_token)
    _register(client, conf["id"], "A", "a@x.com")
    assert client.delete(f"/api/admin/organizers/{org_id}", headers=auth(a_token)).status_code == 204
    db.expire_all()
    assert db.query(Attendee).count() == 0
    assert db.query(Notification).filter_by(recipient_type="organizer", recipient_id=org_id).count() == 0


def test_email_text_keys_match_in_every_language():
    keys = set(TEXT["en"])
    for lang, table in TEXT.items():
        assert set(table) == keys, lang
        for key, value in table.items():
            assert value.strip(), (lang, key)
            # placeholders must survive translation
            import re
            assert set(re.findall(r"{\w+}", value)) == set(re.findall(r"{\w+}", TEXT["en"][key])), (lang, key)
