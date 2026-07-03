"""initial schema

Revision ID: 44309c0dbbab
Revises: 
Create Date: 2026-07-03 10:36:18.123456

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '44309c0dbbab'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create projects table
    op.create_table('projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    )
    
    # Create documents table
    op.create_table('documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_name', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_type', sa.String(), nullable=True),
        sa.Column('raw_text', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )

    # Create results table
    op.create_table('results',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('structured_proposal', sa.JSON(), nullable=True),
        sa.Column('cost_breakdown', sa.JSON(), nullable=True),
        sa.Column('risk_flags', sa.JSON(), nullable=True),
        sa.Column('policy_rules', sa.JSON(), nullable=True),
        sa.Column('score_results', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    )

    # Add Row Level Security (RLS) policies
    for table in ['projects', 'documents', 'results']:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        # Allow users to select their own rows
        op.execute(f"""
            CREATE POLICY "select_{table}_user_policy" ON {table}
            FOR SELECT
            USING (auth.uid() = user_id);
        """)
        # Allow users to insert their own rows
        op.execute(f"""
            CREATE POLICY "insert_{table}_user_policy" ON {table}
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);
        """)
        # Allow users to update their own rows
        op.execute(f"""
            CREATE POLICY "update_{table}_user_policy" ON {table}
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
        """)
        # Allow users to delete their own rows
        op.execute(f"""
            CREATE POLICY "delete_{table}_user_policy" ON {table}
            FOR DELETE
            USING (auth.uid() = user_id);
        """)


def downgrade() -> None:
    # Drop RLS policies
    for table in ['results', 'documents', 'projects']:
        op.execute(f"DROP POLICY IF EXISTS \"delete_{table}_user_policy\" ON {table};")
        op.execute(f"DROP POLICY IF EXISTS \"update_{table}_user_policy\" ON {table};")
        op.execute(f"DROP POLICY IF EXISTS \"insert_{table}_user_policy\" ON {table};")
        op.execute(f"DROP POLICY IF EXISTS \"select_{table}_user_policy\" ON {table};")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
    
    op.drop_table('results')
    op.drop_table('documents')
    op.drop_table('projects')
