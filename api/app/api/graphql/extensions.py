"""Schema-wide checks."""

from collections.abc import Iterator

from graphql import GraphQLError
from strawberry.extensions import SchemaExtension
from strawberry.types.graphql import OperationType

from app.api import cookies


class CsrfProtection(SchemaExtension):
    """Every mutation must carry the X-CSRF-Token header matching the cm_csrf cookie (double-submit check).

    Cookies are SameSite=Lax already; this also stops another site from making a signed-in browser
    run a mutation through a plain form post, because such posts cannot set custom headers.
    """

    def on_execute(self) -> Iterator[None]:
        ctx = self.execution_context
        if ctx.operation_type == OperationType.MUTATION:
            request = ctx.context.request
            if request is None or not cookies.csrf_ok(request):
                raise GraphQLError(
                    "CSRF check failed: reload the page and try again", extensions={"code": "csrf_failed"}
                )
        yield
