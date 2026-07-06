from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.db.database import get_db
from app.core.deps import get_current_organizer
from app.core.security import hash_password, verify_password
from app.models.organizer import Organizer
from app.schemas.auth import OrganizerOut

router = APIRouter(prefix="/api/organizers", tags=["organizers"])


class ProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    phone: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


@router.put("/me", response_model=OrganizerOut)
def update_profile(body: ProfileUpdate, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    org.first_name = body.first_name
    org.last_name = body.last_name
    org.phone = body.phone
    db.commit()
    db.refresh(org)
    return org


@router.put("/me/password", status_code=204)
def change_password(body: PasswordChange, org: Organizer = Depends(get_current_organizer), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, org.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    org.password_hash = hash_password(body.new_password)
    db.commit()
