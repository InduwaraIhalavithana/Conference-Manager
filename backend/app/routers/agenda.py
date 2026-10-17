"""Agenda sessions and speakers of a conference. Only its organizer can change them."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_organizer
from app.core.errors import AppError
from app.core.serialize import columns
from app.core.uploads import delete_image, save_image
from app.db.database import get_db
from app.models.agenda import Session as AgendaSession
from app.models.agenda import Speaker
from app.routers.conferences import own_conference
from app.schemas.conference import SessionIn, SpeakerIn

router = APIRouter(prefix="/api/conferences/{conf_id}", tags=["agenda"])


def _speaker(db: Session, conf_id: int, speaker_id: int) -> Speaker:
    sp = db.execute(
        select(Speaker).where(Speaker.id == speaker_id, Speaker.conference_id == conf_id)
    ).scalar_one_or_none()
    if not sp:
        raise AppError(404, "speaker_not_found", "Speaker not found")
    return sp


def _session(db: Session, conf_id: int, session_id: int) -> AgendaSession:
    s = db.execute(
        select(AgendaSession).where(AgendaSession.id == session_id, AgendaSession.conference_id == conf_id)
    ).scalar_one_or_none()
    if not s:
        raise AppError(404, "session_not_found", "Session not found")
    return s


def _check_speaker_ref(db: Session, conf_id: int, speaker_id: int | None) -> None:
    if speaker_id is not None:
        _speaker(db, conf_id, speaker_id)


# ── Speakers ────────────────────────────────────────────────────────────────

@router.post("/speakers", status_code=201)
def add_speaker(conf_id: int, body: SpeakerIn, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    sp = Speaker(conference_id=conf_id, **body.model_dump())
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return columns(sp)


@router.put("/speakers/{speaker_id}")
def update_speaker(conf_id: int, speaker_id: int, body: SpeakerIn, org=Depends(get_current_organizer),
                   db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    sp = _speaker(db, conf_id, speaker_id)
    for k, v in body.model_dump().items():
        setattr(sp, k, v)
    db.commit()
    db.refresh(sp)
    return columns(sp)


@router.delete("/speakers/{speaker_id}", status_code=204)
def delete_speaker(conf_id: int, speaker_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    sp = _speaker(db, conf_id, speaker_id)
    photo = sp.photo
    # Sessions keep their slot but lose the speaker (the FK is SET NULL in Postgres; done here for SQLite too).
    for s in db.execute(select(AgendaSession).where(AgendaSession.speaker_id == sp.id)).scalars():
        s.speaker_id = None
    db.delete(sp)
    db.commit()
    delete_image(photo)


@router.post("/speakers/{speaker_id}/photo")
async def upload_speaker_photo(conf_id: int, speaker_id: int, file: UploadFile = File(...),
                               org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    sp = _speaker(db, conf_id, speaker_id)
    url = await save_image(file, "speaker")
    old, sp.photo = sp.photo, url
    db.commit()
    delete_image(old)
    return columns(sp)


@router.delete("/speakers/{speaker_id}/photo")
def remove_speaker_photo(conf_id: int, speaker_id: int, org=Depends(get_current_organizer),
                         db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    sp = _speaker(db, conf_id, speaker_id)
    old, sp.photo = sp.photo, None
    db.commit()
    delete_image(old)
    return columns(sp)


# ── Sessions ────────────────────────────────────────────────────────────────

@router.post("/sessions", status_code=201)
def add_session(conf_id: int, body: SessionIn, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    _check_speaker_ref(db, conf_id, body.speaker_id)
    s = AgendaSession(conference_id=conf_id, **body.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return columns(s)


@router.put("/sessions/{session_id}")
def update_session(conf_id: int, session_id: int, body: SessionIn, org=Depends(get_current_organizer),
                   db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    s = _session(db, conf_id, session_id)
    _check_speaker_ref(db, conf_id, body.speaker_id)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return columns(s)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(conf_id: int, session_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    own_conference(db, conf_id, org)
    db.delete(_session(db, conf_id, session_id))
    db.commit()
