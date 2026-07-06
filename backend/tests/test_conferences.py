from datetime import date, timedelta


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_create_conference(client, organizer_token):
    token, _ = organizer_token
    res = client.post("/api/conferences/", headers=_auth(token), json={
        "title": "DevConf 2027", "date": "2027-06-15", "location": "London",
        "status": "published",
    })
    assert res.status_code == 201
    assert res.json()["title"] == "DevConf 2027"


def test_list_my_conferences(client, organizer_token):
    token, _ = organizer_token
    client.post("/api/conferences/", headers=_auth(token), json={"title": "C1", "date": "2027-01-01", "status": "published"})
    res = client.get("/api/conferences/", headers=_auth(token))
    assert res.status_code == 200
    assert len(res.json()["items"]) == 1


def test_upcoming_conferences_filters_draft(client, organizer_token):
    token, _ = organizer_token
    future = (date.today() + timedelta(days=10)).isoformat()
    client.post("/api/conferences/", headers=_auth(token), json={"title": "Draft", "date": future, "status": "draft"})
    client.post("/api/conferences/", headers=_auth(token), json={"title": "Live", "date": future, "status": "published"})
    res = client.get("/api/conferences/upcoming")
    assert res.status_code == 200
    titles = [c["title"] for c in res.json()["items"]]
    assert "Live" in titles
    assert "Draft" not in titles


def test_past_conferences(client, organizer_token):
    token, _ = organizer_token
    past = (date.today() - timedelta(days=5)).isoformat()
    client.post("/api/conferences/", headers=_auth(token), json={"title": "Past Conf", "date": past, "status": "published"})
    res = client.get("/api/conferences/past", headers=_auth(token))
    assert res.status_code == 200
    assert any(c["title"] == "Past Conf" for c in res.json())


def test_update_conference(client, organizer_token):
    token, _ = organizer_token
    conf = client.post("/api/conferences/", headers=_auth(token), json={"title": "Old", "date": "2027-01-01", "status": "published"}).json()
    res = client.put(f"/api/conferences/{conf['id']}", headers=_auth(token), json={
        "title": "Updated", "date": "2027-01-01", "status": "published",
    })
    assert res.status_code == 200
    assert res.json()["title"] == "Updated"


def test_patch_conference(client, organizer_token):
    token, _ = organizer_token
    conf = client.post("/api/conferences/", headers=_auth(token), json={"title": "PatchMe", "date": "2027-01-01", "status": "published"}).json()
    res = client.patch(f"/api/conferences/{conf['id']}", headers=_auth(token), json={"title": "Patched"})
    assert res.status_code == 200
    assert res.json()["title"] == "Patched"


def test_delete_conference(client, organizer_token):
    token, _ = organizer_token
    conf = client.post("/api/conferences/", headers=_auth(token), json={"title": "Delete me", "date": "2027-01-01", "status": "published"}).json()
    res = client.delete(f"/api/conferences/{conf['id']}", headers=_auth(token))
    assert res.status_code == 204


def test_conference_capacity(client, organizer_token):
    token, _ = organizer_token
    future = (date.today() + timedelta(days=30)).isoformat()
    conf = client.post("/api/conferences/", headers=_auth(token), json={
        "title": "Capped", "date": future, "status": "published", "max_attendees": 1,
    }).json()
    r1 = client.post(f"/api/attendees/{conf['id']}", json={"name": "A", "email": "a@a.com"})
    assert r1.status_code == 201
    r2 = client.post(f"/api/attendees/{conf['id']}", json={"name": "B", "email": "b@b.com"})
    assert r2.status_code == 400
    assert "full" in r2.json()["detail"].lower()
