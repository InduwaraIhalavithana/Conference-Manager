"""Auth flows end to end over GraphQL, with cookies, against the real MongoDB and Redis."""

from datetime import UTC, datetime, timedelta

from app.core.passwords import hash_password
from app.core.tokens import hash_link_token
from app.models import ActivityLog, Admin, AuthSession, Notification, Organizer, PasswordReset
from app.repositories import accounts
from tests.conftest import ADMIN_PASSWORD, OUTBOX, Api, unique_email

REGISTER = """
mutation($input: RegisterInput!) {
  register(input: $input) {
    __typename
    ... on CodeSent { email resendAfterSeconds }
    ... on UserError { code field message }
  }
}"""
VERIFY = """
mutation($email: String!, $code: String!) {
  verifyEmail(email: $email, code: $code) {
    __typename
    ... on SignedIn { viewer { __typename ... on Organizer { email emailVerified } } }
    ... on UserError { code remainingAttempts }
  }
}"""
LOGIN = """
mutation($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    __typename
    ... on SignedIn { viewer { ... on Organizer { email } } }
    ... on UserError { code message }
  }
}"""
ADMIN_LOGIN = """
mutation($email: String!, $password: String!) {
  adminLogin(email: $email, password: $password) {
    __typename
    ... on SignedIn { viewer { __typename ... on Admin { username email } } }
    ... on UserError { code }
  }
}"""
ME = "{ me { __typename ... on Organizer { email } ... on Admin { username } } }"
REFRESH = "mutation { refresh { __typename ... on UserError { code } } }"
LOGOUT = "mutation { logout { ok } }"
PASSWORD = "Str0ng-enough-pass"


def register_vars(email: str, **extra: object) -> dict[str, object]:
    return {"input": {"firstName": "Asha", "lastName": "Perera", "email": email, "password": PASSWORD, **extra}}


async def register_and_verify(api: Api, email: str) -> None:
    assert (await api.gql(REGISTER, register_vars(email)))["data"]["register"]["__typename"] == "CodeSent"
    code = OUTBOX.last_to(email, "verify_code").params["code"]
    result = (await api.gql(VERIFY, {"email": email, "code": code}))["data"]["verifyEmail"]
    assert result["__typename"] == "SignedIn"


# ── Sign-up and verification ─────────────────────────────────────────────────────────────────────────


async def test_register_sends_a_code_and_verifying_signs_in(api: Api) -> None:
    email = unique_email()
    res = (await api.gql(REGISTER, register_vars(email.upper(), organization="  ", lang="si")))["data"]["register"]
    assert res == {"__typename": "CodeSent", "email": email, "resendAfterSeconds": 60}

    org = await accounts.organizer_by_email(email)
    assert org is not None and org.email_verified_at is None and org.organization is None and org.lang == "si"
    assert org.password_hash.startswith("$argon2id$")
    message = OUTBOX.last_to(email, "verify_code")
    assert message.lang == "si" and message.params["code"] not in org.model_dump_json()

    assert (await api.gql(ME))["data"]["me"] is None
    result = (await api.gql(VERIFY, {"email": email, "code": message.params["code"]}))["data"]["verifyEmail"]
    assert result["viewer"] == {"__typename": "Organizer", "email": email, "emailVerified": True}
    assert (await api.gql(ME))["data"]["me"] == {"__typename": "Organizer", "email": email}

    cookie_header = api.http.cookies
    assert cookie_header.get("cm_access") and cookie_header.get("cm_refresh")
    assert await ActivityLog.find_one({"action": "verify_email", "target": email}) is not None


async def test_session_cookies_are_httponly_and_lax(api: Api) -> None:
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    code = OUTBOX.last_to(email, "verify_code").params["code"]
    await api.http.get("/auth/csrf")
    res = await api.http.post(
        "/graphql",
        json={"query": VERIFY, "variables": {"email": email, "code": code}},
        headers={"X-CSRF-Token": api.http.cookies["cm_csrf"]},
    )
    set_cookies = res.headers.get_list("set-cookie")
    for name in ("cm_access", "cm_refresh"):
        line = next(c for c in set_cookies if c.startswith(f"{name}="))
        assert "HttpOnly" in line and "SameSite=lax" in line and "Path=/" in line


