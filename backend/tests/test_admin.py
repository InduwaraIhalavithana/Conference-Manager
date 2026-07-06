from datetime import date, timedelta


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_admin_stats(client, admin_token):
    token, _ = admin_token
    res = client.get("/api/admin/stats", headers=_auth(token))
    assert res.status_code == 200
    data = res.json()
    assert "total_organizers" in data
    assert "total_confs" in data


def test_list_organizers(client, admin_token, organizer_token):
    a_token, _ = admin_token
    _, _ = organizer_token
    res = client.get("/api/admin/organizers", headers=_auth(a_token))
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_suspend_unsuspend(client, admin_token, organizer_token, db):
    a_token, _ = admin_token
    _, org = organizer_token
    res = client.put(f"/api/admin/organizers/{org.id}/suspend", headers=_auth(a_token))
    assert res.status_code == 204
    db.refresh(org)
    assert org.is_suspended is True

    res2 = client.put(f"/api/admin/organizers/{org.id}/unsuspend", headers=_auth(a_token))
    assert res2.status_code == 204
    db.refresh(org)
    assert org.is_suspended is False


def test_delete_organizer(client, admin_token, organizer_token):
    a_token, _ = admin_token
    _, org = organizer_token
    res = client.delete(f"/api/admin/organizers/{org.id}", headers=_auth(a_token))
    assert res.status_code == 204


def test_all_conferences(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    future = (date.today() + timedelta(days=10)).isoformat()
    client.post("/api/conferences/", headers=_auth(o_token), json={"title": "Conf A", "date": future, "status": "published"})
    res = client.get("/api/admin/conferences", headers=_auth(a_token))
    assert res.status_code == 200
    assert res.json()["total"] >= 1


def test_admin_delete_conference(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    future = (date.today() + timedelta(days=10)).isoformat()
    conf = client.post("/api/conferences/", headers=_auth(o_token), json={"title": "Del", "date": future, "status": "published"}).json()
    res = client.delete(f"/api/admin/conferences/{conf['id']}", headers=_auth(a_token))
    assert res.status_code == 204


def test_feedback_reply_and_resolve(client, admin_token, organizer_token):
    a_token, _ = admin_token
    o_token, _ = organizer_token
    fb = client.post("/api/feedback/", headers=_auth(o_token), json={"subject": "Bug", "message": "There is a bug"}).json()
    res = client.put(f"/api/admin/feedback/{fb['id']}/reply", headers=_auth(a_token), json={"reply": "Fixed!"})
    assert res.status_code == 204
    res2 = client.put(f"/api/admin/feedback/{fb['id']}/resolve", headers=_auth(a_token))
    assert res2.status_code == 204
