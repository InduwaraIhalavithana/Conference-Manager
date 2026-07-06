from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_organizer, get_current_admin
from app.models.organizer import Organizer
from app.models.admin import Admin
from app.schemas.auth import (
    RegisterRequest, LoginRequest, AdminLoginRequest,
    TokenResponse, OrganizerOut,
)

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
def login(body: LoginRequest, db: Session = Depends(get_db)):
    org = db.execute(select(Organizer).where(Organizer.email == body.email)).scalar_one_or_none()
    if not org or not verify_password(body.password, org.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if org.is_suspended:
        raise HTTPException(status_code=403, detail="Account suspended")
    token = create_access_token({"sub": org.id, "type": "organizer"})
    return TokenResponse(access_token=token)


@router.post("/admin/login", response_model=TokenResponse)
def admin_login(body: AdminLoginRequest, db: Session = Depends(get_db)):
    admin = db.execute(select(Admin).where(Admin.username == body.username)).scalar_one_or_none()
    if not admin or not verify_password(body.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": admin.id, "type": "admin"})
    return TokenResponse(access_token=token)


@router.get("/me", response_model=OrganizerOut)
def me(org: Organizer = Depends(get_current_organizer)):
    return org


@router.get("/admin/me")
def admin_me(admin: Admin = Depends(get_current_admin)):
    return {"id": admin.id, "username": admin.username}
