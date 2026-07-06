"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-07-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "organizers",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("phone", sa.String(30), nullable=True),
        sa.Column("is_suspended", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "admins",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("password_hash", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "conferences",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("organizer_id", sa.Integer, sa.ForeignKey("organizers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("time", sa.Time, nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "attendees",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("conference_id", sa.Integer, sa.ForeignKey("conferences.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("conference_id", "email", name="uq_attendee_conf_email"),
    )

    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("organizer_id", sa.Integer, sa.ForeignKey("organizers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "feedback",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("organizer_id", sa.Integer, sa.ForeignKey("organizers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("reply", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("feedback")
    op.drop_table("activity_logs")
    op.drop_table("attendees")
    op.drop_table("conferences")
    op.drop_table("admins")
    op.drop_table("organizers")
