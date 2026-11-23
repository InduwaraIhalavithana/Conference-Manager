"""Live Q&A: the ticket holder's board, asking and voting, and the organizer's moderation. Rules:
app.services.questions."""

from datetime import datetime
from enum import Enum
from typing import Annotated

import strawberry
from strawberry.types import Info

from app.api.graphql.conferences import LocalizedText
from app.api.graphql.context import Context
from app.api.graphql.types import UserError, guarded
from app.models import Conference as ConferenceDoc
from app.models import Question as QuestionDoc
from app.services import questions as service


@strawberry.enum
class QuestionStatus(Enum):
    OPEN = "open"
    ANSWERED = "answered"
    HIDDEN = "hidden"


def _text(value: object) -> LocalizedText:
    return LocalizedText(en=value.en, si=value.si, ta=value.ta)  # type: ignore[attr-defined]


@strawberry.type(description="A question as ticket holders see it: first name only, and whether it is theirs.")
class LiveQuestion:
    id: strawberry.ID
    session_id: strawberry.ID
    text: str
    author_name: str
    votes: int
    status: QuestionStatus
    created_at: datetime
    answered_at: datetime | None
    voted_by_me: bool
    mine: bool

    @classmethod
    def build(cls, doc: QuestionDoc, viewer_registration_id: object) -> "LiveQuestion":
        return cls(
            id=strawberry.ID(str(doc.id)),
            session_id=strawberry.ID(doc.session_id),
            text=doc.text,
            author_name=doc.author_name,
            votes=doc.votes,
            status=QuestionStatus(doc.status),
            created_at=doc.created_at,
            answered_at=doc.answered_at,
            voted_by_me=viewer_registration_id in doc.voter_ids,
            mine=doc.registration_id == viewer_registration_id,
        )


@strawberry.type(description="A question as the organizer sees it, hidden ones included.")
class ModeratedQuestion:
    id: strawberry.ID
    session_id: strawberry.ID
    text: str
    author_name: str
    votes: int
    status: QuestionStatus
    created_at: datetime
    answered_at: datetime | None

    @classmethod
    def from_doc(cls, doc: QuestionDoc) -> "ModeratedQuestion":
        return cls(
            id=strawberry.ID(str(doc.id)),
            session_id=strawberry.ID(doc.session_id),
            text=doc.text,
            author_name=doc.author_name,
            votes=doc.votes,
            status=QuestionStatus(doc.status),
            created_at=doc.created_at,
            answered_at=doc.answered_at,
        )


@strawberry.type
class QaSession:
    id: strawberry.ID
    title: LocalizedText
    starts_at: datetime
    ends_at: datetime
    room: str | None
    questions: int = strawberry.field(description="Visible questions in this session.")


def _sessions(conference: ConferenceDoc, counts: dict[str, int]) -> list[QaSession]:
    return [
        QaSession(
            id=strawberry.ID(s.id),
            title=_text(s.title),
            starts_at=s.starts_at,
            ends_at=s.ends_at,
            room=s.room,
            questions=counts.get(s.id, 0),
        )
        for s in sorted(conference.sessions, key=lambda s: s.starts_at)
    ]


@strawberry.type(description="One session's live Q&A for a ticket holder.")
class QaBoard:
    open: bool = strawberry.field(description="False once Q&A has closed (then the board is read-only).")
    conference_id: strawberry.ID
    conference_title: LocalizedText
    slug: str
    timezone: str
    session_id: strawberry.ID | None
    sessions: list[QaSession]
    questions: list[LiveQuestion]


@strawberry.type
class SessionQuestions:
    sessions: list[QaSession]
    questions: list[ModeratedQuestion]


QaBoardResult = Annotated[QaBoard | UserError, strawberry.union("QaBoardResult")]
LiveQuestionResult = Annotated[LiveQuestion | UserError, strawberry.union("LiveQuestionResult")]
SessionQuestionsResult = Annotated[SessionQuestions | UserError, strawberry.union("SessionQuestionsResult")]
ModeratedQuestionResult = Annotated[ModeratedQuestion | UserError, strawberry.union("ModeratedQuestionResult")]


@strawberry.type
class QuestionQuery:
    @strawberry.field(description="Live Q&A for a ticket holder: one session's questions (the current or next "
                      "session when none is given), most votes first.")  # fmt: skip
    async def live_questions(self, ticket_code: str, session_id: strawberry.ID | None = None) -> QaBoardResult:
        async def run() -> QaBoard:
            b = await service.board(ticket_code, str(session_id) if session_id else None)
            return QaBoard(
                open=service.is_open(b.conference),
                conference_id=strawberry.ID(str(b.conference.id)),
                conference_title=_text(b.conference.title),
                slug=b.conference.slug,
                timezone=b.conference.timezone,
                session_id=strawberry.ID(b.session_id) if b.session_id else None,
                sessions=_sessions(b.conference, b.counts),
                questions=[LiveQuestion.build(q, b.registration.id) for q in b.questions],
            )

        return await guarded(run)

    @strawberry.field(description="All questions in one session of the signed-in organizer's conference.")
    async def session_questions(
        self, info: Info[Context, None], conference_id: strawberry.ID, session_id: strawberry.ID
    ) -> SessionQuestionsResult:
        async def run() -> SessionQuestions:
            docs = await service.session_questions(info.context.viewer, str(conference_id), str(session_id))
            conference = await service.owned(info.context.viewer, str(conference_id))
            counts = await service.question_counts(info.context.viewer, str(conference_id))
            return SessionQuestions(
                sessions=_sessions(conference, counts), questions=[ModeratedQuestion.from_doc(q) for q in docs]
            )

        return await guarded(run)


@strawberry.type
class QuestionMutation:
    @strawberry.mutation(description="Ask a question in a session (3-300 characters). Confirmed ticket holders only.")
    async def ask_question(
        self, info: Info[Context, None], ticket_code: str, session_id: strawberry.ID, text: str
    ) -> LiveQuestionResult:
        async def run() -> LiveQuestion:
            doc = await service.ask(info.context.ip, ticket_code, str(session_id), text)
            return LiveQuestion.build(doc, doc.registration_id)

        return await guarded(run)

    @strawberry.mutation(description="Upvote someone else's question, or take the vote back.")
    async def vote_question(
        self, info: Info[Context, None], ticket_code: str, question_id: strawberry.ID, voted: bool
    ) -> LiveQuestionResult:
        async def run() -> LiveQuestion:
            doc, registration = await service.vote(info.context.ip, ticket_code, str(question_id), voted)
            return LiveQuestion.build(doc, registration.id)

        return await guarded(run)

    @strawberry.mutation(description="Mark a question answered, hide it, or open it again (the organizer).")
    async def set_question_status(
        self, info: Info[Context, None], question_id: strawberry.ID, status: QuestionStatus
    ) -> ModeratedQuestionResult:
        async def run() -> ModeratedQuestion:
            return ModeratedQuestion.from_doc(
                await service.moderate(info.context.viewer, str(question_id), status.value)
            )

        return await guarded(run)
