"""Bookmarks and ratings from ticket holders, and the organizer's view of the ratings. Rules: app.services.feedback."""

from datetime import datetime
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api.graphql.conferences import LocalizedText
from app.api.graphql.context import Context
from app.api.graphql.registrations import MyRating, Ticket, TicketResult, ticket_by_code
from app.api.graphql.types import UserError, guarded
from app.services import feedback as service


@strawberry.type(description="Average stars (1-5) and number of ratings: a session, or the conference when null.")
class ScoreSummary:
    session_id: strawberry.ID | None
    session_title: LocalizedText | None = strawberry.field(description="Null for the conference as a whole.")
    average: float
    count: int


@strawberry.type(description="A rating that came with a comment. Anonymous: the organizer never sees who wrote it.")
class FeedbackComment:
    session_id: strawberry.ID | None
    session_title: LocalizedText | None
    score: int
    comment: str
    updated_at: datetime


@strawberry.type
class ConferenceFeedback:
    respondents: int = strawberry.field(description="Tickets that gave at least one rating.")
    attended: int = strawberry.field(description="People checked in (who could give feedback).")
    scores: list[ScoreSummary]
    comments: list[FeedbackComment]
    closes_at: datetime


ConferenceFeedbackResult = Annotated[ConferenceFeedback | UserError, strawberry.union("ConferenceFeedbackResult")]
RatingResult = Annotated[MyRating | UserError, strawberry.union("RatingResult")]


@strawberry.type
class FeedbackQuery:
    @strawberry.field(description="Ratings and comments for one of the signed-in organizer's conferences.")
    async def conference_feedback(
        self, info: Info[Context, None], conference_id: strawberry.ID
    ) -> ConferenceFeedbackResult:
        async def run() -> ConferenceFeedback:
            s = await service.conference_feedback(info.context.viewer, str(conference_id))

            def title(session_id: str | None) -> LocalizedText | None:
                session = s.conference.session(session_id) if session_id else None
                return LocalizedText(en=session.title.en, si=session.title.si, ta=session.title.ta) if session else None

            return ConferenceFeedback(
                respondents=s.respondents,
                attended=s.attended,
                scores=[
                    ScoreSummary(
                        session_id=strawberry.ID(x.session_id) if x.session_id else None,
                        session_title=title(x.session_id),
                        average=x.average,
                        count=x.count,
                    )
                    for x in s.scores
                ],
                comments=[
                    FeedbackComment(
                        session_id=strawberry.ID(c.session_id) if c.session_id else None,
                        session_title=title(c.session_id),
                        score=c.score,
                        comment=c.comment or "",
                        updated_at=c.updated_at,
                    )
                    for c in s.comments
                ],
                closes_at=service.closes_at(s.conference),
            )

        return await guarded(run)


@strawberry.type
class FeedbackMutation:
    @strawberry.mutation(description="Save or unsave a session on the ticket holder's own agenda.")
    async def set_bookmark(
        self, info: Info[Context, None], ticket_code: str, session_id: strawberry.ID, bookmarked: bool
    ) -> TicketResult:
        async def run() -> Ticket:
            registration = await service.set_bookmark(info.context.ip, ticket_code, str(session_id), bookmarked)
            return await ticket_by_code(registration.ticket_code)

        return await guarded(run)

    @strawberry.mutation(
        description="Rate a session (or the conference, with no sessionId) 1-5 stars with an optional comment. "
        "Checked-in attendees only, after it has ended and until feedbackClosesAt; giving it again replaces it."
    )
    async def rate_session(
        self,
        info: Info[Context, None],
        ticket_code: str,
        score: int,
        session_id: strawberry.ID | None = None,
        comment: str | None = None,
    ) -> RatingResult:
        async def run() -> MyRating:
            doc = await service.rate(
                info.context.ip, ticket_code, str(session_id) if session_id else None, score, comment
            )
            return MyRating.from_doc(doc)

        return await guarded(run)
