"""Settings read once from the environment (backend/.env fills in anything not already set)."""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env", override=False)

TESTING = os.getenv("CM_TESTING") == "1"

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174").rstrip("/")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@example.com").strip().lower()
ADMIN_INITIAL_PASSWORD = os.getenv("ADMIN_INITIAL_PASSWORD", "")

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BACKEND_DIR / "uploads")))
# Never email these domains (or their subdomains): the demo seed's made-up addresses would only bounce
# and hurt the sending Gmail account's reputation.
EMAIL_BLOCKED_DOMAINS = tuple(
    d.strip().lower() for d in os.getenv("EMAIL_BLOCKED_DOMAINS", "demo.conferencehub.lk").split(",") if d.strip()
)

# How often the reminder loop looks for conferences starting tomorrow.
REMINDER_INTERVAL_SECONDS = int(os.getenv("REMINDER_INTERVAL_SECONDS", "900"))
# How long an unconfirmed registration holds its seat, and how long an emailed 6-digit code works.
CONFIRM_HOLD_HOURS = int(os.getenv("CONFIRM_HOLD_HOURS", "24"))
VERIFY_CODE_MINUTES = int(os.getenv("VERIFY_CODE_MINUTES", "15"))

CORS_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174",
    ).split(",")
    if o.strip()
]
