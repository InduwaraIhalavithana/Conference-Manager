from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from datetime import date
from app.db.database import get_db
from app.core.deps import get_current_organizer
from app.models.conference import Conference
from app.models.attendee import Attendee
from app.models.organizer import Organizer
from app.models.activity import ActivityLog
from app.schemas.conference import ConferenceCreate, ConferenceUpdate, ConferencePatch

router = APIRouter(prefix="/api/conferences", tags=["conferences"])


def _enrich(conf: Conference, db: Session, organizer_name: str | None = None) -> dict:
    count = db.execute(select(func.count()).where(Attendee.conference_id == conf.id)).scalar()
    return {
        **{c.key: getattr(conf, c.key) for c in conf.__table__.columns},
        "attendee_count": count,
        "organizer_name": organizer_name,
    }


@router.get("/past")
def past_conferences(org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    confs = db.execute(
        select(Conference)
        .where(Conference.organizer_id == org.id, Conference.date < date.today())
        .order_by(Conference.date.desc())
    ).scalars().all()
    return [_enrich(c, db) for c in confs]


@router.get("/upcoming")
def upcoming_conferences(db: Session = Depends(get_db)):
    rows = db.execute(
        select(Conference, Organizer)
        .join(Organizer, Conference.organizer_id == Organizer.id)
        .where(Conference.date >= date.today())
        .order_by(Conference.date, Conference.time)
    ).all()
    return [
        _enrich(conf, db, f"{org.first_name} {org.last_name}")
        for conf, org in rows
    ]


@router.get("/{conf_id}")
def get_conference(conf_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        select(Conference, Organizer).join(Organizer).where(Conference.id == conf_id)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Conference not found")
    conf, org = row
    return _enrich(conf, db, f"{org.first_name} {org.last_name}")


@router.get("/")
def my_conferences(org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    confs = db.execute(
        select(Conference)
        .where(Conference.organizer_id == org.id)
        .order_by(Conference.date.desc())
    ).scalars().all()
    return [_enrich(c, db) for c in confs]


@router.post("/", status_code=201)
def create_conference(body: ConferenceCreate, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = Conference(**body.model_dump(), organizer_id=org.id)
    db.add(conf)
    db.add(ActivityLog(organizer_id=org.id, action="create_conference", target=body.title))
    db.commit()
    db.refresh(conf)
    return _enrich(conf, db)


@router.put("/{conf_id}")
def update_conference(conf_id: int, body: ConferenceUpdate, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.execute(
        select(Conference).where(and_(Conference.id == conf_id, Conference.organizer_id == org.id))
    ).scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    for k, v in body.model_dump().items():
        setattr(conf, k, v)
    db.add(ActivityLog(organizer_id=org.id, action="update_conference", target=body.title))
    db.commit()
    db.refresh(conf)
    return _enrich(conf, db)


@router.patch("/{conf_id}")
def patch_conference(conf_id: int, body: ConferencePatch, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.execute(
        select(Conference).where(and_(Conference.id == conf_id, Conference.organizer_id == org.id))
    ).scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(conf, k, v)
    db.add(ActivityLog(organizer_id=org.id, action="update_conference", target=conf.title))
    db.commit()
    db.refresh(conf)
    return _enrich(conf, db)


@router.delete("/{conf_id}", status_code=204)
def delete_conference(conf_id: int, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    conf = db.execute(
        select(Conference).where(and_(Conference.id == conf_id, Conference.organizer_id == org.id))
    ).scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Conference not found")
    db.add(ActivityLog(organizer_id=org.id, action="delete_conference", target=conf.title))
    db.delete(conf)
    db.commit()
