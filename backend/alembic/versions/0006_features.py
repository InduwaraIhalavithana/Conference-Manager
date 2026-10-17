"""photos, admin email, waitlist + tickets, agenda/speakers, notifications, contact messages

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-17
"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def upgrade() -> None:
    # organizers: profile photo, organisation, bio, preferred language
    op.add_column("organizers", sa.Column("organization", sa.String(160), nullable=True))
    op.add_column("organizers", sa.Column("bio", sa.Text, nullable=True))
    op.add_column("organizers", sa.Column("avatar", sa.String(255), nullable=True))
    op.add_column("organizers", sa.Column("lang", sa.String(5), nullable=False, server_default="en"))

    # admins sign in with an email address
    op.add_column("admins", sa.Column("email", sa.String(255), nullable=True))
    op.create_index("ix_admins_email", "admins", ["email"], unique=True)

    # conferences: cover, end time, map pin, reminder bookkeeping
    op.add_column("conferences", sa.Column("end_time", sa.Time, nullable=True))
    op.add_column("conferences", sa.Column("venue_lat", sa.Float, nullable=True))
    op.add_column("conferences", sa.Column("venue_lng", sa.Float, nullable=True))
    op.add_column("conferences", sa.Column("cover_image", sa.String(255), nullable=True))
    op.add_column("conferences", sa.Column("reminders_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_conferences_date", "conferences", ["date"])

    # attendees: waitlist status, ticket code for QR check-in, reminder flag
    op.add_column("attendees", sa.Column("status", sa.String(20), nullable=False, server_default="registered"))
    op.add_column("attendees", sa.Column("ticket_code", sa.String(16), nullable=True))
    op.add_column("attendees", sa.Column("lang", sa.String(5), nullable=False, server_default="en"))
    op.add_column("attendees", sa.Column("checked_in_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("attendees", sa.Column("reminder_sent_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_attendees_status", "attendees", ["status"])

    conn = op.get_bind()
    ids = [r[0] for r in conn.execute(sa.text("SELECT id FROM attendees WHERE ticket_code IS NULL"))]
    for attendee_id in ids:
        code = "".join(secrets.choice(_ALPHABET) for _ in range(10))
        conn.execute(sa.text("UPDATE attendees SET ticket_code = :c WHERE id = :i"), {"c": code, "i": attendee_id})
    op.create_index("ix_attendees_ticket_code", "attendees", ["ticket_code"], unique=True)

    op.create_table(
        "speakers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conference_id", sa.Integer, sa.ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("job_title", sa.String(160), nullable=True),
        sa.Column("organization", sa.String(160), nullable=True),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("photo", sa.String(255), nullable=True),
        sa.Column("position", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_speakers_conference_id", "speakers", ["conference_id"])

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conference_id", sa.Integer, sa.ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("speaker_id", sa.Integer, sa.ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("start_time", sa.Time, nullable=False),
        sa.Column("end_time", sa.Time, nullable=True),
        sa.Column("room", sa.String(120), nullable=True),
        sa.Column("kind", sa.String(20), nullable=False, server_default="talk"),
    )
    op.create_index("ix_sessions_conference_id", "sessions", ["conference_id"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("recipient_type", sa.String(20), nullable=False),
        sa.Column("recipient_id", sa.Integer, nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("params", sa.JSON, nullable=True),
        sa.Column("link", sa.String(255), nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_notifications_recipient", "notifications", ["recipient_type", "recipient_id", "is_read"])

    op.create_table(
        "contact_messages",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("contact_messages")
    op.drop_index("ix_notifications_recipient", table_name="notifications")
    op.drop_table("notifications")
    op.drop_index("ix_sessions_conference_id", table_name="sessions")
    op.drop_table("sessions")
    op.drop_index("ix_speakers_conference_id", table_name="speakers")
    op.drop_table("speakers")
    op.drop_index("ix_attendees_ticket_code", table_name="attendees")
    op.drop_index("ix_attendees_status", table_name="attendees")
    for col in ("reminder_sent_at", "checked_in_at", "lang", "ticket_code", "status"):
        op.drop_column("attendees", col)
    op.drop_index("ix_conferences_date", table_name="conferences")
    for col in ("reminders_sent_at", "cover_image", "venue_lng", "venue_lat", "end_time"):
        op.drop_column("conferences", col)
    op.drop_index("ix_admins_email", table_name="admins")
    op.drop_column("admins", "email")
    for col in ("lang", "avatar", "bio", "organization"):
        op.drop_column("organizers", col)
