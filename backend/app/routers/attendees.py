from __future__ import annotations

import csv
import io
import logging
from datetime import UTC, date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core import codes, email
from app.core.config import CONFIRM_HOLD_HOURS, VERIFY_CODE_MINUTES
from app.core.deps import get_current_organizer
from app.core.errors import AppError
from app.core.notify import notify_organizer
from app.core.ratelimit import limiter
from app.core.serialize import conference_dict, conference_select
from app.core.tickets import (
    confirmed_count,
    hold_expires_at,
    new_ticket_code,
    normalize_code,
    promote_waitlist,
    registered_count,
    waitlist_position,
)
from app.db.database import get_db
from app.models.activity import ActivityLog
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference
from app.models.organizer import Organizer
from app.routers.conferences import own_conference
from app.schemas.attendee import AttendeeOut, AttendeeRegister, CheckInRequest, ConfirmByEmailRequest, ConfirmRequest

log = logging.getLogger("conference.attendees")
router = APIRouter(prefix="/api/attendees", tags=["attendees"])
tickets = APIRouter(prefix="/api/tickets", tags=["tickets"])


def _out(db: Session, a: Attendee) -> dict:
    data = AttendeeOut.model_validate(a).model_dump()
    data["waitlist_position"] = waitlist_position(db, a)
    data["hold_expires_at"] = hold_expires_at(a)
    return data


def _send_code(db: Session, background: BackgroundTasks, attendee: Attendee, conf: Conference) -> None:
    """Email a fresh 6-digit code (the previous one stops working). Commits."""
    code = codes.issue(attendee, "confirm")
    db.commit()
    if not email.email_enabled():
        log.warning("Confirmation code for %s (email disabled): %s", attendee.email, code)
    email.queue(background, email.confirm_registration_message(attendee, conf, code, VERIFY_CODE_MINUTES,
                                                                CONFIRM_HOLD_HOURS))


CONFIRM_RESENT = {"message": "We sent a new code to your email.", "code": "confirm_resent"}


@router.post("/{conf_id}", status_code=201)
@limiter.limit("20/minute")
def register_attendee(request: Request, conf_id: int, body: AttendeeRegister, background: BackgroundTasks,
                      db: Session = Depends(get_db)):
    # Lock the conference row so two people cannot both take the last seat.
    conf = db.execute(select(Conference).where(Conference.id == conf_id).with_for_update()).scalar_one_or_none()
    if not conf or conf.status != "published":
        raise AppError(404, "conference_not_found", "Conference not found")
    org = db.get(Organizer, conf.organizer_id)
    if org is None or org.is_suspended:
        raise AppError(404, "conference_not_found", "Conference not found")
    if conf.date < date.today():
        raise AppError(400, "registration_closed", "Registration closed: the conference has already passed")
    email_addr = body.email.lower()
    existing = db.execute(
        select(Attendee).where(and_(Attendee.conference_id == conf_id, func.lower(Attendee.email) == email_addr))
    ).scalar_one_or_none()
    if existing is not None:
        if existing.confirmed_at is not None:
            raise AppError(409, "already_registered", "Already registered with this email")
        # Registered before but never confirmed: send a fresh code (at most once a minute). The ticket
        # code is not returned, because whoever typed this email may not own it.
        if codes.resend_wait(existing, "confirm") == 0:
            _send_code(db, background, existing, conf)
        return CONFIRM_RESENT

    # An unconfirmed registration holds its seat, so it counts here.
    full = bool(conf.max_attendees) and registered_count(db, conf_id) >= conf.max_attendees
    attendee = Attendee(conference_id=conf_id, name=body.name, email=email_addr, lang=body.lang,
                        status=WAITLISTED if full else REGISTERED, ticket_code=new_ticket_code(db))
    db.add(attendee)
    db.flush()
    # The organizer hears about it once the attendee confirms (see _confirm).
    _send_code(db, background, attendee, conf)
    db.refresh(attendee)
    return _out(db, attendee)


@router.post("/{conf_id}/confirm")
@limiter.limit("10/minute")
def confirm_registration(request: Request, conf_id: int, body: ConfirmByEmailRequest, background: BackgroundTasks,
                         db: Session = Depends(get_db)):
    """The code from the confirmation email, entered on the registration form."""
    email_addr = body.email.lower()
    attendee = db.execute(
        select(Attendee).where(and_(Attendee.conference_id == conf_id, func.lower(Attendee.email) == email_addr))
    ).scalar_one_or_none()
    if attendee is None:
        raise AppError(400, "code_invalid", "That code is not right", {"remaining": codes.MAX_ATTEMPTS})
    return _confirm(db, attendee, body.code, background)