async def test_register_rejects_a_taken_email_and_bad_input(api: Api) -> None:
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    taken = (await api.gql(REGISTER, register_vars(email)))["data"]["register"]
    assert taken["code"] == "EMAIL_TAKEN" and taken["field"] == "email"

    short = (await api.gql(REGISTER, register_vars(unique_email(), password="short")))["data"]["register"]
    assert short["code"] == "VALIDATION" and short["field"] == "password"
    bad_email = (await api.gql(REGISTER, register_vars("not-an-email")))["data"]["register"]
    assert bad_email["code"] == "VALIDATION" and bad_email["field"] == "email"


async def test_register_notifies_the_admin(api: Api) -> None:
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    admin = await Admin.find_one({"email": "admin@example.com"})
    assert admin is not None
    note = await Notification.find_one({"recipient.id": admin.id, "kind": "new_organizer"})
    assert note is not None and note.params == {"name": "Asha Perera"}


async def test_wrong_codes_count_down_then_lock(api: Api) -> None:
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    code = OUTBOX.last_to(email, "verify_code").params["code"]
    wrong = "000000" if code != "000000" else "111111"
    remaining = []
    for _ in range(5):
        res = (await api.gql(VERIFY, {"email": email, "code": wrong}))["data"]["verifyEmail"]
        remaining.append((res["code"], res["remainingAttempts"]))
    assert remaining == [
        ("CODE_INVALID", 4),
        ("CODE_INVALID", 3),
        ("CODE_INVALID", 2),
        ("CODE_INVALID", 1),
        ("CODE_LOCKED", None),
    ]
    locked = (await api.gql(VERIFY, {"email": email, "code": code}))["data"]["verifyEmail"]
    assert locked["code"] == "CODE_LOCKED"


async def test_unknown_email_looks_like_a_wrong_code(api: Api) -> None:
    res = (await api.gql(VERIFY, {"email": unique_email(), "code": "123456"}))["data"]["verifyEmail"]
    assert res == {"__typename": "UserError", "code": "CODE_INVALID", "remainingAttempts": 5}


async def test_resend_gives_the_same_answer_and_waits_a_minute(api: Api) -> None:
    resend = "mutation($e: String!) { resendCode(email: $e) { ... on CodeSent { email resendAfterSeconds } } }"
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    sent_before = len(OUTBOX.outbox)
    known = (await api.gql(resend, {"e": email}))["data"]["resendCode"]
    unknown = (await api.gql(resend, {"e": "nobody@example.com"}))["data"]["resendCode"]
    assert known["resendAfterSeconds"] == unknown["resendAfterSeconds"] == 60
    assert len(OUTBOX.outbox) == sent_before  # the first code went out less than a minute ago


# ── Sign-in ──────────────────────────────────────────────────────────────────────────────────────────


async def test_login_needs_a_verified_email(api: Api) -> None:
    email = unique_email()
    await api.gql(REGISTER, register_vars(email))
    res = (await api.gql(LOGIN, {"email": email, "password": PASSWORD}))["data"]["login"]
    assert res["code"] == "EMAIL_NOT_VERIFIED"


async def test_login_wrong_password_and_unknown_email_look_the_same(api: Api) -> None:
    email = unique_email()
    await register_and_verify(api, email)
    wrong = (await api.gql(LOGIN, {"email": email, "password": "nope-nope"}))["data"]["login"]
    unknown = (await api.gql(LOGIN, {"email": unique_email(), "password": PASSWORD}))["data"]["login"]
    assert (
        wrong
        == unknown
        == {"__typename": "UserError", "code": "INVALID_CREDENTIALS", "message": "Wrong email or password"}
    )


async def test_login_works_and_logout_ends_the_session(api: Api, other_api: Api) -> None:
    email = unique_email()
    await register_and_verify(other_api, email)
    res = (await api.gql(LOGIN, {"email": email.upper(), "password": PASSWORD}))["data"]["login"]
    assert res == {"__typename": "SignedIn", "viewer": {"email": email}}
    old_access = api.http.cookies["cm_access"]

    assert (await api.gql(LOGOUT))["data"]["logout"] == {"ok": True}
    assert (await api.gql(ME))["data"]["me"] is None
    # The old access token stops working at once, because its session is revoked.
    api.http.cookies.set("cm_access", old_access)
    assert (await api.gql(ME))["data"]["me"] is None


