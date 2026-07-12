"""Add question variations support in assignment groups

Adds:
  * assignment_group.variation_count  – how many variation assignments a student completes
  * assignment_group_membership.variation_group – pool tag (NULL = required, int = variation pool)
  * assignment_group_variation table – per-student variation assignment records

Revision ID: b1c2d3e4f5a6
Revises: a62e70d564b3
Create Date: 2025-09-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = 'a62e70d564b3'
branch_labels = None
depends_on = None


def upgrade():
    # Add variation_count to assignment_group (default 0 = all assignments required)
    op.add_column('assignment_group',
                  sa.Column('variation_count', sa.Integer(), nullable=False, server_default='0'))

    # Add variation_group to assignment_group_membership (NULL = required for all)
    op.add_column('assignment_group_membership',
                  sa.Column('variation_group', sa.Integer(), nullable=True))

    # Create the assignment_group_variation table
    op.create_table(
        'assignment_group_variation',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('date_created', sa.DateTime(), nullable=True),
        sa.Column('date_modified', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user.id'), nullable=False),
        sa.Column('assignment_group_id', sa.Integer(), sa.ForeignKey('assignment_group.id'), nullable=False),
        sa.Column('assignment_id', sa.Integer(), sa.ForeignKey('assignment.id'), nullable=False),
    )
    op.create_unique_constraint(
        'uq_agv_user_group_assignment',
        'assignment_group_variation',
        ['user_id', 'assignment_group_id', 'assignment_id'],
    )
    op.create_index('agv_user_group_index', 'assignment_group_variation',
                    ['user_id', 'assignment_group_id'])
    op.create_index('agv_group_index', 'assignment_group_variation',
                    ['assignment_group_id'])


def downgrade():
    op.drop_index('agv_group_index', 'assignment_group_variation')
    op.drop_index('agv_user_group_index', 'assignment_group_variation')
    op.drop_constraint('uq_agv_user_group_assignment', 'assignment_group_variation',
                       type_='unique')
    op.drop_table('assignment_group_variation')
    op.drop_column('assignment_group_membership', 'variation_group')
    op.drop_column('assignment_group', 'variation_count')
