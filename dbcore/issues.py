"""Issue upsert: the write path of the ingest API.

``record_event`` stores one normalised event and updates (or creates) its
issue in the **same transaction** (CONTRACT.md):

* new fingerprint → new issue (``status=open``, ``number`` = project's next);
* existing → bump ``event_count`` and ``last_seen``, merge ``environment`` /
  ``release`` into the issue's lists (last 10 releases kept), count the user
  through ``issue_users`` (``INSERT … ON CONFLICT DO NOTHING``: a new row means
  a new affected user);
* ``resolved`` → reopened with ``regressed_at``; ``ignored`` stays ignored.

Concurrency: the issue row is read ``FOR UPDATE`` so two events for the same
issue serialise on it (the counters are plain increments on a locked row). A
new fingerprint locks the *project* row before computing the next ``number``
and re-checks the fingerprint under that lock, so two concurrent first
occurrences cannot create two issues or reuse a number; the unique
constraints are the last line of defence.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .grouping import compute_fingerprint, issue_culprit, issue_title
from .ingest import NormalizedEvent, parse_user_agent
from .models import Event, Issue, IssueUser, Project
from .privacy import ip_hash, user_hash, visitor_hash

MAX_ISSUE_ENVIRONMENTS = 20
MAX_ISSUE_RELEASES = 10


def _lock_issue(session: Session, project_id, fingerprint: str) -> Issue | None:
    return session.scalar(
        select(Issue)
        .where(Issue.project_id == project_id, Issue.fingerprint == fingerprint)
        .with_for_update()
    )


def _next_number(session: Session, project_id) -> int:
    current = session.scalar(
        select(func.coalesce(func.max(Issue.number), 0)).where(Issue.project_id == project_id)
    )
    return int(current or 0) + 1


def _create_issue(session: Session, project: Project, ev: NormalizedEvent, fingerprint: str, ts: datetime) -> Issue:
    """Insert the issue for a fingerprint nobody has seen yet, race-safe."""
    # Serialise first occurrences per project: the number must be unique and
    # gapless-ish, and a second worker racing on the same fingerprint must
    # see our row once we commit (it re-checks under the same lock).
    session.execute(select(Project.id).where(Project.id == project.id).with_for_update())
    existing = _lock_issue(session, project.id, fingerprint)
    if existing is not None:
        return existing
    issue = Issue(
        project_id=project.id,
        number=_next_number(session, project.id),
        fingerprint=fingerprint,
        title=issue_title(ev.type, ev.message),
        culprit=issue_culprit(ev.frames),
        type=ev.type,
        level=ev.level,
        status="open",
        first_seen=ts,
        last_seen=ts,
        event_count=0,
        user_count=0,
        environments=[],
        releases=[],
    )
    try:
        with session.begin_nested():
            session.add(issue)
            session.flush()
    except IntegrityError:
        # Lost a race we could not see (e.g. a project lock skipped by a
        # different code path): the winner's row is the issue now.
        session.expunge(issue)
        existing = _lock_issue(session, project.id, fingerprint)
        if existing is None:  # pragma: no cover - cannot happen after the conflict
            raise
        return existing
    return issue


def _merge_labels(issue: Issue, environment: str, release: str | None) -> None:
    environments = list(issue.environments or [])
    if environment and environment not in environments and len(environments) < MAX_ISSUE_ENVIRONMENTS:
        environments.append(environment)
        issue.environments = environments
    if release:
        releases = [r for r in (issue.releases or []) if r != release]
        releases.append(release)
        issue.releases = releases[-MAX_ISSUE_RELEASES:]


def record_event(
    session: Session,
    project: Project,
    ev: NormalizedEvent,
    *,
    ip: str | None,
    user_agent: str | None,
    now: datetime | None = None,
) -> tuple[Event, Issue, bool]:
    """Persist ``ev`` for ``project`` and upsert its issue. Returns
    ``(event, issue, created)`` where ``created`` says the issue is new.
    Must run inside the caller's transaction (the usage meter is the
    caller's job too)."""
    now = now or datetime.now(timezone.utc)
    ts = ev.ts or now
    fingerprint = compute_fingerprint(ev.type, ev.message, ev.frames, ev.fingerprint)

    created = False
    issue = _lock_issue(session, project.id, fingerprint)
    if issue is None:
        issue = _create_issue(session, project, ev, fingerprint, ts)
        created = issue.event_count == 0

    if ev.user and ev.user.get("id"):
        who = user_hash(project.id, str(ev.user["id"]))
    else:
        who = visitor_hash(project.id, ip, user_agent)
    ua_info = parse_user_agent(user_agent)

    event = Event(
        project_id=project.id,
        issue_id=issue.id,
        ts=ts,
        level=ev.level,
        type=ev.type,
        message=ev.message,
        frames=ev.frames,
        stack_raw=ev.stack_raw,
        url=ev.url,
        path=ev.path,
        hostname=ev.hostname,
        release=ev.release,
        environment=ev.environment,
        platform=ev.platform,
        sdk=ev.sdk,
        user=ev.user,
        user_hash=who,
        browser=ua_info["browser"],
        os=ua_info["os"],
        device=ua_info["device"],
        ip=((ip or "")[:45] or None) if project.store_ip else None,
        ip_hash=ip_hash(ip),
        tags=ev.tags,
        extra=ev.extra,
        breadcrumbs=ev.breadcrumbs,
        source=ev.source,
    )
    session.add(event)
    session.flush()

    # ---- counters (issue row is locked) -------------------------------------
    issue.event_count = int(issue.event_count or 0) + 1
    if issue.last_seen is None or ts >= issue.last_seen:
        issue.last_seen = ts
        issue.latest_event_id = event.id
        issue.level = ev.level
    if issue.first_seen is None or ts < issue.first_seen:
        issue.first_seen = ts
    _merge_labels(issue, ev.environment, ev.release)

    # RETURNING tells us whether this (issue, user) pair is new; the driver's
    # rowcount is not reliable for ON CONFLICT DO NOTHING through the ORM.
    inserted = session.execute(
        pg_insert(IssueUser)
        .values(issue_id=issue.id, user_hash=who, first_seen=ts)
        .on_conflict_do_nothing(index_elements=["issue_id", "user_hash"])
        .returning(IssueUser.user_hash)
    ).first()
    if inserted is not None:
        issue.user_count = int(issue.user_count or 0) + 1

    # ---- status: resolved reopens, ignored stays ----------------------------
    if issue.status == "resolved":
        issue.status = "open"
        issue.resolved_at = None
        issue.regressed_at = now

    session.flush()
    return event, issue, created
