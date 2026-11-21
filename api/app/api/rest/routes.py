"""The few REST endpoints: health and the CSRF token. (Uploads, .ics and CSV arrive with their phases.)"""

from fastapi import APIRouter, Request, Response

from app.api import cookies
from app.services import health as health_service

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    return await health_service.status()


@router.get("/auth/csrf")
async def csrf(request: Request, response: Response) -> dict[str, str]:
    """Sets the cm_csrf cookie when missing and returns its value, for the web app's X-CSRF-Token header."""
    return {"csrfToken": cookies.ensure_csrf(request, response)}
