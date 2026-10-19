"""email codes: verify with a 6-digit code instead of a link (attempt counter and resend time)

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Outstanding links stop working; people ask for a code instead.
    op.drop_constraint("uq_organizers_verify_token", "organizers", type_="unique")
    op.alter_column("organizers", "verify_token", new_column_name="verify_code")
    op.execute("UPDATE organizers SET verify_code = NULL, verify_expires_at = NULL")
    op.add_column("organizers", sa.Column("verify_attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("organizers", sa.Column("verify_sent_at", sa.DateTime(timezone=True), nullable=True))

    op.drop_constraint("uq_attendees_confirm_token", "attendees", type_="unique")
    op.alter_column("attendees", "confirm_token", new_column_name="confirm_code")
    op.execute("UPDATE attendees SET confirm_code = NULL")
    op.add_column("attendees", sa.Column("confirm_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("attendees", sa.Column("confirm_attempts", sa.Integer(), server_default="0", nullable=False))
    op.add_column("attendees", sa.Column("confirm_sent_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("attendees", "confirm_sent_at")
    op.drop_column("attendees", "confirm_attempts")
    op.drop_column("attendees", "confirm_expires_at")
    op.execute("UPDATE attendees SET confirm_code = NULL")
    op.alter_column("attendees", "confirm_code", new_column_name="confirm_token")
    op.create_unique_constraint("uq_attendees_confirm_token", "attendees", ["confirm_token"])

    op.drop_column("organizers", "verify_sent_at")
    op.drop_column("organizers", "verify_attempts")
    op.execute("UPDATE organizers SET verify_code = NULL, verify_expires_at = NULL")
    op.alter_column("organizers", "verify_code", new_column_name="verify_token")
    op.create_unique_constraint("uq_organizers_verify_token", "organizers", ["verify_token"])
