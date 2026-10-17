import asyncio
import logging
import os
import secrets
from contextlib import asynccontextmanager, suppress

from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from alembic import command
from app.api.auth import router as auth_router
from app.core.config import ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD, CORS_ORIGINS, TESTING
from app.core.errors import install_error_handlers
from app.core.ratelimit import limiter
from app.core.reminders import reminder_loop
from app.core.security import hash_password
from app.core.uploads import ensure_upload_dirs
from app.db.database import SessionLocal
from app.models.admin import Admin
from app.routers.admin import router as admin_router
from app.routers.agenda import router as agenda_router
from app.routers.attendees import router as attendees_router
from app.routers.attendees import tickets as tickets_router
from app.routers.conferences import router as conferences_router
from app.routers.feedback import router as feedback_router
from app.routers.notifications import router as notifications_router
from app.routers.organizers import router as organizers_router
from app.routers.public import router as public_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("conference")


def ensure_admin() -> None:
    """Create the admin account on first start, and give an older admin row its email address."""
    with SessionLocal() as db:
        admin = db.execute(select(Admin).order_by(Admin.id)).scalars().first()
        if admin is None:
            password = ADMIN_INITIAL_PASSWORD or secrets.token_urlsafe(12)
            if not ADMIN_INITIAL_PASSWORD:
                log.warning("ADMIN_INITIAL_PASSWORD is not set; generated admin password: %s", password)
            db.add(Admin(username="admin", email=ADMIN_EMAIL, password_hash=hash_password(password)))
            db.commit()
        elif not admin.email:
            admin.email = ADMIN_EMAIL
            db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_upload_dirs()
    task = None
    if not TESTING:
        ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
        command.upgrade(Config(os.path.abspath(ini_path)), "head")
        ensure_admin()
        task = asyncio.create_task(reminder_loop())
    yield
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="Conference Manager API", version="2.0.0", lifespan=lifespan)
app.state.limiter = limiter
install_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth_router, public_router, conferences_router, agenda_router, attendees_router, tickets_router,
          organizers_router, feedback_router, notifications_router, admin_router):
    app.include_router(r)

app.mount("/uploads", StaticFiles(directory=str(ensure_upload_dirs()), check_dir=False), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}
