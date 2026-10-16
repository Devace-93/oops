"""Initial schema: the whole oops data model.

Idempotent on purpose: `python -m dbcore.cli upgrade` runs `create_all` first,
so every table/index is skipped when it already exists (fresh installs) and
created otherwise (databases that only ever ran Alembic).

Revision ID: 0001
Revises:
Create Date: 2026-10-16 12:00:00
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector():
    return sa.inspect(op.get_bind())


def _create_table(name: str, *args, **kwargs) -> None:
    if not _inspector().has_table(name):
        op.create_table(name, *args, **kwargs)


def _create_index(index_name: str, table_name: str, *args, **kwargs) -> None:
    existing = {ix["name"] for ix in _inspector().get_indexes(table_name)}
    existing |= {uc["name"] for uc in _inspector().get_unique_constraints(table_name)}
    if index_name not in existing:
        op.create_index(index_name, table_name, *args, **kwargs)


def upgrade() -> None:
    _create_table('accounts',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('plan', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    _create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    _create_table('webhook_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('provider', sa.String(length=40), nullable=False),
    sa.Column('event_id', sa.String(length=255), nullable=False),
    sa.Column('type', sa.String(length=60), nullable=True),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index(op.f('ix_webhook_events_event_id'), 'webhook_events', ['event_id'], unique=True)
    _create_table('api_keys',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('role', sa.String(length=20), server_default='editor', nullable=False),
    sa.Column('prefix', sa.String(length=24), nullable=False),
    sa.Column('key_hash', sa.String(length=128), nullable=False),
    sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index(op.f('ix_api_keys_account_id'), 'api_keys', ['account_id'], unique=False)
    _create_index(op.f('ix_api_keys_key_hash'), 'api_keys', ['key_hash'], unique=True)
    _create_index(op.f('ix_api_keys_prefix'), 'api_keys', ['prefix'], unique=False)
    _create_table('audit_events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('actor_type', sa.String(length=20), nullable=False),
    sa.Column('actor_id', sa.UUID(), nullable=True),
    sa.Column('actor_label', sa.String(length=120), nullable=True),
    sa.Column('action', sa.String(length=60), nullable=False),
    sa.Column('target_type', sa.String(length=40), nullable=True),
    sa.Column('target_id', sa.String(length=64), nullable=True),
    sa.Column('outcome', sa.String(length=20), server_default='ok', nullable=False),
    sa.Column('meta', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index('ix_audit_events_account_ts', 'audit_events', ['account_id', 'ts'], unique=False)
    _create_table('memberships',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('account_id', 'user_id', name='uq_membership')
    )
    _create_table('projects',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('key', sa.String(length=63), nullable=False),
    sa.Column('name', sa.String(length=120), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('url', sa.String(length=2048), nullable=True),
    sa.Column('public_key', sa.String(length=64), nullable=False),
    sa.Column('public_key_hash', sa.String(length=128), nullable=False),
    sa.Column('public_key_prefix', sa.String(length=24), nullable=False),
    sa.Column('timezone', sa.String(length=64), server_default='UTC', nullable=False),
    sa.Column('allowed_origins', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('ingest_enabled', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('store_ip', sa.Boolean(), server_default='false', nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('account_id', 'key', name='uq_project_account_key')
    )
    _create_index('ix_projects_account_created', 'projects', ['account_id', 'created_at'], unique=False)
    _create_index(op.f('ix_projects_public_key_hash'), 'projects', ['public_key_hash'], unique=True)
    _create_table('refresh_tokens',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=128), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index(op.f('ix_refresh_tokens_token_hash'), 'refresh_tokens', ['token_hash'], unique=True)
    _create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    _create_table('subscriptions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('rc_app_user_id', sa.String(length=255), nullable=True),
    sa.Column('entitlement', sa.String(length=20), nullable=True),
    sa.Column('product_id', sa.String(length=120), nullable=True),
    sa.Column('period', sa.String(length=12), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=True),
    sa.Column('current_period_start', sa.DateTime(timezone=True), nullable=True),
    sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
    sa.Column('will_renew', sa.Boolean(), nullable=False),
    sa.Column('raw_payload', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index(op.f('ix_subscriptions_account_id'), 'subscriptions', ['account_id'], unique=True)
    _create_index(op.f('ix_subscriptions_rc_app_user_id'), 'subscriptions', ['rc_app_user_id'], unique=False)
    _create_table('usage_counters',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('account_id', sa.UUID(), nullable=False),
    sa.Column('period_start', sa.Date(), nullable=False),
    sa.Column('period_end', sa.Date(), nullable=False),
    sa.Column('events', sa.Integer(), server_default='0', nullable=False),
    sa.Column('events_limit_notified', sa.Boolean(), server_default='false', nullable=False),
    sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('account_id', 'period_start', name='uq_usage_period')
    )
    _create_index(op.f('ix_usage_counters_account_id'), 'usage_counters', ['account_id'], unique=False)
    _create_table('issues',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('project_id', sa.UUID(), nullable=False),
    sa.Column('number', sa.Integer(), nullable=False),
    sa.Column('fingerprint', sa.String(length=64), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=False),
    sa.Column('culprit', sa.String(length=500), nullable=True),
    sa.Column('type', sa.String(length=200), nullable=True),
    sa.Column('level', sa.String(length=10), server_default='error', nullable=False),
    sa.Column('status', sa.String(length=10), server_default='open', nullable=False),
    sa.Column('first_seen', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen', sa.DateTime(timezone=True), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('regressed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('event_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('user_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('environments', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('releases', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('latest_event_id', sa.BigInteger(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('project_id', 'fingerprint', name='uq_issue_fingerprint'),
    sa.UniqueConstraint('project_id', 'number', name='uq_issue_number')
    )
    _create_index('ix_issues_project_status_last_seen', 'issues', ['project_id', 'status', 'last_seen'], unique=False)
    _create_index('ix_issues_project_last_seen', 'issues', ['project_id', 'last_seen'], unique=False)
    _create_table('issue_users',
    sa.Column('issue_id', sa.UUID(), nullable=False),
    sa.Column('user_hash', sa.String(length=64), nullable=False),
    sa.Column('first_seen', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['issue_id'], ['issues.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('issue_id', 'user_hash')
    )
    _create_table('events',
    sa.Column('id', sa.BigInteger(), sa.Identity(always=False), nullable=False),
    sa.Column('project_id', sa.UUID(), nullable=False),
    sa.Column('issue_id', sa.UUID(), nullable=False),
    sa.Column('ts', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('level', sa.String(length=10), server_default='error', nullable=False),
    sa.Column('type', sa.String(length=200), nullable=True),
    sa.Column('message', sa.Text(), server_default='', nullable=False),
    sa.Column('frames', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('stack_raw', sa.Text(), nullable=True),
    sa.Column('url', sa.String(length=2048), nullable=True),
    sa.Column('path', sa.String(length=2048), nullable=True),
    sa.Column('hostname', sa.String(length=255), nullable=True),
    sa.Column('release', sa.String(length=100), nullable=True),
    sa.Column('environment', sa.String(length=40), server_default='production', nullable=False),
    sa.Column('platform', sa.String(length=30), nullable=True),
    sa.Column('sdk', sa.String(length=60), nullable=True),
    sa.Column('user', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('user_hash', sa.String(length=64), nullable=False),
    sa.Column('browser', sa.String(length=40), nullable=True),
    sa.Column('os', sa.String(length=40), nullable=True),
    sa.Column('device', sa.String(length=10), nullable=True),
    sa.Column('ip', sa.String(length=45), nullable=True),
    sa.Column('ip_hash', sa.String(length=64), nullable=True),
    sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('extra', postgresql.JSONB(astext_type=sa.Text()), server_default='{}', nullable=False),
    sa.Column('breadcrumbs', postgresql.JSONB(astext_type=sa.Text()), server_default='[]', nullable=False),
    sa.Column('source', sa.String(length=10), server_default='api', nullable=False),
    sa.ForeignKeyConstraint(['issue_id'], ['issues.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    _create_index('ix_events_project_ts', 'events', ['project_id', 'ts'], unique=False)
    _create_index('ix_events_issue_ts', 'events', ['issue_id', 'ts'], unique=False)
    _create_index('ix_events_project_level_ts', 'events', ['project_id', 'level', 'ts'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_events_project_level_ts', table_name='events')
    op.drop_index('ix_events_issue_ts', table_name='events')
    op.drop_index('ix_events_project_ts', table_name='events')
    op.drop_table('events')
    op.drop_table('issue_users')
    op.drop_index('ix_issues_project_last_seen', table_name='issues')
    op.drop_index('ix_issues_project_status_last_seen', table_name='issues')
    op.drop_table('issues')
    op.drop_index(op.f('ix_usage_counters_account_id'), table_name='usage_counters')
    op.drop_table('usage_counters')
    op.drop_index(op.f('ix_subscriptions_rc_app_user_id'), table_name='subscriptions')
    op.drop_index(op.f('ix_subscriptions_account_id'), table_name='subscriptions')
    op.drop_table('subscriptions')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_index(op.f('ix_refresh_tokens_token_hash'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_index(op.f('ix_projects_public_key_hash'), table_name='projects')
    op.drop_index('ix_projects_account_created', table_name='projects')
    op.drop_table('projects')
    op.drop_table('memberships')
    op.drop_index('ix_audit_events_account_ts', table_name='audit_events')
    op.drop_table('audit_events')
    op.drop_index(op.f('ix_api_keys_prefix'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_key_hash'), table_name='api_keys')
    op.drop_index(op.f('ix_api_keys_account_id'), table_name='api_keys')
    op.drop_table('api_keys')
    op.drop_index(op.f('ix_webhook_events_event_id'), table_name='webhook_events')
    op.drop_table('webhook_events')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
    op.drop_table('accounts')
