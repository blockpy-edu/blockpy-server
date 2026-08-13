"""Add lapis_feedback

Feedback authored and released from LAPIS (the learning-analytics
pilot); see controllers/endpoints/lapis.py and the LAPIS repo's
docs/BLOCKPY_CHANGES.md.

Revision ID: a1b2c3d4e5f6
Revises: 981662a4cab3
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '981662a4cab3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'lapis_feedback',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('date_created', sa.DateTime(), nullable=True),
        sa.Column('date_modified', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('analysis_window', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('source', sa.String(length=255), nullable=False),
        sa.Column('lapis_draft_id', sa.Integer(), nullable=True),
        sa.Column('date_released', sa.DateTime(), nullable=True),
        sa.Column('date_first_viewed', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['user.id']),
        sa.ForeignKeyConstraint(['course_id'], ['course.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('lapis_draft_id'),
    )
    op.create_index('lapis_feedback_user_index', 'lapis_feedback', ['user_id'])
    op.create_index('lapis_feedback_course_index', 'lapis_feedback', ['course_id'])


def downgrade():
    op.drop_index('lapis_feedback_course_index', table_name='lapis_feedback')
    op.drop_index('lapis_feedback_user_index', table_name='lapis_feedback')
    op.drop_table('lapis_feedback')