@router.get("/{conf_id}/export")
def export_attendees_csv(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    attendees = db.execute(
        select(Attendee).where(Attendee.conference_id == conf_id).order_by(Attendee.status, Attendee.registered_at)
    ).scalars().all()
    output = io.StringIO()
    output.write("﻿")  # BOM so Excel opens Sinhala/Tamil names correctly
    writer = csv.writer(output)
    writer.writerow(["Name", "Email", "Status", "Email confirmed", "Ticket code", "Registered at", "Checked in at"])
    for a in attendees:
        writer.writerow([a.name, a.email, a.status, "yes" if a.confirmed_at else "no", a.ticket_code or "",
                         a.registered_at.isoformat(), a.checked_in_at.isoformat() if a.checked_in_at else ""])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="attendees_{conf_id}.csv"'},
    )


@router.get("/{conf_id}", response_model=list[AttendeeOut])
def list_attendees(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    rows = db.execute(
        select(Attendee).where(Attendee.conference_id == conf_id).order_by(Attendee.registered_at, Attendee.id)
    ).scalars().all()
    out, position = [], 0
    for a in rows:
        data = AttendeeOut.model_validate(a).model_dump()
        data["hold_expires_at"] = hold_expires_at(a)
        if a.status == WAITLISTED:
            position += 1
            data["waitlist_position"] = position
        out.append(data)
    return out


def _cancel(db: Session, attendee: Attendee, conf: Conference, background: BackgroundTasks, by_attendee: bool):
    name = attendee.name
    db.delete(attendee)
    notify_organizer(db, conf.organizer_id, "attendee_cancelled", {"attendee": name, "conference": conf.title},
                     f"/attendees/{conf.id}")
    if not by_attendee:
        db.add(ActivityLog(organizer_id=conf.organizer_id, action="cancel_attendee", target=f"{name} ({conf.title})"))
    promote_waitlist(db, conf, background)
    db.commit()


@router.delete("/{conf_id}/{attendee_id}", status_code=204)
def cancel_attendee(conf_id: int, attendee_id: int, background: BackgroundTasks,
                    org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = own_conference(db, conf_id, org)
    attendee = db.execute(
        select(Attendee).where(and_(Attendee.id == attendee_id, Attendee.conference_id == conf_id))
    ).scalar_one_or_none()
    if not attendee:
        raise AppError(404, "attendee_not_found", "Attendee not found")
    _cancel(db, attendee, conf, background, by_attendee=False)


@router.post("/{conf_id}/check-in")
def check_in_by_code(conf_id: int, body: CheckInRequest, org=Depends(get_current_organizer),
                     db: Session = Depends(get_db)):
    """Check in a ticket scanned from its QR code or typed at the door."""
    own_conference(db, conf_id, org)
    code = normalize_code(body.code)
    attendee = db.execute(select(Attendee).where(Attendee.ticket_code == code)).scalar_one_or_none()
    if not attendee or attendee.conference_id != conf_id:
        raise AppError(404, "ticket_not_found", "No ticket with this code for this conference")
    if attendee.status != REGISTERED:
        raise AppError(409, "ticket_waitlisted", "This person is still on the waitlist", {"name": attendee.name})
    if attendee.confirmed_at is None:
        raise AppError(409, "ticket_unconfirmed", "Ticket email was never confirmed", {"name": attendee.name})
    if attendee.checked_in_at:
        raise AppError(409, "already_checked_in", "Already checked in",
                       {"name": attendee.name, "checked_in_at": attendee.checked_in_at.isoformat()})
    attendee.checked_in_at = datetime.now(UTC)
    db.commit()
    db.refresh(attendee)
    return _out(db, attendee)


@router.put("/{conf_id}/{attendee_id}/check-in")
def set_check_in(conf_id: int, attendee_id: int, checked_in: bool = True, org=Depends(get_current_organizer),
                 db: Session = Depends(get_db)):
    """Tick or untick someone by hand from the attendee list."""
    own_conference(db, conf_id, org)
    attendee = db.execute(
        select(Attendee).where(and_(Attendee.id == attendee_id, Attendee.conference_id == conf_id))
    ).scalar_one_or_none()
    if not attendee:
        raise AppError(404, "attendee_not_found", "Attendee not found")
    if checked_in and attendee.status != REGISTERED:
        raise AppError(409, "ticket_waitlisted", "This person is still on the waitlist", {"name": attendee.name})
    if checked_in and attendee.confirmed_at is None:
        raise AppError(409, "ticket_unconfirmed", "Ticket email was never confirmed", {"name": attendee.name})
    attendee.checked_in_at = (attendee.checked_in_at or datetime.now(UTC)) if checked_in else None
    db.commit()
    db.refresh(attendee)
    return _out(db, attendee)


# ── Public ticket page (the ticket code is the attendee's private link) ─────

def _ticket(db: Session, code: str) -> Attendee:
    attendee = db.execute(select(Attendee).where(Attendee.ticket_code == normalize_code(code))).scalar_one_or_none()
    if not attendee:
        raise AppError(404, "ticket_not_found", "Ticket not found")
    return attendee


def _ticket_payload(db: Session, attendee: Attendee) -> dict:
    row = db.execute(conference_select().where(Conference.id == attendee.conference_id)).first()
    return {"attendee": _out(db, attendee), "conference": conference_dict(row)}


@tickets.get("/{code}")
@limiter.limit("30/minute")
def get_ticket(request: Request, code: str, db: Session = Depends(get_db)):
    return _ticket_payload(db, _ticket(db, code))


@tickets.post("/{ticket}/confirm")
@limiter.limit("10/minute")
def confirm_ticket(request: Request, ticket: str, body: ConfirmRequest, background: BackgroundTasks,
                   db: Session = Depends(get_db)):
    """The code from the confirmation email, entered on the ticket page."""
    return _confirm(db, _ticket(db, ticket), body.code, background)


def _confirm(db: Session, attendee: Attendee, code: str, background: BackgroundTasks) -> dict:
    """Check the code, activate the ticket and tell the organizer. Returns the ticket."""
    if attendee.confirmed_at is not None:
        return _ticket_payload(db, attendee)  # already done, e.g. on another tab
    codes.check(db, attendee, "confirm", code)
    conf = db.execute(select(Conference).where(Conference.id == attendee.conference_id).with_for_update()).scalar_one()
    attendee.confirmed_at = datetime.now(UTC)
    db.flush()

    params = {"attendee": attendee.name, "conference": conf.title}
    if attendee.status == WAITLISTED:
        notify_organizer(db, conf.organizer_id, "new_waitlist", params, f"/attendees/{conf.id}")
    else:
        count = confirmed_count(db, conf.id)
        notify_organizer(db, conf.organizer_id, "new_registration", params, f"/attendees/{conf.id}")
        if conf.max_attendees and count == conf.max_attendees:
            notify_organizer(db, conf.organizer_id, "conference_full", {"conference": conf.title},
                             f"/attendees/{conf.id}")
        org = db.get(Organizer, conf.organizer_id)
        if org is not None:
            email.queue(background, email.new_registration_message(org, conf, attendee.name, count))
    # Seats may have freed up while they were confirming; promotion sends its own email.
    promoted = promote_waitlist(db, conf, background)
    db.commit()
    db.refresh(attendee)
    if attendee not in promoted:
        email.queue(background, email.registration_message(attendee, conf, waitlist_position(db, attendee)))
    return _ticket_payload(db, attendee)


@tickets.post("/{code}/resend")
@limiter.limit("3/minute")
def resend_confirmation(request: Request, code: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    attendee = _ticket(db, code)
    if attendee.confirmed_at is None:
        wait = codes.resend_wait(attendee, "confirm")
        if wait:
            raise AppError(429, "code_wait", "Please wait before asking for another code", {"seconds": wait})
        _send_code(db, background, attendee, db.get(Conference, attendee.conference_id))
    return CONFIRM_RESENT


@tickets.delete("/{code}", status_code=204)
@limiter.limit("10/minute")
def cancel_my_ticket(request: Request, code: str, background: BackgroundTasks, db: Session = Depends(get_db)):
    attendee = _ticket(db, code)
    conf = db.get(Conference, attendee.conference_id)
    if conf.date < date.today():
        raise AppError(400, "conference_past", "This conference has already taken place")
    if attendee.checked_in_at:
        raise AppError(409, "already_checked_in", "Already checked in", {"name": attendee.name})
    _cancel(db, attendee, conf, background, by_attendee=True)
