from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.database import get_db
from app.core.deps import get_current_organizer
from app.models.feedback import Feedback
from app.schemas.feedback import FeedbackCreate

router = APIRouter(prefix="/api/feedback", tags=["feedback"])


@router.post("/", status_code=201)
def submit_feedback(body: FeedbackCreate, org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    fb = Feedback(organizer_id=org.id, subject=body.subject, message=body.message)
    db.add(fb)
    db.commit()
    db.refresh(fb)
    return fb


@router.get("/mine")
def my_feedback(org=Depends(get_current_organizer), db: Session = Depends(get_db)):
    return db.execute(
        select(Feedback).where(Feedback.organizer_id == org.id).order_by(Feedback.created_at.desc())
    ).scalars().all()
