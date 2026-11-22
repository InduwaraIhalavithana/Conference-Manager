"""Unit tests for the security building blocks (no database needed)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.core import codes, passwords, tokens
from app.core.errors import DomainError, ErrorCode

SECRET = "unit-test-secret-key-that-is-long-enough-0123456789"
# Made with v2's passlib pbkdf2_sha256 from the throw-away password below.
V2_HASH = "$pbkdf2-sha256$29000$Q.jde691rrWWEuL8P2fsnQ$GHkmQBICnzoFz04TzGj4IwxvPTIinkzP/Rv7ZHVmWrQ"
V2_PASSWORD = "legacy-test-pass-1"


def test_new_hashes_are_argon2_and_verify() -> None:
    hashed = passwords.hash_password("correct horse battery")
    assert hashed.startswith("$argon2id$")
    assert passwords.verify_password("correct horse battery", hashed) == (True, None)
    assert passwords.verify_password("wrong", hashed)[0] is False


def test_v2_pbkdf2_hash_verifies_once_and_is_upgraded() -> None:
    ok, upgraded = passwords.verify_password(V2_PASSWORD, V2_HASH)
    assert ok is True
    assert upgraded is not None and upgraded.startswith("$argon2id$")
    assert passwords.verify_password(V2_PASSWORD, upgraded) == (True, None)
    assert passwords.verify_password("not-it", V2_HASH) == (False, None)


def test_corrupt_hash_never_matches() -> None:
    assert passwords.verify_password("x", "$pbkdf2-sha256$broken") == (False, None)
    assert passwords.verify_password("x", "plain-text") == (False, None)


def test_tokens_round_trip_and_reject_the_wrong_kind() -> None:
    token, claims = tokens.encode_token(
        SECRET, subject_id="abc", subject_type="organizer", session_id="s1", kind="access",
        lifetime=timedelta(minutes=5),
    )  # fmt: skip
    decoded = tokens.decode_token(SECRET, token, "access")
    assert decoded is not None and decoded.subject_id == "abc" and decoded.jti == claims.jti
    assert tokens.decode_token(SECRET, token, "refresh") is None
    assert tokens.decode_token("another-secret-that-is-long-enough-0123456789", token, "access") is None


def test_expired_token_is_rejected() -> None:
    token, _ = tokens.encode_token(
        SECRET, subject_id="abc", subject_type="admin", session_id="s1", kind="access",
        lifetime=timedelta(seconds=-1),
    )  # fmt: skip
    assert tokens.decode_token(SECRET, token, "access") is None


def test_code_accepts_the_right_one_and_counts_wrong_tries() -> None:
    stored, code = codes.issue(SECRET, "verify", "owner1", minutes=15)
    assert len(code) == 6 and code.isdigit() and code not in stored.code_hmac

    wrong = "000000" if code != "000000" else "111111"
    result = codes.check(SECRET, "verify", "owner1", stored, wrong)
    assert result.ok is False and result.stored is not None and result.stored.attempts == 1

    assert codes.check(SECRET, "verify", "owner1", stored, f" {code[:3]} {code[3:]} ").ok is True
    # The same code does not work for another owner or purpose.
    assert codes.check(SECRET, "verify", "owner2", stored, code).ok is False
    assert codes.check(SECRET, "confirm", "owner1", stored, code).ok is False


def test_code_locks_after_five_wrong_tries() -> None:
    stored, code = codes.issue(SECRET, "verify", "o", minutes=15)
    locked = stored.model_copy(update={"attempts": codes.MAX_ATTEMPTS})
    with pytest.raises(DomainError) as err:
        codes.check(SECRET, "verify", "o", locked, code)
    assert err.value.code == ErrorCode.CODE_LOCKED


def test_expired_code_is_refused() -> None:
    stored, code = codes.issue(SECRET, "verify", "o", minutes=15)
    old = stored.model_copy(update={"expires_at": datetime.now(UTC) - timedelta(seconds=1)})
    with pytest.raises(DomainError) as err:
        codes.check(SECRET, "verify", "o", old, code)
    assert err.value.code == ErrorCode.CODE_EXPIRED


def test_resend_waits_a_minute() -> None:
    stored, _ = codes.issue(SECRET, "verify", "o", minutes=15)
    assert 55 <= codes.resend_wait(stored) <= 60
    earlier = stored.model_copy(update={"sent_at": datetime.now(UTC) - timedelta(seconds=61)})
    assert codes.resend_wait(earlier) == 0
    assert codes.resend_wait(None) == 0


def test_rate_limit_scale_is_refused_in_production() -> None:
    from pydantic import ValidationError

    from app.core.settings import Settings

    base = {"secret_key": "a-long-enough-secret-key-for-tests-123", "cookie_secure": True, "environment": "production"}
    assert Settings(**base).rate_limit_scale == 1  # type: ignore[arg-type]
    with pytest.raises(ValidationError, match="RATE_LIMIT_SCALE"):
        Settings(**base, rate_limit_scale=10)  # type: ignore[arg-type]
