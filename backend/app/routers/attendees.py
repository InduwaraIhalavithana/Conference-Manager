from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.db.database import get_db
from app.core.deps import get_current_organizer
from app.models.attendee import Attendee
from app.models.conference import Conference
from app.schemas.attendee import AttendeeRegister, AttendeeOut

router = APIRouter(prefix="/api/attendees", tags=["attendees"])


@router.post("/{conf_id}", status_code=201)
def register_attendee(conf_id: int, body: AttendeeRegister, db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    dup = db.execute(
        select(Attendee).where(and_(Attendee.conference_id == conf_id, Attendee.email == body.email))
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="Already registered with this email")
    attendee = Attendee(conference_id=conf_id, name=body.name, email=body.email)
    db.add(attendee)
    db.commit()
    db.refresh(attendee)
    return attendee


@router.get("/{conf_id}", response_model=list[AttendeeOut])
def list_attendees(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf or conf.organizer_id != org.id:
        raise HTTPException(status_code=404, detail="Conference not found")
    return db.execute(
        select(Attendee).where(Attendee.conference_id == conf_id).order_by(Attendee.registered_at)
    ).scalars().all()
