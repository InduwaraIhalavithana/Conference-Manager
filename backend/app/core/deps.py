from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.core.security import decode_token
from app.models.organizer import Organizer
from app.models.admin import Admin

bearer = HTTPBearer(auto_error=False)


def get_current_organizer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Organizer:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not credentials:
        raise exc
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "organizer":
        raise exc
    organizer = db.execute(select(Organizer).where(Organizer.id == int(payload["sub"]))).scalar_one_or_none()
    if not organizer or organizer.is_suspended:
        raise exc
    return organizer


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Admin:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    if not credentials:
        raise exc
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "admin":
        raise exc
    admin = db.execute(select(Admin).where(Admin.id == int(payload["sub"]))).scalar_one_or_none()
    if not admin:
        raise exc
    return admin
