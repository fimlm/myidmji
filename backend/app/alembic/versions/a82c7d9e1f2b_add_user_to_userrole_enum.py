"""Add user role to UserRole enum

Revision ID: a82c7d9e1f2b
Revises: fcf040f55e24
Create Date: 2026-01-10 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a82c7d9e1f2b'
down_revision = 'fcf040f55e24'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'USER' value to the existing 'userrole' type
    # For Postgres, we need to use ALTER TYPE
    op.execute("ALTER TYPE userrole ADD VALUE 'USER'")


def downgrade():
    # Removing a value from an ENUM is complex in Postgres (usually requires recreated type)
    # For now, we leave it as is or do nothing as it's a non-destructive additive change
    pass
