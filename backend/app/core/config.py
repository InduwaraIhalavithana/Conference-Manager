"""Settings read once from the environment (backend/.env fills in anything not already set)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env", override=False)

TESTING = os.getenv("CM_TESTING") == "1"

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174").rstrip("/")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin.conferencehub@gmail.com").strip().lower()
ADMIN_INITIAL_PASSWORD = os.getenv("ADMIN_INITIAL_PASSWORD", "")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BACKEND_DIR / "uploads")))

# How often the reminder loop looks for conferences starting tomorrow.
REMINDER_INTERVAL_SECONDS = int(os.getenv("REMINDER_INTERVAL_SECONDS", "900"))

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
    ).split(",")
    if o.strip()
]
