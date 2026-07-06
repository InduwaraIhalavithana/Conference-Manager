from datetime import date, timedelta


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _make_conf(client, token, days_ahead=30, max_attendees=None):
    d = (date.today() + timedelta(days=days_ahead)).isoformat()
    body = {"title": "Test Conf", "date": d, "status": "published"}
    if max_attendees:
        body["max_attendees"] = max_attendees
    return client.post("/api/conferences/", headers=_auth(token), json=body).json()


def test_register_attendee(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token)
    res = client.post(f"/api/attendees/{conf['id']}", json={"name": "Alice", "email": "alice@x.com"})
    assert res.status_code == 201
    assert res.json()["name"] == "Alice"


def test_register_duplicate_email(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token)
    client.post(f"/api/attendees/{conf['id']}", json={"name": "Alice", "email": "alice@x.com"})
    res = client.post(f"/api/attendees/{conf['id']}", json={"name": "Alice2", "email": "alice@x.com"})
    assert res.status_code == 409


def test_register_past_conference(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token, days_ahead=-5)
    res = client.post(f"/api/attendees/{conf['id']}", json={"name": "Late", "email": "late@x.com"})
    assert res.status_code == 400
    assert "passed" in res.json()["detail"].lower()


def test_list_attendees(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token)
    client.post(f"/api/attendees/{conf['id']}", json={"name": "Bob", "email": "bob@x.com"})
    res = client.get(f"/api/attendees/{conf['id']}", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_cancel_attendee(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token)
    a = client.post(f"/api/attendees/{conf['id']}", json={"name": "Carol", "email": "carol@x.com"}).json()
    res = client.delete(f"/api/attendees/{conf['id']}/{a['id']}", headers=_auth(token))
    assert res.status_code == 204
    listing = client.get(f"/api/attendees/{conf['id']}", headers=_auth(token)).json()
    assert listing == []


def test_csv_export(client, organizer_token):
    token, _ = organizer_token
    conf = _make_conf(client, token)
    client.post(f"/api/attendees/{conf['id']}", json={"name": "Dave", "email": "dave@x.com"})
    res = client.get(f"/api/attendees/{conf['id']}/export", headers=_auth(token))
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Dave" in res.text
