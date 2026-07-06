def test_register(client):
    res = client.post("/auth/register", json={
        "first_name": "Alice", "last_name": "Smith",
        "email": "alice@example.com", "password": "secure123",
    })
    assert res.status_code == 201
    assert "access_token" in res.json()


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


def test_login(client):
    client.post("/auth/register", json={
        "first_name": "Bob", "last_name": "Jones",
        "email": "bob@example.com", "password": "password99",
    })
    res = client.post("/auth/login", json={"email": "bob@example.com", "password": "password99"})
    assert res.status_code == 200
    assert "access_token" in res.json()


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


def test_forgot_password(client, organizer_token):
    _, org = organizer_token
    res = client.post("/auth/forgot-password", json={"email": org.email})
    assert res.status_code == 200
    assert "reset_token" in res.json()


def test_forgot_password_unknown_email(client):
    res = client.post("/auth/forgot-password", json={"email": "nobody@nowhere.com"})
    assert res.status_code == 200
    assert "reset_token" not in res.json()


def test_reset_password(client, organizer_token):
    _, org = organizer_token
    tok_res = client.post("/auth/forgot-password", json={"email": org.email})
    reset_token = tok_res.json()["reset_token"]
    res = client.post("/auth/reset-password", json={"token": reset_token, "new_password": "newpassword1"})
    assert res.status_code == 200
    login = client.post("/auth/login", json={"email": org.email, "password": "newpassword1"})
    assert login.status_code == 200
