"""align the schema with the models: foreign-key indexes, NOT NULL timestamps, no duplicate id indexes

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-17
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# The primary key already has an index; these copies from 0001 only slow down writes.
_ID_INDEXES = ["activity_logs", "admins", "attendees", "conferences", "feedback", "organizers"]


def upgrade() -> None:
    conn = op.get_bind()
    existing = {r[0] for r in conn.execute(sa.text("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()"))} \
        if conn.dialect.name == "postgresql" else set()
    for table in _ID_INDEXES:
        if f"ix_{table}_id" in existing:
            op.drop_index(f"ix_{table}_id", table_name=table)

    # Lookups by owner / conference are on every list page.
    op.create_index("ix_attendees_conference_id", "attendees", ["conference_id"])
    op.create_index("ix_conferences_organizer_id", "conferences", ["organizer_id"])
    op.create_index("ix_feedback_organizer_id", "feedback", ["organizer_id"])

    conn.execute(sa.text("UPDATE notifications SET params = '{}' WHERE params IS NULL"))
    op.alter_column("notifications", "params", existing_type=sa.JSON(), nullable=False)
    op.alter_column("notifications", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False)
    op.alter_column("contact_messages", "created_at", existing_type=sa.DateTime(timezone=True), nullable=False)


def downgrade() -> None:
    op.alter_column("contact_messages", "created_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.alter_column("notifications", "created_at", existing_type=sa.DateTime(timezone=True), nullable=True)
    op.alter_column("notifications", "params", existing_type=sa.JSON(), nullable=True)
    op.drop_index("ix_feedback_organizer_id", table_name="feedback")
    op.drop_index("ix_conferences_organizer_id", table_name="conferences")
    op.drop_index("ix_attendees_conference_id", table_name="attendees")
    for table in _ID_INDEXES:
        op.create_index(f"ix_{table}_id", table, ["id"])
