"""add_post_and_comment_tables

Revision ID: a1b2c3d4e5f6
Revises: f6ee6f9df554
Create Date: 2026-02-12 15:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'f6ee6f9df554'
branch_labels = None
depends_on = None


def upgrade():
    # Create post table
    op.create_table('post',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('date_created', sa.DateTime(), nullable=True),
        sa.Column('date_modified', sa.DateTime(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('content_format', sa.String(length=50), nullable=False, server_default='markdown'),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('is_answered', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('status', sa.Enum('open', 'answered', 'closed', name='poststatus'), nullable=False, server_default='open'),
        sa.Column('course_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.Column('assignment_id', sa.Integer(), nullable=True),
        sa.Column('assignment_group_id', sa.Integer(), nullable=True),
        sa.Column('submission_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignment.id'], ),
        sa.ForeignKeyConstraint(['assignment_group_id'], ['assignment_group.id'], ),
        sa.ForeignKeyConstraint(['author_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['course_id'], ['course.id'], ),
        sa.ForeignKeyConstraint(['submission_id'], ['submission.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for post table
    op.create_index('post_course_index', 'post', ['course_id'])
    op.create_index('post_author_index', 'post', ['author_id'])
    op.create_index('post_assignment_index', 'post', ['assignment_id'])
    op.create_index('post_status_index', 'post', ['status'])
    
    # Create comment table
    op.create_table('comment',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('date_created', sa.DateTime(), nullable=True),
        sa.Column('date_modified', sa.DateTime(), nullable=True),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('content_format', sa.String(length=50), nullable=False, server_default='markdown'),
        sa.Column('post_id', sa.Integer(), nullable=False),
        sa.Column('author_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['author_id'], ['user.id'], ),
        sa.ForeignKeyConstraint(['post_id'], ['post.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for comment table
    op.create_index('comment_post_index', 'comment', ['post_id'])
    op.create_index('comment_author_index', 'comment', ['author_id'])


def downgrade():
    # Drop comment table and its indexes
    op.drop_index('comment_author_index', 'comment')
    op.drop_index('comment_post_index', 'comment')
    op.drop_table('comment')
    
    # Drop post table and its indexes
    op.drop_index('post_status_index', 'post')
    op.drop_index('post_assignment_index', 'post')
    op.drop_index('post_author_index', 'post')
    op.drop_index('post_course_index', 'post')
    op.drop_table('post')
    
    # Drop enum type (PostgreSQL specific)
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS poststatus")
