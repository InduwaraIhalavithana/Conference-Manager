"""Password hashing: Argon2 (pwdlib) for every new hash, plus a verifier for v2's PBKDF2 hashes.

v2 stored passlib ``pbkdf2_sha256`` hashes. They are accepted at sign-in once and replaced by an Argon2
hash straight away (``verify_and_update``), so they disappear as people sign in.
"""

import base64
import hashlib
import hmac

from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

PBKDF2_PREFIX = "$pbkdf2-sha256$"


def _ab64_decode(data: str) -> bytes:
    """passlib's 'adapted base64': standard alphabet with '.' instead of '+', no padding."""
    padded = data.replace(".", "+") + "=" * (-len(data) % 4)
    return base64.b64decode(padded)


class LegacyPbkdf2Hasher:
    """Verifies v2 hashes (``$pbkdf2-sha256$rounds$salt$checksum``). Never used to create new hashes."""

    @classmethod
    def identify(cls, hash: str | bytes) -> bool:
        text = hash.decode() if isinstance(hash, bytes) else hash
        return text.startswith(PBKDF2_PREFIX)

    def hash(self, password: str | bytes, *, salt: bytes | None = None) -> str:
        raise NotImplementedError("PBKDF2 is only verified, never used for new hashes")

    def verify(self, password: str | bytes, hash: str | bytes) -> bool:
        text = hash.decode() if isinstance(hash, bytes) else hash
        try:
            rounds_text, salt_text, checksum_text = text[len(PBKDF2_PREFIX) :].split("$")
            rounds = int(rounds_text)
            salt = _ab64_decode(salt_text)
            expected = _ab64_decode(checksum_text)
        except ValueError:
            return False
        secret = password.encode() if isinstance(password, str) else password
        actual = hashlib.pbkdf2_hmac("sha256", secret, salt, rounds, len(expected))
        return hmac.compare_digest(actual, expected)

    def check_needs_rehash(self, hash: str | bytes) -> bool:
        return True


_hasher = PasswordHash((Argon2Hasher(), LegacyPbkdf2Hasher()))


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, stored: str) -> tuple[bool, str | None]:
    """Returns (matches, new hash to store or None). A new hash comes back for legacy or outdated hashes."""
    try:
        return _hasher.verify_and_update(password, stored)
    except Exception:  # an unknown or corrupt hash never matches
        return False, None


# Used when the email is unknown, so a wrong email takes as long as a wrong password.
DUMMY_HASH = hash_password("timing-equaliser-not-a-real-password")
