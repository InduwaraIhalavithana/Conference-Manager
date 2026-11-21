"""Sign-up, sign-in, sessions and passwords: the business rules, independent of GraphQL and HTTP.

Rules carried over from v2: organizers verify their email with a 6-digit code before they can sign in;
answers to "resend code" and "forgot password" never reveal whether an email is registered.
New in v3: sessions live in MongoDB with rotating refresh tokens (reuse revokes the session),
passwords are Argon2 (v2 hashes are upgraded at the next sign-in), and changing or resetting a password
signs out every other device.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from beanie import PydanticObjectId
from pydantic import BaseModel, EmailStr, Field, ValidationError, field_validator

from app.core import codes
from app.core.errors import DomainError, ErrorCode
from app.core.passwords import DUMMY_HASH, hash_password, verify_password
from app.core.settings import get_settings
from app.core.tokens import SubjectType, decode_token, encode_token, hash_link_token, new_link_token
from app.models import ActorRef, Admin, AuthSession, Organizer, PasswordReset
from app.models.common import Lang, utcnow
from app.repositories import accounts, messages, sessions
from app.services import email, ratelimit

VERIFY_PURPOSE = "verify"


# ── Inputs (validated here, so every API style gets the same rules) ─────────────────────────────────


def _strip(value: object) -> object:
    return value.strip() if isinstance(value, str) else value


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


class RegisterInput(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    phone: str | None = Field(default=None, max_length=30)
    organization: str | None = Field(default=None, max_length=160)
    lang: Lang = "en"

    _names = field_validator("first_name", "last_name", mode="before")(_strip)
    _optional = field_validator("phone", "organization", mode="before")(_blank_to_none)


class NewPassword(BaseModel):
    password: str = Field(min_length=8, max_length=128)


def validate[M: BaseModel](model: type[M], **data: object) -> M:
    try:
        return model.model_validate(data)
    except ValidationError as err:
        first = err.errors()[0]
        field = ".".join(str(p) for p in first["loc"]) or None
        raise DomainError(ErrorCode.VALIDATION, first["msg"], field=field) from err


# ── Results ──────────────────────────────────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class SignedIn:
    subject_type: SubjectType
    subject: Organizer | Admin
    session_id: str
    access_token: str
    access_expires_at: datetime
    refresh_token: str
    refresh_expires_at: datetime


@dataclass(frozen=True)
class Viewer:
    subject_type: SubjectType
    subject: Organizer | Admin
    session_id: str

    @property
    def organizer(self) -> Organizer | None:
        return self.subject if isinstance(self.subject, Organizer) else None

    @property
    def admin(self) -> Admin | None:
        return self.subject if isinstance(self.subject, Admin) else None


@dataclass(frozen=True)
class CodeSent:
    email: str
    resend_after_seconds: int


# ── Sessions ─────────────────────────────────────────────────────────────────────────────────────────


def _secret() -> str:
    return get_settings().secret_key.get_secret_value()


async def _start_session(subject_type: SubjectType, subject: Organizer | Admin, user_agent: str | None) -> SignedIn:
    settings = get_settings()
    assert subject.id is not None
    refresh_life = timedelta(days=settings.refresh_token_days)
    session = AuthSession(
        subject_type=subject_type,
        subject_id=subject.id,
        current_jti="pending",
        expires_at=utcnow() + refresh_life,
        user_agent=(user_agent or "")[:300] or None,
    )
    await sessions.create_session(session)
    return await _issue_tokens(session, subject, rotate_from=None)


async def _issue_tokens(session: AuthSession, subject: Organizer | Admin, rotate_from: str | None) -> SignedIn:
    settings = get_settings()
    assert session.id is not None and subject.id is not None
    sid = str(session.id)
    refresh_life = timedelta(days=settings.refresh_token_days)
    refresh, refresh_claims = encode_token(
        _secret(), subject_id=str(subject.id), subject_type=session.subject_type, session_id=sid,
        kind="refresh", lifetime=refresh_life,
    )  # fmt: skip
    old = rotate_from if rotate_from is not None else session.current_jti
    if not await sessions.rotate(
        session, old_jti=old, new_jti=refresh_claims.jti, expires_at=refresh_claims.expires_at
    ):
        raise DomainError(ErrorCode.SESSION_EXPIRED, "Your session has ended: sign in again")
    access, access_claims = encode_token(
        _secret(), subject_id=str(subject.id), subject_type=session.subject_type, session_id=sid,
        kind="access", lifetime=timedelta(minutes=settings.access_token_minutes),
    )  # fmt: skip
    return SignedIn(
        subject_type=session.subject_type,
        subject=subject,
        session_id=sid,
        access_token=access,
        access_expires_at=access_claims.expires_at,
        refresh_token=refresh,
        refresh_expires_at=refresh_claims.expires_at,
    )


async def _load_subject(subject_type: str, subject_id: PydanticObjectId | str) -> Organizer | Admin | None:
    if subject_type == "organizer":
        return await accounts.organizer_by_id(subject_id)
    if subject_type == "admin":
        return await accounts.admin_by_id(subject_id)
    return None


async def resolve_viewer(access_token: str | None) -> Viewer | None:
    """Who is signed in, from the access cookie. Revoked sessions and suspended organizers count as signed out."""
    if not access_token:
        return None
    claims = decode_token(_secret(), access_token, "access")
    if claims is None:
        return None
    session = await sessions.session_by_id(claims.session_id)
    if session is None or session.revoked_at is not None or str(session.subject_id) != claims.subject_id:
        return None
    subject = await _load_subject(claims.subject_type, claims.subject_id)
    if subject is None or (isinstance(subject, Organizer) and subject.is_suspended):
        return None
    return Viewer(subject_type=claims.subject_type, subject=subject, session_id=claims.session_id)


async def refresh(refresh_token: str | None, ip: str) -> SignedIn:
    await ratelimit.enforce(ratelimit.REFRESH, ip)
    expired = DomainError(ErrorCode.SESSION_EXPIRED, "Your session has ended: sign in again")
    claims = decode_token(_secret(), refresh_token or "", "refresh")
    if claims is None:
        raise expired
    session = await sessions.session_by_id(claims.session_id)
    if session is None or session.revoked_at is not None or session.expires_at < datetime.now(UTC):
        raise expired
    if claims.jti != session.current_jti:
        # An old refresh token came back: someone may have copied it. End the session everywhere.
        await sessions.revoke(session, "refresh_token_reused")
        await messages.log_activity(
            ActorRef(type=session.subject_type, id=session.subject_id), "refresh_reuse_detected", str(session.id)
        )
        raise DomainError(ErrorCode.SESSION_REUSED, "This sign-in was used somewhere else: sign in again")
    subject = await _load_subject(session.subject_type, session.subject_id)
    if subject is None or (isinstance(subject, Organizer) and subject.is_suspended):
        await sessions.revoke(session, "subject_unavailable")
        raise expired
    return await _issue_tokens(session, subject, rotate_from=claims.jti)


async def logout(viewer_session_id: str | None, refresh_token: str | None) -> None:
    session_id = viewer_session_id
    if session_id is None and refresh_token:
        claims = decode_token(_secret(), refresh_token, "refresh")
        session_id = claims.session_id if claims else None
    if session_id:
        session = await sessions.session_by_id(session_id)
        if session is not None:
            await sessions.revoke(session, "logout")


# ── Organizer sign-up and email codes ────────────────────────────────────────────────────────────────


async def _send_verify_code(organizer: Organizer) -> None:
    settings = get_settings()
    assert organizer.id is not None
    stored, code = codes.issue(_secret(), VERIFY_PURPOSE, str(organizer.id), settings.verify_code_minutes)
    organizer.verify = stored
    await accounts.save_organizer(organizer)
    await email.send(
        email.EmailMessage(
            to=organizer.email,
            kind="verify_code",
            lang=organizer.lang,
            params={"code": code, "minutes": settings.verify_code_minutes, "name": organizer.first_name},
        )
    )


async def register(ip: str, **data: object) -> CodeSent:
    await ratelimit.enforce(ratelimit.REGISTER, ip)
    body = validate(RegisterInput, **data)
    organizer = Organizer(
        first_name=body.first_name,
        last_name=body.last_name,
        email=str(body.email),
        password_hash=hash_password(body.password),
        phone=body.phone,
        organization=body.organization,
        lang=body.lang,
    )
    try:
        await accounts.insert_organizer(organizer)
    except accounts.EmailTakenError as err:
        raise DomainError(ErrorCode.EMAIL_TAKEN, "That email is already registered", field="email") from err
    admins = [ActorRef(type="admin", id=i) for i in await accounts.all_admin_ids()]
    await messages.notify(admins, "new_organizer", {"name": organizer.full_name}, "/admin/organizers")
    await _send_verify_code(organizer)
    return CodeSent(email=organizer.email, resend_after_seconds=codes.RESEND_SECONDS)


async def verify_email(ip: str, user_agent: str | None, email_addr: str, code: str) -> SignedIn:
    """The code from the sign-up email marks the address verified and signs the organizer in."""
    await ratelimit.enforce(ratelimit.VERIFY, ip)
    organizer = await accounts.organizer_by_email(email_addr)
    if organizer is None or organizer.email_verified_at is not None:
        # Unknown and already-verified addresses look the same as a wrong code.
        raise DomainError(ErrorCode.CODE_INVALID, "That code is not right", remaining=codes.MAX_ATTEMPTS)
    if organizer.is_suspended:
        raise DomainError(ErrorCode.ACCOUNT_SUSPENDED, "This account is suspended")
    result = codes.check(_secret(), VERIFY_PURPOSE, str(organizer.id), organizer.verify, code)
    if not result.ok:
        assert result.stored is not None
        organizer.verify = result.stored
        await accounts.save_organizer(organizer)
        raise codes.wrong_code_error(result.stored)
    organizer.verify = None
    organizer.email_verified_at = utcnow()
    await accounts.save_organizer(organizer)
    await messages.log_activity(ActorRef(type="organizer", id=organizer.id), "verify_email", organizer.email)
    return await _start_session("organizer", organizer, user_agent)


async def resend_code(ip: str, email_addr: str) -> CodeSent:
    """Same answer whether or not the email exists, is verified, or asked less than a minute ago."""
    await ratelimit.enforce(ratelimit.RESEND, ip)
    organizer = await accounts.organizer_by_email(email_addr)
    if (
        organizer is not None
        and organizer.email_verified_at is None
        and not organizer.is_suspended
        and codes.resend_wait(organizer.verify) == 0
    ):
        await _send_verify_code(organizer)
    return CodeSent(email=accounts.normalise_email(email_addr), resend_after_seconds=codes.RESEND_SECONDS)


# ── Sign-in ──────────────────────────────────────────────────────────────────────────────────────────


def _bad_credentials() -> DomainError:
    return DomainError(ErrorCode.INVALID_CREDENTIALS, "Wrong email or password")


async def login(ip: str, user_agent: str | None, email_addr: str, password: str) -> SignedIn:
    await ratelimit.enforce(ratelimit.LOGIN, ip)
    organizer = await accounts.organizer_by_email(email_addr)
    ok, new_hash = verify_password(password, organizer.password_hash if organizer else DUMMY_HASH)
    if organizer is None or not ok:
        raise _bad_credentials()
    if organizer.is_suspended:
        raise DomainError(ErrorCode.ACCOUNT_SUSPENDED, "This account is suspended")
    if organizer.email_verified_at is None:
        raise DomainError(ErrorCode.EMAIL_NOT_VERIFIED, "Verify your email before signing in", email=organizer.email)
    if new_hash:
        organizer.password_hash = new_hash
        await accounts.save_organizer(organizer)
    await messages.log_activity(ActorRef(type="organizer", id=organizer.id), "login", organizer.email)
    return await _start_session("organizer", organizer, user_agent)


async def admin_login(ip: str, user_agent: str | None, identifier: str, password: str) -> SignedIn:
    await ratelimit.enforce(ratelimit.ADMIN_LOGIN, ip)
    admin = await accounts.admin_by_login(identifier)
    ok, new_hash = verify_password(password, admin.password_hash if admin else DUMMY_HASH)
    if admin is None or not ok:
        raise _bad_credentials()
    if new_hash:
        admin.password_hash = new_hash
        await accounts.save_admin(admin)
    await messages.log_activity(ActorRef(type="admin", id=admin.id), "admin_login", admin.email)
    return await _start_session("admin", admin, user_agent)


# ── Passwords ────────────────────────────────────────────────────────────────────────────────────────


async def forgot_password(ip: str, email_addr: str) -> None:
    """Same answer whether or not the email exists; the token is only ever emailed, never returned."""
    await ratelimit.enforce(ratelimit.FORGOT, ip)
    organizer = await accounts.organizer_by_email(email_addr)
    if organizer is None or organizer.is_suspended or organizer.id is None:
        return
    settings = get_settings()
    raw, token_hash = new_link_token()
    await sessions.insert_reset(
        PasswordReset(
            organizer_id=organizer.id,
            token_hash=token_hash,
            expires_at=utcnow() + timedelta(hours=settings.password_reset_hours),
        )
    )
    await email.send(
        email.EmailMessage(
            to=organizer.email,
            kind="password_reset",
            lang=organizer.lang,
            params={"link": f"{settings.frontend_url}/reset?token={raw}", "hours": settings.password_reset_hours},
        )
    )


async def reset_password(ip: str, token: str, new_password: str) -> None:
    await ratelimit.enforce(ratelimit.RESET, ip)
    body = validate(NewPassword, password=new_password)
    record = await sessions.reset_by_hash(hash_link_token(token))
    if record is None:
        raise DomainError(ErrorCode.RESET_INVALID, "This reset link is not valid")
    if record.expires_at < datetime.now(UTC):
        await sessions.delete_resets_for(record.organizer_id)
        raise DomainError(ErrorCode.RESET_EXPIRED, "This reset link has expired: ask for a new one")
    organizer = await accounts.organizer_by_id(record.organizer_id)
    if organizer is None:
        raise DomainError(ErrorCode.RESET_INVALID, "This reset link is not valid")
    organizer.password_hash = hash_password(body.password)
    if organizer.email_verified_at is None:
        # The link reached their inbox, which proves the address too.
        organizer.email_verified_at = utcnow()
        organizer.verify = None
    await accounts.save_organizer(organizer)
    await sessions.delete_resets_for(record.organizer_id)
    await sessions.revoke_all("organizer", record.organizer_id, "password_reset")
    await messages.log_activity(ActorRef(type="organizer", id=organizer.id), "reset_password", organizer.email)


async def change_password(viewer: Viewer, current_password: str, new_password: str) -> None:
    """Changing the password keeps this device signed in and signs out every other one."""
    body = validate(NewPassword, password=new_password)
    subject = viewer.subject
    ok, _ = verify_password(current_password, subject.password_hash)
    if not ok:
        raise DomainError(ErrorCode.INVALID_CREDENTIALS, "Your current password is not right", field="currentPassword")
    if current_password == body.password:
        raise DomainError(
            ErrorCode.PASSWORD_UNCHANGED, "Choose a password you have not used just now", field="newPassword"
        )
    subject.password_hash = hash_password(body.password)
    if isinstance(subject, Organizer):
        await accounts.save_organizer(subject)
    else:
        await accounts.save_admin(subject)
    assert subject.id is not None
    await sessions.revoke_all(viewer.subject_type, subject.id, "password_changed", keep=viewer.session_id)
    actor_type: Literal["organizer", "admin"] = viewer.subject_type
    await messages.log_activity(ActorRef(type=actor_type, id=subject.id), "change_password", subject.email)
