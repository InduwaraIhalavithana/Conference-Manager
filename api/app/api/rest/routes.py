"""The few REST endpoints: health, the CSRF token, image uploads, calendar files and the attendee CSV."""

import json
from collections.abc import AsyncIterator
from typing import Any

from fastapi import APIRouter, Request, Response, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.responses import Response as RawResponse

from app.api import cookies
from app.core.errors import DomainError, ErrorCode
from app.services import exports, live, system, uploads
from app.services import health as health_service
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
    ErrorCode.NOT_FOUND: 404,
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
    """Upload a cover (`kind=cover`), speaker photo (`kind=speaker`) or profile photo (`kind=avatar`) as multipart
    field `file`.

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


@router.get("/conferences/{slug}/calendar.ics", response_model=None)
async def calendar(slug: str) -> RawResponse | JSONResponse:
    """Add-to-calendar file for a public conference."""
    try:
        filename, body = await exports.public_calendar(slug)
    except DomainError as err:
        return _error(err)
    return RawResponse(
        body,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/conferences/{conference_id}/attendees.csv", response_model=None)
async def attendees_csv(request: Request, conference_id: str) -> RawResponse | JSONResponse:
    """The organizer's attendee list as CSV (sign-in cookie; only for the conference's owner)."""
    try:
        viewer = await resolve_viewer(request.cookies.get(cookies.ACCESS))
        filename, body = await exports.attendees_csv(viewer, conference_id)
    except DomainError as err:
        return _error(err)
    return RawResponse(
        body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/conferences/{conference_id}/live", response_model=None)
async def live_checkins(request: Request, conference_id: str) -> StreamingResponse | JSONResponse:
    """Server-sent events for the conference's owner: current check-in numbers, then one event per check-in or
    undo, and a ping every 20 seconds. Used by the check-in desk; other desks' scans show up within a moment."""
    try:
        viewer = await resolve_viewer(request.cookies.get(cookies.ACCESS))
        first = await live.snapshot(viewer, conference_id)
    except DomainError as err:
        return _error(err)

    async def stream() -> AsyncIterator[str]:
        yield "retry: 3000\n\n"
        yield f"data: {json.dumps(first)}\n\n"
        async for event in live.events(conference_id):
            if await request.is_disconnected():
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        # No buffering anywhere on the way (Next.js proxy, nginx), so each event arrives at once.
        headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"},
    )


@router.get("/metrics", response_model=None)
async def metrics(request: Request) -> RawResponse | JSONResponse:
    """Prometheus text: dependencies up, queue length, failed emails, recent requests and server errors.
    Only for a signed-in admin: behind the web proxy every request looks local, so the address proves nothing."""
    viewer = await resolve_viewer(request.cookies.get(cookies.ACCESS))
    if viewer is None:
        return _error(DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first"))
    if viewer.admin is None:
        return _error(DomainError(ErrorCode.FORBIDDEN, "Only administrators can read metrics"))
    return RawResponse(system.prometheus(await system.status()), media_type="text/plain; version=0.0.4")
