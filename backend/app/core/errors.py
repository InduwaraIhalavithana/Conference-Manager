"""API errors that carry a stable `code` so the frontend can show them in the user's language.

Every error body looks like {"detail": "<English text>", "code": "<snake_case_code>"}.
`detail` stays English for logs and API users; the UI translates `code`.
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded


class AppError(HTTPException):
    def __init__(self, status_code: int, code: str, detail: str, extra: dict | None = None):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.extra = extra or {}


def not_found(code: str = "not_found", detail: str = "Not found") -> AppError:
    return AppError(404, code, detail)


_STATUS_CODES = {400: "bad_request", 401: "not_authenticated", 403: "forbidden", 404: "not_found", 409: "conflict"}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse({"detail": exc.detail, "code": exc.code, **exc.extra}, status_code=exc.status_code)

    @app.exception_handler(HTTPException)
    async def _http_error(_: Request, exc: HTTPException):
        code = _STATUS_CODES.get(exc.status_code, "error")
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        return JSONResponse({"detail": detail, "code": code}, status_code=exc.status_code, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError):
        fields = []
        for err in exc.errors():
            loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path")]
            fields.append({"field": ".".join(loc), "type": err.get("type", ""), "msg": err.get("msg", "")})
        first = fields[0] if fields else {"field": "", "msg": "Invalid input"}
        return JSONResponse(
            {"detail": f"{first['field']}: {first['msg']}".strip(": "), "code": "validation_error", "fields": fields},
            status_code=422,
        )

    @app.exception_handler(RateLimitExceeded)
    async def _rate_limited(_: Request, exc: RateLimitExceeded):
        return JSONResponse({"detail": "Too many attempts. Try again in a minute.", "code": "rate_limited"},
                            status_code=429)
