import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import date
from app.db.database import get_db
from app.core.deps import get_current_admin
from app.core.pagination import paginate
from app.core.email import send_email
from app.models.organizer import Organizer
from app.models.conference import Conference
from app.models.attendee import Attendee
from app.models.activity import ActivityLog
from app.models.feedback import Feedback
from app.schemas.admin import AdminStats, FeedbackReply

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=AdminStats)
def stats(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    def count(model, condition=None):
        q = select(func.count()).select_from(model)
        if condition is not None:
            q = q.where(condition)
        return db.execute(q).scalar()

    return AdminStats(
        total_organizers=count(Organizer),
        active_organizers=count(Organizer, ~Organizer.is_suspended),
        suspended=count(Organizer, Organizer.is_suspended),
        total_confs=count(Conference),
        upcoming_confs=count(Conference, Conference.date >= date.today()),
        total_attendees=count(Attendee),
        open_feedback=count(Feedback, Feedback.status == "open"),
    )


@router.get("/organizers")
def list_organizers(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    items = db.execute(select(Organizer).order_by(Organizer.created_at.desc())).scalars().all()
    result = paginate(
        [
            {c.key: getattr(o, c.key) for c in o.__table__.columns}
            for o in items
        ],
        page,
        per_page,
    )
    return result


@router.put("/organizers/{org_id}/suspend", status_code=204)
def suspend(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    org = db.get(Organizer, org_id)
    if not org:
        raise HTTPException(404, "Organizer not found")
    org.is_suspended = True
    db.commit()


@router.put("/organizers/{org_id}/unsuspend", status_code=204)
def unsuspend(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    org = db.get(Organizer, org_id)
    if not org:
        raise HTTPException(404, "Organizer not found")
    org.is_suspended = False
    db.commit()


@router.delete("/organizers/{org_id}", status_code=204)
def delete_organizer(org_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    org = db.get(Organizer, org_id)
    if not org:
        raise HTTPException(404, "Organizer not found")
    db.delete(org)
    db.commit()


@router.delete("/conferences/{conf_id}", status_code=204)
def delete_conference(conf_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    conf = db.get(Conference, conf_id)
    if not conf:
        raise HTTPException(404, "Conference not found")
    db.delete(conf)
    db.commit()


@router.get("/conferences")
def all_conferences(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    rows = db.execute(
        select(Conference, Organizer, func.count(Attendee.id).label("attendee_count"))
        .join(Organizer, Conference.organizer_id == Organizer.id)
        .outerjoin(Attendee, Attendee.conference_id == Conference.id)
        .group_by(Conference.id, Organizer.id)
        .order_by(Conference.date.desc())
    ).all()
    items = [
        {
            **{c.key: getattr(conf, c.key) for c in conf.__table__.columns},
            "organizer_name": f"{org.first_name} {org.last_name}",
            "attendee_count": count,
        }
        for conf, org, count in rows
    ]
    return paginate(items, page, per_page)


@router.get("/feedback")
def all_feedback(db: Session = Depends(get_db), _=Depends(get_current_admin)):
    rows = db.execute(select(Feedback, Organizer).join(Organizer).order_by(Feedback.created_at.desc())).all()
    return [
        {
            **{c.key: getattr(fb, c.key) for c in fb.__table__.columns},
            "organizer_name": f"{org.first_name} {org.last_name}",
            "organizer_email": org.email,
        }
        for fb, org in rows
    ]


@router.put("/feedback/{fb_id}/reply", status_code=204)
def reply_feedback(fb_id: int, body: FeedbackReply, background_tasks: BackgroundTasks, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    fb = db.get(Feedback, fb_id)
    if not fb:
        raise HTTPException(404)
    fb.reply = body.reply
    db.commit()
    org = db.get(Organizer, fb.organizer_id)
    if org:
        background_tasks.add_task(
            asyncio.run,
            send_email(org.email, "Admin replied to your feedback", "feedback_reply.html", {
                "organizer_name": f"{org.first_name} {org.last_name}",
                "feedback_subject": fb.subject,
                "reply": body.reply,
            }),
        )


@router.put("/feedback/{fb_id}/resolve", status_code=204)
def resolve_feedback(fb_id: int, db: Session = Depends(get_db), _=Depends(get_current_admin)):
    fb = db.get(Feedback, fb_id)
    if not fb:
        raise HTTPException(404)
    fb.status = "resolved"
    db.commit()


@router.get("/activity")
def activity_log(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_admin),
):
    rows = db.execute(
        select(ActivityLog, Organizer)
        .outerjoin(Organizer, ActivityLog.organizer_id == Organizer.id)
        .order_by(ActivityLog.created_at.desc())
    ).all()
    items = [
        {
            **{c.key: getattr(log, c.key) for c in log.__table__.columns},
            "organizer_name": f"{org.first_name} {org.last_name}" if org else None,
        }
        for log, org in rows
    ]
    return paginate(items, page, per_page)
