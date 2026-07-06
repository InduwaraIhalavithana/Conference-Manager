import csv
import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func
from datetime import date
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
    if conf.date < date.today():
        raise HTTPException(status_code=400, detail="Registration closed — conference has already passed")
    if conf.max_attendees:
        current = db.execute(select(func.count()).where(Attendee.conference_id == conf_id)).scalar()
        if current >= conf.max_attendees:
            raise HTTPException(status_code=400, detail="Conference is full")
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


@router.get("/{conf_id}/export")
def export_attendees_csv(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf or conf.organizer_id != org.id:
        raise HTTPException(status_code=404, detail="Conference not found")
    attendees = db.execute(
        select(Attendee).where(Attendee.conference_id == conf_id).order_by(Attendee.registered_at)
    ).scalars().all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Registered At"])
    for a in attendees:
        writer.writerow([a.name, a.email, a.registered_at.isoformat()])
    output.seek(0)
    filename = f"attendees_{conf_id}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{conf_id}", response_model=list[AttendeeOut])
def list_attendees(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf or conf.organizer_id != org.id:
        raise HTTPException(status_code=404, detail="Conference not found")
    return db.execute(
        select(Attendee).where(Attendee.conference_id == conf_id).order_by(Attendee.registered_at)
    ).scalars().all()


@router.delete("/{conf_id}/{attendee_id}", status_code=204)
def cancel_attendee(conf_id: int, attendee_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.get(Conference, conf_id)
    if not conf or conf.organizer_id != org.id:
        raise HTTPException(status_code=404, detail="Conference not found")
    attendee = db.execute(
        select(Attendee).where(and_(Attendee.id == attendee_id, Attendee.conference_id == conf_id))
    ).scalar_one_or_none()
    if not attendee:
        raise HTTPException(status_code=404, detail="Attendee not found")
    db.delete(attendee)
    db.commit()
