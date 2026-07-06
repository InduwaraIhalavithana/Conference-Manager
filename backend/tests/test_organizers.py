def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_update_profile(client, organizer_token):
    token, _ = organizer_token
    res = client.put("/api/organizers/me", headers=_auth(token), json={
        "first_name": "Updated", "last_name": "Name", "phone": "123456",
    })
    assert res.status_code == 200
    assert res.json()["first_name"] == "Updated"


def test_change_password(client, organizer_token):
    token, _ = organizer_token
    res = client.put("/api/organizers/me/password", headers=_auth(token), json={
        "current_password": "password123", "new_password": "newpassword1",
    })
    assert res.status_code == 204


def test_change_password_wrong_current(client, organizer_token):
    token, _ = organizer_token
    res = client.put("/api/organizers/me/password", headers=_auth(token), json={
        "current_password": "wrongpass", "new_password": "newpassword1",
    })
    assert res.status_code == 400


def test_delete_account(client, organizer_token):
    token, _ = organizer_token
    res = client.request("DELETE", "/api/organizers/me", headers=_auth(token), json={"password": "password123"})
    assert res.status_code == 204
    me = client.get("/auth/me", headers=_auth(token))
    assert me.status_code == 401


def test_delete_account_wrong_password(client, organizer_token):
    token, _ = organizer_token
    res = client.request("DELETE", "/api/organizers/me", headers=_auth(token), json={"password": "wrongpass"})
    assert res.status_code == 400
