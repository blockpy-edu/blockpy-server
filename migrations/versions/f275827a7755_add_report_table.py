"""add_report_table

Revision ID: f275827a7755
Revises: f206cb1bdb5d
Create Date: 2023-01-25 16:36:58.110220

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f275827a7755'
down_revision = 'f206cb1bdb5d'
branch_labels = None
depends_on = None


def upgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('report',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('date_created', sa.DateTime(), nullable=True),
    sa.Column('date_modified', sa.DateTime(), nullable=True),
    sa.Column('status', sa.String(length=255), nullable=True),
    sa.Column('attempt', sa.Integer(), nullable=True),
    sa.Column('result', sa.String(length=255), nullable=True),
    sa.Column('date_started', sa.DateTime(), nullable=True),
    sa.Column('date_finished', sa.DateTime(), nullable=True),
    sa.Column('progress', sa.Integer(), nullable=True),
    sa.Column('message', sa.String(), nullable=True),
    sa.Column('task', sa.String(), nullable=True),
    sa.Column('parameters', sa.Text(), nullable=True),
    sa.Column('visibility', sa.String(), nullable=True),
    sa.Column('owner_id', sa.Integer(), nullable=True),
    sa.Column('assignment_id', sa.Integer(), nullable=True),
    sa.Column('course_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['assignment_id'], ['assignment.id'], ),
    sa.ForeignKeyConstraint(['course_id'], ['course.id'], ),
    sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade():
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_table('report')
    # ### end Alembic commands ###