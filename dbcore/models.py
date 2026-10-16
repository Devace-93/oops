"""SQLAlchemy models — the canonical data model for oops.

Tenancy: an Account is the billing entity. Users join accounts via Memberships.
Product hierarchy: Account -> Project -> Issue -> Event. Deleting a project
cascades its issues and events (Postgres ``ON DELETE CASCADE``), so the API
never has to clean up by hand.

Secrets (API keys, refresh tokens) are stored as sha256 hashes plus a short
non-sensitive prefix; the plaintext is shown once. A project's *public key*
(``oops_pub_…``) is not a secret — it ships inside the SDK snippet — so it is
stored in plaintext as well (``Project.public_key``) and the owner can read it
back at any time; the hash column is what ingest requests are matched on.

Events are stored raw (one row per error occurrence). Issues are the grouping
by ``fingerprint`` with denormalised counters (``event_count``,
``user_count``, ``first_seen`` / ``last_seen``) maintained on ingest inside the
same transaction as the event insert; ``issue_users`` backs ``user_count`` so
it stays exact without a ``COUNT(DISTINCT)`` per event. Raw user agents are
never stored, and raw IPs only when a project opts in (``store_ip``): by
default only the derived browser / OS / device fields and hashes are kept.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

ISSUE_STATUSES = ("open", "resolved", "ignored")
LEVELS = ("fatal", "error", "warning", "info")
SOURCES = ("sdk", "api")


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


def _pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)


# --------------------------------------------------------------------------- #
# Tenancy / auth
# --------------------------------------------------------------------------- #
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = _pk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # current effective plan: free | pro | team | enterprise | selfhost
    plan: Mapped[str] = mapped_column(String(20), nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["Membership"]] = relationship(back_populates="account")
    projects: Mapped[list["Project"]] = relationship(back_populates="account")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = _pk()
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("account_id", "user_id", name="uq_membership"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="owner")  # owner|admin|member
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    account: Mapped[Account] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = _pk()
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), unique=True, index=True
    )
    rc_app_user_id: Mapped[str | None] = mapped_column(String(255), index=True)
    entitlement: Mapped[str | None] = mapped_column(String(20))   # pro | team
    product_id: Mapped[str | None] = mapped_column(String(120))
    period: Mapped[str | None] = mapped_column(String(12))        # monthly | annual
    status: Mapped[str | None] = mapped_column(String(30))        # active | expired | ...
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    will_renew: Mapped[bool] = mapped_column(Boolean, default=True)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# --------------------------------------------------------------------------- #
# Product: projects, issues and events
# --------------------------------------------------------------------------- #
class Project(Base):
    """One project per app, site or service. Owns the public key the SDK and
    server-side reporters post events with, and the ingest settings."""

    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("account_id", "key", name="uq_project_account_key"),
        Index("ix_projects_account_created", "account_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    key: Mapped[str] = mapped_column(String(63), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))

    # Public (ingest) key. Plaintext is kept because it is not a secret; the
    # hash is the lookup column for ingest requests. Rotation replaces all three.
    public_key: Mapped[str] = mapped_column(String(64), nullable=False)
    public_key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    public_key_prefix: Mapped[str] = mapped_column(String(24), nullable=False)

    # Ingest settings.
    # IANA time zone used to bucket days in the dashboard and the stats API.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")
    # Hostnames allowed to report events (empty = any). The key is public, so
    # this is the main defence against someone pointing a copied snippet elsewhere.
    allowed_origins: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    # Pause ingestion without touching the snippet.
    ingest_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # Keep the raw client IP on each event (off by default: privacy-friendly
    # mode stores only the daily hash).
    store_ip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped[Account] = relationship(back_populates="projects")
    issues: Mapped[list["Issue"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )
    events: Mapped[list["Event"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )


class Issue(Base):
    """The group every event lands in, keyed by ``fingerprint`` (unique per
    project). ``number`` is the per-project human id (``#12``). Counters and
    ``environments`` / ``releases`` are denormalised on ingest; ``releases``
    keeps the last 10 seen, newest last."""

    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("project_id", "fingerprint", name="uq_issue_fingerprint"),
        UniqueConstraint("project_id", "number", name="uq_issue_number"),
        Index("ix_issues_project_status_last_seen", "project_id", "status", "last_seen"),
        Index("ix_issues_project_last_seen", "project_id", "last_seen"),
    )

    id: Mapped[uuid.UUID] = _pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    culprit: Mapped[str | None] = mapped_column(String(500))
    type: Mapped[str | None] = mapped_column(String(200))
    level: Mapped[str] = mapped_column(String(10), nullable=False, default="error", server_default="error")
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="open", server_default="open")
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    regressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    user_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    environments: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    releases: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    # Plain bigint on purpose (no FK): events and issues point at each other
    # and a circular FK would complicate create_all and purges. Retention
    # recomputes it.
    latest_event_id: Mapped[int | None] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped[Project] = relationship(back_populates="issues")
    events: Mapped[list["Event"]] = relationship(
        back_populates="issue", cascade="all, delete-orphan", passive_deletes=True
    )


class IssueUser(Base):
    """Distinct affected users per issue. ``INSERT … ON CONFLICT DO NOTHING``
    on ingest tells us whether the user is new to the issue, which drives
    ``Issue.user_count`` without a ``COUNT(DISTINCT)``."""

    __tablename__ = "issue_users"

    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), primary_key=True
    )
    user_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Event(Base):
    """One error occurrence (or captured message). Append-only; pruned by
    retention.

    ``user_hash`` is the project-scoped hash of the client's ``user.id`` when
    sent, otherwise the daily cookie-less hash of (IP, user agent) — see
    ``dbcore.privacy``. ``frames`` are ordered top of the stack first.
    """

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_project_ts", "project_id", "ts"),
        Index("ix_events_issue_ts", "issue_id", "ts"),
        Index("ix_events_project_level_ts", "project_id", "level", "ts"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=False), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    issue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("issues.id", ondelete="CASCADE"), nullable=False
    )
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    level: Mapped[str] = mapped_column(String(10), nullable=False, default="error", server_default="error")
    type: Mapped[str | None] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    frames: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    stack_raw: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str | None] = mapped_column(String(2048))              # scheme://host/path, no query
    path: Mapped[str | None] = mapped_column(String(2048))
    hostname: Mapped[str | None] = mapped_column(String(255))
    release: Mapped[str | None] = mapped_column(String(100))
    environment: Mapped[str] = mapped_column(
        String(40), nullable=False, default="production", server_default="production"
    )
    platform: Mapped[str | None] = mapped_column(String(30))
    sdk: Mapped[str | None] = mapped_column(String(60))
    # The client's own user object ({id, email, name}), stored as sent (scrubbed).
    user: Mapped[dict | None] = mapped_column("user", JSONB)
    user_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    browser: Mapped[str | None] = mapped_column(String(40))
    os: Mapped[str | None] = mapped_column(String(40))
    device: Mapped[str | None] = mapped_column(String(10))            # desktop | mobile | tablet
    # Raw address, only when the project has store_ip on.
    ip: Mapped[str | None] = mapped_column(String(45))
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    tags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    breadcrumbs: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="api", server_default="api")

    project: Mapped[Project] = relationship(back_populates="events")
    # Joined on purpose: the Event wire shape carries ``issue_number``.
    issue: Mapped[Issue] = relationship(back_populates="events", lazy="joined")


# --------------------------------------------------------------------------- #
# Metering, keys, billing, audit
# --------------------------------------------------------------------------- #
class UsageCounter(Base):
    __tablename__ = "usage_counters"
    __table_args__ = (UniqueConstraint("account_id", "period_start", name="uq_usage_period"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    # Events received this period by the ingest API, including the ones
    # dropped past the plan budget, so the overage is visible.
    events: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # set once when the events limit is first hit in a period (for one-shot PostHog event)
    events_limit_notified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    # RBAC role: viewer | editor | admin (see packages/shared/api_key_roles.json).
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="editor", server_default="editor")
    prefix: Mapped[str] = mapped_column(String(24), index=True)        # shown in UI, e.g. oops_live_AbCd
    key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id: Mapped[uuid.UUID] = _pk()
    provider: Mapped[str] = mapped_column(String(40), default="revenuecat")
    event_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    type: Mapped[str | None] = mapped_column(String(60))
    payload: Mapped[dict | None] = mapped_column(JSONB)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditEvent(Base):
    """Append-only audit trail (see dbcore/audit.py). Never updated or deleted
    by application code; retention is an ops concern."""

    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_account_ts", "account_id", "ts"),)

    id: Mapped[uuid.UUID] = _pk()
    account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)     # user | api_key | system
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))  # user id or api key id
    actor_label: Mapped[str | None] = mapped_column(String(120))            # e.g. key prefix
    action: Mapped[str] = mapped_column(String(60), nullable=False)         # project.update, auth.denied, ...
    target_type: Mapped[str | None] = mapped_column(String(40))
    target_id: Mapped[str | None] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(20), nullable=False, default="ok", server_default="ok")  # ok | denied | error
    meta: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
