"""SQLAlchemy models — the canonical data model for oops.

Tenancy: an Account is the billing entity. Users join accounts via Memberships.
Product hierarchy: Account -> Project -> Event. Deleting a project cascades
its events (Postgres ``ON DELETE CASCADE``), so the API never has to clean up
by hand.

Secrets (API keys, refresh tokens) are stored as sha256 hashes plus a short
non-sensitive prefix; the plaintext is shown once. A project's *public key*
(``oops_pub_…``) is not a secret — it ships inside the tracker snippet — so
it is stored in plaintext as well (``Project.public_key``) and the owner can
read it back at any time; the hash column is what collect requests are
matched on.

Events are stored raw (one row per page view or custom event) and aggregated
on the fly with indexed ``GROUP BY`` queries. That keeps the write path a
single INSERT and the schema trivial to self-host; roll-ups can come later if
a project outgrows it. Raw user agents are never stored, and raw IPs only
when a project opts in (``store_ip``): by default only the derived device /
browser / OS / geo fields and daily-salted hashes are kept.
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
# Product: projects and events
# --------------------------------------------------------------------------- #
class Project(Base):
    """One project per tracked site or app. Owns the public key the tracker
    posts hits with, and the tracking settings."""

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

    # Public (collect) key. Plaintext is kept because it is not a secret; the
    # hash is the lookup column for collect requests. Rotation replaces all three.
    public_key: Mapped[str] = mapped_column(String(64), nullable=False)
    public_key_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    public_key_prefix: Mapped[str] = mapped_column(String(24), nullable=False)

    # Tracking settings.
    # IANA time zone used to bucket days in the dashboard and the stats API.
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")
    # Hostnames allowed to send hits (empty = any). The key is public, so this
    # is the main defence against someone pointing a copied snippet elsewhere.
    allowed_origins: Mapped[list] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    # Pause tracking without touching the snippet.
    collect_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # Drop hits whose user agent looks like a crawler / headless browser.
    exclude_bots: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    # Keep the raw visitor IP on each event (off by default: privacy-friendly
    # mode stores only the daily hash + derived location).
    store_ip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    account: Mapped[Account] = relationship(back_populates="projects")
    events: Mapped[list["Event"]] = relationship(
        back_populates="project", cascade="all, delete-orphan", passive_deletes=True
    )


class Event(Base):
    """One page view or custom event. Append-only; pruned by retention.

    ``visitor_hash`` is the daily, per-project, cookie-less visitor id (see
    ``dbcore.privacy``). ``referrer_host`` is NULL for direct traffic and for
    internal navigation (same hostname as the page).
    """

    __tablename__ = "events"
    __table_args__ = (
        Index("ix_events_project_ts", "project_id", "ts"),
        Index("ix_events_project_kind_ts", "project_id", "kind", "ts"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=False), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="pageview", server_default="pageview")
    name: Mapped[str | None] = mapped_column(String(60))             # custom event name (kind=event)
    hostname: Mapped[str | None] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(2048), nullable=False, default="/", server_default="/")
    title: Mapped[str | None] = mapped_column(String(200))
    referrer: Mapped[str | None] = mapped_column(String(2048))      # scheme://host/path, no query
    referrer_host: Mapped[str | None] = mapped_column(String(255))
    utm_source: Mapped[str | None] = mapped_column(String(100))
    utm_medium: Mapped[str | None] = mapped_column(String(100))
    utm_campaign: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(2))          # ISO 3166-1 alpha-2
    region: Mapped[str | None] = mapped_column(String(100))
    city: Mapped[str | None] = mapped_column(String(100))
    device: Mapped[str | None] = mapped_column(String(10))          # desktop | mobile | tablet | bot
    browser: Mapped[str | None] = mapped_column(String(40))
    os: Mapped[str | None] = mapped_column(String(40))
    screen_w: Mapped[int | None] = mapped_column(Integer)
    screen_h: Mapped[int | None] = mapped_column(Integer)
    lang: Mapped[str | None] = mapped_column(String(16))
    visitor_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(64))
    # Raw address, only when the project has store_ip on.
    ip: Mapped[str | None] = mapped_column(String(45))
    source: Mapped[str] = mapped_column(String(10), nullable=False, default="script", server_default="script")
    props: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")

    project: Mapped[Project] = relationship(back_populates="events")


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
    # Hits received this period (page views + custom events), including the
    # ones dropped past the plan budget, so the overage is visible.
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
