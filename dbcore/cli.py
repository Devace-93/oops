"""Tiny management CLI used by the `migrate` compose service (and cron).

    python -m dbcore.cli upgrade        # create_all + alembic upgrade head
    python -m dbcore.cli migrate        # alembic upgrade head only
    python -m dbcore.cli create-all     # SQLAlchemy create_all only
    python -m dbcore.cli prune-events   # retention: old events, orphan issues, counters

Schema lifecycle: ``create_all`` bootstraps a fresh database in one shot, then
Alembic (``db/migrations``) evolves it. Migrations are written idempotently so
the two can run back to back on both fresh and existing databases. With zero
migrations ``upgrade`` is just ``create_all`` plus an empty Alembic run.
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, exists, func, select, update

from . import models  # noqa: F401  (register models on Base.metadata)
from .db import Base, engine, session_scope


def create_all() -> None:
    Base.metadata.create_all(engine)
    print("✓ tables ensured")


def _db_dir() -> Path:
    """Locate db/ (alembic.ini + migrations) locally or inside the image."""
    for candidate in (Path(__file__).resolve().parents[1] / "db", Path("/app/db")):
        if (candidate / "alembic.ini").is_file():
            return candidate
    raise FileNotFoundError("db/alembic.ini not found")


def migrate() -> None:
    """``alembic upgrade head`` via the Python API (no CLI/cwd assumptions)."""
    from alembic import command
    from alembic.config import Config as AlembicConfig

    db_dir = _db_dir()
    cfg = AlembicConfig(str(db_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(db_dir / "migrations"))
    command.upgrade(cfg, "head")
    print("✓ migrations applied")


def _recompute_issues(session, issue_ids: list) -> None:
    """Refresh the denormalised counters of issues that lost events, from the
    events that remain. ``issue_users`` rows whose user no longer appears on
    any remaining event go too, so future ON CONFLICT counting stays exact."""
    from .models import Event, Issue, IssueUser

    if not issue_ids:
        return
    session.execute(
        delete(IssueUser).where(
            IssueUser.issue_id.in_(issue_ids),
            ~exists().where(Event.issue_id == IssueUser.issue_id, Event.user_hash == IssueUser.user_hash),
        )
    )
    rows = session.execute(
        select(
            Event.issue_id,
            func.count(Event.id),
            func.count(func.distinct(Event.user_hash)),
            func.min(Event.ts),
            func.max(Event.ts),
        )
        .where(Event.issue_id.in_(issue_ids))
        .group_by(Event.issue_id)
    ).all()
    for issue_id, count, users, first, last in rows:
        latest_id = session.scalar(
            select(Event.id).where(Event.issue_id == issue_id).order_by(Event.ts.desc(), Event.id.desc()).limit(1)
        )
        session.execute(
            update(Issue)
            .where(Issue.id == issue_id)
            .values(event_count=int(count), user_count=int(users), first_seen=first, last_seen=last, latest_event_id=latest_id)
        )


def prune_events() -> None:
    """Retention (CONTRACT.md): delete events older than each account plan's
    ``retention_days``, delete the issues left with zero events, recompute
    ``event_count`` / ``user_count`` on the issues that lost events.

    Runs account by account so a huge table never needs one giant DELETE.
    Unlimited retention (-1) skips the account.
    """
    from .models import Account, Event, Issue, Project
    from .plans import effective_plan_limits, is_unlimited

    now = datetime.now(timezone.utc)
    total_events = total_issues = 0
    with session_scope() as session:
        accounts = session.scalars(select(Account)).all()
        for account in accounts:
            days = effective_plan_limits(account.plan, str(account.id))["retention_days"]
            if is_unlimited(days):
                continue
            cutoff = now - timedelta(days=int(days))
            project_ids = select(Project.id).where(Project.account_id == account.id)
            old = [Event.project_id.in_(project_ids), Event.ts < cutoff]
            touched = list(session.scalars(select(Event.issue_id).where(*old).distinct()).all())
            if not touched:
                continue
            deleted = session.execute(delete(Event).where(*old)).rowcount or 0
            orphans = session.execute(
                delete(Issue).where(Issue.id.in_(touched), ~exists().where(Event.issue_id == Issue.id))
            ).rowcount or 0
            remaining = [iid for iid in touched]
            _recompute_issues(session, remaining)
            total_events += deleted
            total_issues += orphans
            print(f"  {account.name}: pruned {deleted} event(s) older than {days} days, {orphans} empty issue(s)")
    print(f"✓ pruned {total_events} event(s), {total_issues} issue(s)")


def main(argv: list[str]) -> int:
    cmd = argv[1] if len(argv) > 1 else "upgrade"
    if cmd == "upgrade":
        create_all()
        migrate()
    elif cmd == "migrate":
        migrate()
    elif cmd == "create-all":
        create_all()
    elif cmd == "prune-events":
        prune_events()
    else:
        print(f"unknown command: {cmd}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
