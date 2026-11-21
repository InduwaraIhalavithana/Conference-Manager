"""The few REST endpoints: health, the CSRF token and image uploads. (Calendar files and CSV come in Phase 3.)"""

from typing import Any

from fastapi import APIRouter, Request, Response, UploadFile
from fastapi.responses import JSONResponse

from app.api import cookies
from app.core.errors import DomainError, ErrorCode
from app.services import health as health_service
from app.services import uploads
from app.services.auth import resolve_viewer

router = APIRouter()

STATUS = {
    ErrorCode.NOT_AUTHENTICATED: 401,
    ErrorCode.FORBIDDEN: 403,
    ErrorCode.CSRF_FAILED: 403,
    ErrorCode.RATE_LIMITED: 429,
    ErrorCode.FILE_TOO_LARGE: 413,
    ErrorCode.FILE_TYPE: 415,
    ErrorCode.FILE_NOT_IMAGE: 415,
}


def _error(err: DomainError) -> JSONResponse:
    body: dict[str, Any] = {"code": err.code.value, "message": err.message}
    if "retry_after" in err.extra:
        body["retryAfterSeconds"] = err.extra["retry_after"]
    if "max_mb" in err.extra:
        body["maxMb"] = err.extra["max_mb"]
    return JSONResponse(body, status_code=STATUS.get(err.code, 400))


@router.get("/health")
async def health() -> dict[str, str]:
    return await health_service.status()


@router.get("/auth/csrf")
async def csrf(request: Request, response: Response) -> dict[str, str]:
    """Sets the cm_csrf cookie when missing and returns its value, for the web app's X-CSRF-Token header."""
    return {"csrfToken": cookies.ensure_csrf(request, response)}


@router.post("/upload", response_model=None)
async def upload(request: Request, kind: str, file: UploadFile) -> dict[str, str] | JSONResponse:
    """Upload a cover (`kind=cover`) or speaker photo (`kind=speaker`) as multipart field `file`.

    Needs the sign-in cookie and the X-CSRF-Token header. Returns `{"url": "/uploads/..."}`.
    """
    try:
        if not cookies.csrf_ok(request):
            raise DomainError(ErrorCode.CSRF_FAILED, "CSRF check failed: reload the page and try again")
        viewer = await resolve_viewer(request.cookies.get(cookies.ACCESS))
        data = await file.read(uploads.max_bytes() + 1)
        url = await uploads.upload(viewer, kind, file.content_type, data)
    except DomainError as err:
        return _error(err)
    return {"url": url}
