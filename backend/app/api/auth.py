import os
import secrets
import asyncio
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.core.deps import get_current_organizer, get_current_admin
from app.core.email import send_email
from app.models.organizer import Organizer
from app.models.admin import Admin
from app.models.password_reset import PasswordResetToken
from app.schemas.auth import (
    RegisterRequest, LoginRequest, AdminLoginRequest,
    TokenResponse, OrganizerOut,
)
from pydantic import BaseModel, EmailStr, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.models.activity import ActivityLog

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.execute(select(Organizer).where(Organizer.email == body.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    org = Organizer(
        first_name=body.first_name,
        last_name=body.last_name,
        email=body.email,
        password_hash=hash_password(body.password),
        phone=body.phone,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    token = create_access_token({"sub": org.id, "type": "organizer"})
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    org = db.execute(select(Organizer).where(Organizer.email == body.email)).scalar_one_or_none()
    if not org or not verify_password(body.password, org.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if org.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended")
    db.add(ActivityLog(organizer_id=org.id, action="login", target=org.email))
    db.commit()
    token = create_access_token({"sub": org.id, "type": "organizer"})
    return TokenResponse(access_token=token)


@router.post("/admin/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def admin_login(request: Request, body: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.execute(select(Admin).where(Admin.username == body.username)).scalar_one_or_none()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": admin.id, "type": "admin"})
    return TokenResponse(access_token=token)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: Request, org: Organizer = Depends(get_current_organizer)):
    token = create_access_token({"sub": org.id, "type": "organizer"})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=OrganizerOut)
def me(org: Organizer = Depends(get_current_organizer)):
    return org


@router.get("/admin/me")
def admin_me(admin: Admin = Depends(get_current_admin)):
    return {"id": admin.id, "username": admin.username}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


@router.post("/forgot-password", status_code=200)
def forgot_password(body: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    org = db.execute(select(Organizer).where(Organizer.email == body.email)).scalar_one_or_none()
    if not org:
        return {"message": "If that email is registered, a reset link has been sent."}
    reset_token = secrets.token_urlsafe(48)
    expires = datetime.now(timezone.utc) + timedelta(hours=2)
    db.add(PasswordResetToken(organizer_id=org.id, token=reset_token, expires_at=expires))
    db.commit()
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    background_tasks.add_task(
        asyncio.run,
        send_email(org.email, "Reset Your ConferenceHub Password", "password_reset.html", {"reset_url": reset_url}),
    )
    return {"message": "If that email is registered, a reset link has been sent.", "reset_token": reset_token}


@router.post("/reset-password", status_code=200)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    record = db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token == body.token)
    ).scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if record.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        db.delete(record)
        db.commit()
        raise HTTPException(status_code=400, detail="Reset token has expired")
    org = db.get(Organizer, record.organizer_id)
    if not org:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    org.password_hash = hash_password(body.new_password)
    db.delete(record)
    db.commit()
    return {"message": "Password reset successfully"}
