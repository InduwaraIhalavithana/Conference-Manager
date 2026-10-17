from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.security import decode_token
from app.db.database import get_db
from app.models.admin import Admin
from app.models.organizer import Organizer

bearer = HTTPBearer(auto_error=False)


def _not_authenticated() -> AppError:
    return AppError(401, "not_authenticated", "Not authenticated")


def get_current_organizer(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Organizer:
    if not credentials:
        raise _not_authenticated()
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "organizer":
        raise _not_authenticated()
    organizer = db.execute(select(Organizer).where(Organizer.id == int(payload["sub"]))).scalar_one_or_none()
    if not organizer:
        raise _not_authenticated()
    if organizer.is_suspended:
        raise AppError(403, "account_suspended", "Account suspended")
    return organizer


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> Admin:
    if not credentials:
        raise _not_authenticated()
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "admin":
        raise _not_authenticated()
    admin = db.execute(select(Admin).where(Admin.id == int(payload["sub"]))).scalar_one_or_none()
    if not admin:
        raise _not_authenticated()
    return admin
