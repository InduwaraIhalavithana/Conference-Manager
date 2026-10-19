"""email verification: organizers verify their address before signing in, attendees confirm registrations

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("organizers", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("organizers", sa.Column("verify_token", sa.String(64), nullable=True))
    op.add_column("organizers", sa.Column("verify_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint("uq_organizers_verify_token", "organizers", ["verify_token"])
    op.add_column("attendees", sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("attendees", sa.Column("confirm_token", sa.String(64), nullable=True))
    op.create_unique_constraint("uq_attendees_confirm_token", "attendees", ["confirm_token"])
    # Everyone who signed up or registered before verification existed counts as verified.
    op.execute("UPDATE organizers SET email_verified_at = created_at WHERE email_verified_at IS NULL")
    op.execute("UPDATE attendees SET confirmed_at = registered_at WHERE confirmed_at IS NULL")


def downgrade() -> None:
    op.drop_constraint("uq_attendees_confirm_token", "attendees", type_="unique")
    op.drop_column("attendees", "confirm_token")
    op.drop_column("attendees", "confirmed_at")
    op.drop_constraint("uq_organizers_verify_token", "organizers", type_="unique")
    op.drop_column("organizers", "verify_expires_at")
    op.drop_column("organizers", "verify_token")
    op.drop_column("organizers", "email_verified_at")
