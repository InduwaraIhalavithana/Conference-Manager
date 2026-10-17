import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core import email
from app.core.config import FRONTEND_URL
from app.core.deps import get_current_admin, get_current_organizer
from app.core.errors import AppError
from app.core.notify import notify_admins
from app.core.ratelimit import limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.database import get_db
from app.models.activity import ActivityLog
from app.models.admin import Admin
from app.models.organizer import Organizer
from app.models.password_reset import PasswordResetToken
from app.schemas.auth import AdminLoginRequest, AdminOut, LoginRequest, OrganizerOut, RegisterRequest, TokenResponse

log = logging.getLogger("conference.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_token(token: str) -> str:
    """Reset tokens are stored hashed, so a database leak cannot be used to reset passwords."""
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    email_addr = body.email.lower()
    if db.execute(select(Organizer.id).where(func.lower(Organizer.email) == email_addr)).first():
        raise AppError(409, "email_taken", "Email already registered")
    org = Organizer(
        first_name=body.first_name,
        last_name=body.last_name,
        email=email_addr,
        password_hash=hash_password(body.password),
        phone=body.phone,
        organization=body.organization,
        lang=body.lang,
    )
    db.add(org)
    db.flush()
    notify_admins(db, "new_organizer", {"name": f"{org.first_name} {org.last_name}"}, "/admin/organizers")
    db.commit()
    return TokenResponse(access_token=create_access_token({"sub": org.id, "type": "organizer"}))


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    org = db.execute(select(Organizer).where(func.lower(Organizer.email) == body.email.lower())).scalar_one_or_none()
    if not org or not verify_password(body.password, org.password_hash):
        raise AppError(401, "invalid_credentials", "Invalid email or password")
    if org.is_suspended:
        raise AppError(403, "account_suspended", "Account suspended")
    db.add(ActivityLog(organizer_id=org.id, action="login", target=org.email))
    db.commit()
    return TokenResponse(access_token=create_access_token({"sub": org.id, "type": "organizer"}))


@router.post("/admin/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def admin_login(request: Request, body: AdminLoginRequest, db: Session = Depends(get_db)):
    ident = body.email.strip().lower()
    admin = db.execute(
        select(Admin).where(or_(func.lower(Admin.email) == ident, Admin.username == body.email.strip()))
    ).scalar_one_or_none()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise AppError(401, "invalid_credentials", "Invalid email or password")
    return TokenResponse(access_token=create_access_token({"sub": admin.id, "type": "admin"}))


@router.post("/refresh", response_model=TokenResponse)
def refresh(org: Organizer = Depends(get_current_organizer)):
    return TokenResponse(access_token=create_access_token({"sub": org.id, "type": "organizer"}))


@router.get("/me", response_model=OrganizerOut)
def me(org: Organizer = Depends(get_current_organizer)):
    return org


@router.get("/admin/me", response_model=AdminOut)
def admin_me(admin: Admin = Depends(get_current_admin)):
    return admin


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=128)


@router.post("/forgot-password", status_code=200)
@limiter.limit("5/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, background: BackgroundTasks,
                    db: Session = Depends(get_db)):
    # Same answer whether or not the email exists, and the token is never returned in the response.
    answer = {"message": "If that email is registered, a reset link has been sent.", "code": "reset_sent"}
    org = db.execute(select(Organizer).where(func.lower(Organizer.email) == body.email.lower())).scalar_one_or_none()
    if not org or org.is_suspended:
        return answer
    raw = secrets.token_urlsafe(48)
    db.add(PasswordResetToken(organizer_id=org.id, token=_hash_token(raw),
                              expires_at=datetime.now(UTC) + timedelta(hours=2)))
    db.commit()
    reset_url = f"{FRONTEND_URL}/reset-password?token={raw}"
    if not email.email_enabled():
        # Local development without Gmail: the link only appears in the server log.
        log.warning("Password reset link for %s (email disabled): %s", org.email, reset_url)
    email.queue(background, email.password_reset_message(org, reset_url))
    return answer


@router.post("/reset-password", status_code=200)
@limiter.limit("10/minute")
def reset_password(request: Request, body: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == _hash_token(body.token))
    ).scalar_one_or_none()
    if not record:
        raise AppError(400, "reset_invalid", "Invalid or expired reset token")
    expires = record.expires_at if record.expires_at.tzinfo else record.expires_at.replace(tzinfo=UTC)
    if expires < datetime.now(UTC):
        db.delete(record)
        db.commit()
        raise AppError(400, "reset_expired", "Reset token has expired")
    org = db.get(Organizer, record.organizer_id)
    if not org:
        raise AppError(400, "reset_invalid", "Invalid reset token")
    org.password_hash = hash_password(body.new_password)
    # One use only: drop every outstanding token for this organizer.
    for other in db.execute(select(PasswordResetToken).where(PasswordResetToken.organizer_id == org.id)).scalars():
        db.delete(other)
    db.add(ActivityLog(organizer_id=org.id, action="reset_password", target=org.email))
    db.commit()
    return {"message": "Password reset successfully", "code": "reset_done"}
