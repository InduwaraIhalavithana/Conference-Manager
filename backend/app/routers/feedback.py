from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_organizer
from app.core.notify import notify_admins
from app.core.serialize import columns
from app.db.database import get_db
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/", status_code=201)
def submit_feedback(body: FeedbackCreate, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    fb = Feedback(organizer_id=org.id, subject=body.subject, message=body.message, status="open")
    db.add(fb)
    db.flush()
    notify_admins(db, "new_feedback", {"subject": body.subject, "organizer": f"{org.first_name} {org.last_name}"},
                  "/admin/feedback")
    db.commit()
    db.refresh(fb)
    return columns(fb)


@router.get("/mine")
def my_feedback(org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    rows = db.execute(
        select(Feedback).where(Feedback.organizer_id == org.id).order_by(Feedback.created_at.desc())
    ).scalars().all()
    return [columns(f) for f in rows]
