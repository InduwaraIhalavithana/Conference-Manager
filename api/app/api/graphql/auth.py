"""Auth queries and mutations. Thin: validation and rules live in app.services.auth; this file deals with
GraphQL shapes and cookies."""

from datetime import datetime
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api import cookies
from app.api.graphql.context import Context
from app.api.graphql.types import Done, DoneResult, UserError, Viewer, guarded, viewer_from
from app.core.errors import DomainError, ErrorCode
from app.services import auth as auth_service


@strawberry.type
class SignedIn:
    viewer: Viewer
    access_expires_at: datetime


@strawberry.type
class CodeSent:
    email: str
    resend_after_seconds: int


AuthResult = Annotated[SignedIn | UserError, strawberry.union("AuthResult")]
CodeSentResult = Annotated[CodeSent | UserError, strawberry.union("CodeSentResult")]


@strawberry.input
class RegisterInput:
    first_name: str
    last_name: str
    email: str
    password: str
    phone: str | None = None
    organization: str | None = None
    lang: str = "en"


def _signed_in(info: Info[Context, None], result: auth_service.SignedIn) -> SignedIn:
    cookies.set_session(
        info.context.res,
        access=result.access_token,
        access_expires=result.access_expires_at,
        refresh=result.refresh_token,
        refresh_expires=result.refresh_expires_at,
        who=result.subject_type,
    )
    info.context.viewer = auth_service.Viewer(result.subject_type, result.subject, result.session_id)
    return SignedIn(viewer=viewer_from(result.subject), access_expires_at=result.access_expires_at)


def _code_sent(result: auth_service.CodeSent) -> CodeSent:
    return CodeSent(email=result.email, resend_after_seconds=result.resend_after_seconds)


def _not_signed_in() -> UserError:
    return UserError.from_domain(DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first"))


@strawberry.type
class AuthQuery:
    @strawberry.field(description="The signed-in organizer or admin, or null.")
    def me(self, info: Info[Context, None]) -> Viewer | None:
        viewer = info.context.viewer
        return viewer_from(viewer.subject) if viewer else None


@strawberry.type
class AuthMutation:
    @strawberry.mutation(description="Organizer sign-up. Emails a 6-digit code; the account works once it is entered.")
    async def register(self, info: Info[Context, None], input: RegisterInput) -> CodeSentResult:
        async def run() -> CodeSent:
            return _code_sent(await auth_service.register(info.context.ip, **vars(input)))

        return await guarded(run)

    @strawberry.mutation(description="Enter the emailed code: verifies the address and signs the organizer in.")
    async def verify_email(self, info: Info[Context, None], email: str, code: str) -> AuthResult:
        async def run() -> SignedIn:
            ctx = info.context
            return _signed_in(info, await auth_service.verify_email(ctx.ip, ctx.user_agent, email, code))

        return await guarded(run)

    @strawberry.mutation(description="Send a new code. The answer is the same whether or not the email exists.")
    async def resend_code(self, info: Info[Context, None], email: str) -> CodeSentResult:
        async def run() -> CodeSent:
            return _code_sent(await auth_service.resend_code(info.context.ip, email))

        return await guarded(run)

    @strawberry.mutation
    async def login(self, info: Info[Context, None], email: str, password: str) -> AuthResult:
        async def run() -> SignedIn:
            ctx = info.context
            return _signed_in(info, await auth_service.login(ctx.ip, ctx.user_agent, email, password))

        return await guarded(run)

    @strawberry.mutation(description="Administrator sign-in, by email (or the username 'admin').")
    async def admin_login(self, info: Info[Context, None], email: str, password: str) -> AuthResult:
        async def run() -> SignedIn:
            ctx = info.context
            return _signed_in(info, await auth_service.admin_login(ctx.ip, ctx.user_agent, email, password))

        return await guarded(run)

    @strawberry.mutation(description="Swap the refresh cookie for new tokens. A reused refresh token ends the session.")
    async def refresh(self, info: Info[Context, None]) -> AuthResult:
        ctx = info.context
        try:
            return _signed_in(info, await auth_service.refresh(ctx.req.cookies.get(cookies.REFRESH), ctx.ip))
        except DomainError as err:
            if err.code in (ErrorCode.SESSION_EXPIRED, ErrorCode.SESSION_REUSED):
                cookies.clear_session(ctx.res)
            return UserError.from_domain(err)

    @strawberry.mutation
    async def logout(self, info: Info[Context, None]) -> Done:
        ctx = info.context
        await auth_service.logout(ctx.viewer.session_id if ctx.viewer else None, ctx.req.cookies.get(cookies.REFRESH))
        cookies.clear_session(ctx.res)
        ctx.viewer = None
        return Done()

    @strawberry.mutation(description="Emails a reset link when the address is registered. Same answer either way.")
    async def forgot_password(self, info: Info[Context, None], email: str) -> DoneResult:
        async def run() -> Done:
            await auth_service.forgot_password(info.context.ip, email)
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Set a new password from an emailed link. Signs out every device.")
    async def reset_password(self, info: Info[Context, None], token: str, new_password: str) -> DoneResult:
        async def run() -> Done:
            await auth_service.reset_password(info.context.ip, token, new_password)
            return Done()

        return await guarded(run)

    @strawberry.mutation(description="Change the password. Keeps this device signed in, signs out the others.")
    async def change_password(self, info: Info[Context, None], current_password: str, new_password: str) -> DoneResult:
        viewer = info.context.viewer
        if viewer is None:
            return _not_signed_in()

        async def run() -> Done:
            await auth_service.change_password(viewer, current_password, new_password)
            return Done()

        return await guarded(run)
