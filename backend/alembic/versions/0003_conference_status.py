"""conference status

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "conferences",
        sa.Column("status", sa.String(20), nullable=False, server_default="published"),
    )


def downgrade() -> None:
    op.drop_column("conferences", "status")