async def test_suspended_organizer_is_refused_and_signed_out(api: Api) -> None:
    email = unique_email()
    await register_and_verify(api, email)
    org = await accounts.organizer_by_email(email)
    assert org is not None
    org.is_suspended = True
    await org.save()
    assert (await api.gql(ME))["data"]["me"] is None
    res = (await api.gql(LOGIN, {"email": email, "password": PASSWORD}))["data"]["login"]
    assert res["code"] == "ACCOUNT_SUSPENDED"


async def test_v2_password_hash_is_upgraded_at_sign_in(api: Api) -> None:
    from tests.test_core import V2_HASH, V2_PASSWORD

    email = unique_email("legacy")
    await Organizer(
        first_name="Old", last_name="Account", email=email, password_hash=V2_HASH, email_verified_at=datetime.now(UTC)
    ).insert()
    res = (await api.gql(LOGIN, {"email": email, "password": V2_PASSWORD}))["data"]["login"]
    assert res["__typename"] == "SignedIn"
    org = await accounts.organizer_by_email(email)
    assert org is not None and org.password_hash.startswith("$argon2id$")


async def test_admin_signs_in_by_email_or_username(api: Api, other_api: Api) -> None:
    by_email = (await api.gql(ADMIN_LOGIN, {"email": "ADMIN@example.com", "password": ADMIN_PASSWORD}))["data"]
    assert by_email["adminLogin"]["viewer"] == {
        "__typename": "Admin",
        "username": "admin",
        "email": "admin@example.com",
    }
    assert (await api.gql(ME))["data"]["me"] == {"__typename": "Admin", "username": "admin"}

    by_name = (await other_api.gql(ADMIN_LOGIN, {"email": "admin", "password": ADMIN_PASSWORD}))["data"]
    assert by_name["adminLogin"]["__typename"] == "SignedIn"
    wrong = (await other_api.gql(ADMIN_LOGIN, {"email": "admin", "password": "wrong-password"}))["data"]
    assert wrong["adminLogin"] == {"__typename": "UserError", "code": "INVALID_CREDENTIALS"}


async def test_admin_password_is_only_stored_as_a_hash() -> None:
    admin = await Admin.find_one({"username": "admin"})
    assert admin is not None and admin.password_hash.startswith("$argon2id$")
    assert ADMIN_PASSWORD not in admin.model_dump_json()


# ── Sessions ─────────────────────────────────────────────────────────────────────────────────────────


async def test_refresh_rotates_the_token(api: Api) -> None:
    await register_and_verify(api, unique_email())
    first_refresh = api.http.cookies["cm_refresh"]
    assert (await api.gql(REFRESH))["data"]["refresh"]["__typename"] == "SignedIn"
    assert api.http.cookies["cm_refresh"] != first_refresh
    assert (await api.gql(REFRESH))["data"]["refresh"]["__typename"] == "SignedIn"


async def test_reusing_an_old_refresh_token_revokes_the_session(api: Api) -> None:
    email = unique_email()
    await register_and_verify(api, email)
    stolen = api.http.cookies["cm_refresh"]
    await api.gql(REFRESH)  # the real owner refreshes, so `stolen` is now old

    api.http.cookies.set("cm_refresh", stolen)
    res = (await api.gql(REFRESH))["data"]["refresh"]
    assert res == {"__typename": "UserError", "code": "SESSION_REUSED"}
    org = await accounts.organizer_by_email(email)
    assert org is not None
    sessions = await AuthSession.find({"subject_id": org.id}).to_list()
    assert sessions and all(s.revoked_reason == "refresh_token_reused" for s in sessions)
    assert await ActivityLog.find_one({"action": "refresh_reuse_detected", "actor.id": org.id}) is not None


async def test_refresh_without_a_cookie_is_refused(api: Api) -> None:
    assert (await api.gql(REFRESH))["data"]["refresh"] == {"__typename": "UserError", "code": "SESSION_EXPIRED"}


# ── Passwords ────────────────────────────────────────────────────────────────────────────────────────

FORGOT = "mutation($e: String!) { forgotPassword(email: $e) { __typename } }"
RESET = """mutation($t: String!, $p: String!) {
  resetPassword(token: $t, newPassword: $p) { __typename ... on UserError { code } } }"""
CHANGE = """mutation($c: String!, $n: String!) {
  changePassword(currentPassword: $c, newPassword: $n) { __typename ... on UserError { code field } } }"""


