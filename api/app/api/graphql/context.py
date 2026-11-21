"""Per-request GraphQL context: the HTTP request and response, who is signed in, and the DataLoaders."""

from fastapi import Request, Response
from strawberry.dataloader import DataLoader
from strawberry.fastapi import BaseContext

from app.api import cookies
from app.models import Organizer
from app.models.common import ObjectId
from app.services.auth import Viewer, resolve_viewer
from app.services.conferences import organizers_by_ids


class Context(BaseContext):
    def __init__(self, viewer: Viewer | None) -> None:
        super().__init__()
        self.viewer = viewer
        # One query for all the organizers on a page of conferences, instead of one per conference (no N+1).
        self.organizer_loader: DataLoader[ObjectId, Organizer | None] = DataLoader(load_fn=organizers_by_ids)

    @property
    def req(self) -> Request:
        assert self.request is not None
        return self.request  # type: ignore[return-value]

    @property
    def res(self) -> Response:
        assert self.response is not None
        return self.response

    @property
    def ip(self) -> str:
        return cookies.client_ip(self.req)

    @property
    def user_agent(self) -> str | None:
        return self.req.headers.get("user-agent")


async def get_context(request: Request, response: Response) -> Context:
    cookies.ensure_csrf(request, response)
    return Context(viewer=await resolve_viewer(request.cookies.get(cookies.ACCESS)))
