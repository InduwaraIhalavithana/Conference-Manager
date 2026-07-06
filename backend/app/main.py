from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from alembic.config import Config
from alembic import command
from sqlalchemy import select
from app.api.auth import router as auth_router
from app.routers.conferences import router as conferences_router
from app.routers.attendees import router as attendees_router
from app.routers.organizers import router as organizers_router
from app.routers.feedback import router as feedback_router
from app.routers.admin import router as admin_router
from app.db.database import SessionLocal
from app.models.admin import Admin
from app.core.security import hash_password
import os

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    ini_path = os.path.join(os.path.dirname(__file__), "..", "alembic.ini")
    alembic_cfg = Config(os.path.abspath(ini_path))
    command.upgrade(alembic_cfg, "head")

    with SessionLocal() as db:
        existing = db.execute(select(Admin).where(Admin.username == "admin")).scalar_one_or_none()
        if not existing:
            initial_pw = os.getenv("ADMIN_INITIAL_PASSWORD", "admin123")
            db.add(Admin(username="admin", password_hash=hash_password(initial_pw)))
            db.commit()

    yield


app = FastAPI(title="Conference Manager API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(conferences_router)
app.include_router(attendees_router)
app.include_router(organizers_router)
app.include_router(feedback_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