async def test_forgot_and_reset_password_signs_out_everywhere(api: Api, other_api: Api) -> None:
    email = unique_email()
    await register_and_verify(other_api, email)  # other_api stays signed in on "another device"

    assert (await api.gql(FORGOT, {"e": email}))["data"]["forgotPassword"]["__typename"] == "Done"
    assert (await api.gql(FORGOT, {"e": unique_email()}))["data"]["forgotPassword"]["__typename"] == "Done"
    link = OUTBOX.last_to(email, "password_reset").params["link"]
    token = link.split("token=", 1)[1]
    assert await PasswordReset.find_one({"token_hash": token}) is None  # only the hash is stored

    assert (await api.gql(RESET, {"t": token, "p": "Brand-new-pass-9"}))["data"]["resetPassword"][
        "__typename"
    ] == "Done"
    assert (await api.gql(RESET, {"t": token, "p": "Brand-new-pass-9"}))["data"]["resetPassword"][
        "code"
    ] == "RESET_INVALID"
    assert (await other_api.gql(ME))["data"]["me"] is None
    assert (await api.gql(LOGIN, {"email": email, "password": "Brand-new-pass-9"}))["data"]["login"][
        "__typename"
    ] == "SignedIn"


async def test_expired_reset_link_is_refused(api: Api) -> None:
    email = unique_email()
    await register_and_verify(api, email)
    org = await accounts.organizer_by_email(email)
    assert org is not None and org.id is not None
    await PasswordReset(
        organizer_id=org.id,
        token_hash=hash_link_token("old-token-value"),
        expires_at=datetime.now(UTC) - timedelta(minutes=1),
    ).insert()
    res = (await api.gql(RESET, {"t": "old-token-value", "p": "Brand-new-pass-9"}))["data"]["resetPassword"]
    assert res["code"] == "RESET_EXPIRED"


async def test_change_password_keeps_this_device_and_signs_out_others(api: Api, other_api: Api) -> None:
    email = unique_email()
    await register_and_verify(api, email)
    await other_api.gql(LOGIN, {"email": email, "password": PASSWORD})

    wrong = (await api.gql(CHANGE, {"c": "not-current", "n": "Another-pass-77"}))["data"]["changePassword"]
    assert wrong == {"__typename": "UserError", "code": "INVALID_CREDENTIALS", "field": "currentPassword"}
    same = (await api.gql(CHANGE, {"c": PASSWORD, "n": PASSWORD}))["data"]["changePassword"]
    assert same["code"] == "PASSWORD_UNCHANGED"

    assert (await api.gql(CHANGE, {"c": PASSWORD, "n": "Another-pass-77"}))["data"]["changePassword"][
        "__typename"
    ] == "Done"
    assert (await api.gql(ME))["data"]["me"] == {"__typename": "Organizer", "email": email}
    assert (await other_api.gql(ME))["data"]["me"] is None


async def test_change_password_needs_sign_in(api: Api) -> None:
    res = (await api.gql(CHANGE, {"c": "x", "n": "Another-pass-77"}))["data"]["changePassword"]
    assert res["code"] == "NOT_AUTHENTICATED"


# ── Platform protections ─────────────────────────────────────────────────────────────────────────────


async def test_mutations_without_the_csrf_header_are_refused(api: Api) -> None:
    body = await api.gql(LOGIN, {"email": unique_email(), "password": PASSWORD}, csrf=False)
    assert body["data"] is None
    assert body["errors"][0]["extensions"]["code"] == "csrf_failed"
    # Queries do not need it.
    assert "errors" not in await api.gql(ME, csrf=False)


async def test_login_is_rate_limited_per_ip(api: Api) -> None:
    codes = []
    for _ in range(11):
        res = (await api.gql(LOGIN, {"email": unique_email(), "password": PASSWORD}))["data"]["login"]
        codes.append(res["code"])
    assert codes[:10] == ["INVALID_CREDENTIALS"] * 10
    assert codes[10] == "RATE_LIMITED"


async def test_queries_with_too_many_aliases_are_refused(api: Api) -> None:
    deep = "{ me { ... on Organizer { email } } " + "".join(f"a{i}: me {{ __typename }} " for i in range(20)) + "}"
    body = await api.gql(deep)
    assert body.get("errors")


async def test_seeded_admin_is_created_once() -> None:
    assert await Admin.find({}).count() == 1
    org_count_before = await Organizer.find({}).count()
    assert org_count_before >= 0
    assert hash_password("x") != hash_password("x")  # salted
