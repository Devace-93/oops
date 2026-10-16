"""Aggregation queries over ``events`` and ``issues``.

Everything the stats API and the MCP tools need: range parsing (periods or
dates in the project's time zone), totals (events, affected users, new issues,
open issues) with the previous period, the time series (hour / day / month
buckets in that zone, gaps filled with zeros), the top-10 breakdowns (level,
environment, release, browser, os, device, type), the live window and the
per-project counts shown on project cards. Pure SQL ``GROUP BY`` over the
``(project_id, ts)`` index; no roll-up tables yet.

"Users" is ``COUNT(DISTINCT user_hash)``: exact for identified users, daily
uniques for anonymous ones (see ``dbcore.privacy``).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Event, Issue

PERIODS = ("today", "yesterday", "24h", "7d", "30d", "90d", "12mo")
# Rolling windows for the issues / events lists (by last_seen / ts).
LIST_PERIODS = {"24h": timedelta(hours=24), "7d": timedelta(days=7), "30d": timedelta(days=30), "90d": timedelta(days=90)}
INTERVALS = ("hour", "day", "month")
MAX_RANGE_DAYS = 400
BREAKDOWN_LIMIT = 10

# Query-parameter name -> column, for filters and breakdowns.
DIMENSIONS = {
    "level": Event.level,
    "environment": Event.environment,
    "release": Event.release,
    "browser": Event.browser,
    "os": Event.os,
    "device": Event.device,
    "type": Event.type,
}
FILTERS = ("level", "environment", "release")


class StatsError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def valid_timezone(name: str | None) -> bool:
    if not name:
        return False
    try:
        ZoneInfo(name)
    except Exception:
        return False
    return True


@dataclass
class Range:
    tz: str
    interval: str            # hour | day | month
    start: datetime          # UTC, inclusive
    end: datetime            # UTC, exclusive
    period: str | None       # the shortcut used, if any

    @property
    def zone(self) -> ZoneInfo:
        return ZoneInfo(self.tz)

    def previous(self) -> tuple[datetime, datetime]:
        length = self.end - self.start
        return self.start - length, self.start

    def to_dict(self) -> dict:
        return {
            "from": self.start.astimezone(self.zone).isoformat(),
            "to": self.end.astimezone(self.zone).isoformat(),
            "tz": self.tz,
            "interval": self.interval,
            "period": self.period,
        }


def _local_bounds(tz: str, from_date: date, to_date: date) -> tuple[datetime, datetime]:
    zone = ZoneInfo(tz)
    start = datetime.combine(from_date, time.min, tzinfo=zone).astimezone(timezone.utc)
    end = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=zone).astimezone(timezone.utc)
    return start, end


def _auto_interval(start: datetime, end: datetime) -> str:
    span_days = (end - start).total_seconds() / 86400
    if span_days <= 2:
        return "hour"
    if span_days > 120:
        return "month"
    return "day"


def parse_range(args, default_tz: str = "UTC", *, now: datetime | None = None) -> Range:
    """Build a :class:`Range` from query args: ``period`` (today | yesterday |
    24h | 7d | 30d | 90d | 12mo, default 7d) or explicit ``from`` / ``to``
    (YYYY-MM-DD, local dates in the project zone), plus an optional
    ``interval``. ``24h`` is a rolling window ending now; the others are
    whole local days."""
    tz = (args.get("tz") or default_tz or "UTC").strip()
    if not valid_timezone(tz):
        raise StatsError("invalid_tz", "tz must be an IANA time zone name, e.g. Europe/Madrid.")
    now = now or datetime.now(timezone.utc)
    today = now.astimezone(ZoneInfo(tz)).date()

    raw_from, raw_to = (args.get("from") or "").strip(), (args.get("to") or "").strip()
    period = (args.get("period") or "").strip().lower() or None
    if raw_from or raw_to:
        period = None
        try:
            from_date = date.fromisoformat(raw_from) if raw_from else today - timedelta(days=6)
            to_date = date.fromisoformat(raw_to) if raw_to else today
        except ValueError:
            raise StatsError("invalid_range", "from and to must be YYYY-MM-DD dates.")
        if to_date < from_date:
            from_date, to_date = to_date, from_date
        if (to_date - from_date).days + 1 > MAX_RANGE_DAYS:
            raise StatsError("invalid_range", f"Ranges are limited to {MAX_RANGE_DAYS} days.")
        start, end = _local_bounds(tz, from_date, to_date)
    else:
        period = period or "7d"
        if period not in PERIODS:
            raise StatsError("invalid_period", f"period must be one of: {', '.join(PERIODS)}.")
        if period == "24h":
            end = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
            start = end - timedelta(hours=24)
        else:
            if period == "today":
                from_date = to_date = today
            elif period == "yesterday":
                from_date = to_date = today - timedelta(days=1)
            elif period == "7d":
                from_date, to_date = today - timedelta(days=6), today
            elif period == "30d":
                from_date, to_date = today - timedelta(days=29), today
            elif period == "90d":
                from_date, to_date = today - timedelta(days=89), today
            else:  # 12mo
                from_date, to_date = today - timedelta(days=364), today
            start, end = _local_bounds(tz, from_date, to_date)

    interval = (args.get("interval") or "").strip().lower()
    if interval and interval not in INTERVALS:
        raise StatsError("invalid_interval", "interval must be hour, day or month.")
    if not interval:
        interval = _auto_interval(start, end)
    return Range(tz=tz, interval=interval, start=start, end=end, period=period)


def parse_filters(args) -> dict[str, str]:
    """``{level | environment | release: value}`` from query args, non-empty only."""
    out: dict[str, str] = {}
    for key in FILTERS:
        value = (args.get(key) or "").strip()
        if value:
            out[key] = value[:200]
    return out


def list_period_start(period: str | None, *, now: datetime | None = None) -> datetime | None:
    """Start of a rolling list window (``24h`` … ``90d``), None for ``all``.
    The stats periods are accepted too so one dropdown can drive both."""
    period = (period or "").strip().lower()
    if period in ("", "all"):
        return None
    now = now or datetime.now(timezone.utc)
    if period in LIST_PERIODS:
        return now - LIST_PERIODS[period]
    if period == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "12mo":
        return now - timedelta(days=365)
    raise StatsError("invalid_period", "period must be one of: 24h, 7d, 30d, 90d, all.")


def where_clauses(project_id, start: datetime | None, end: datetime | None, filters: dict[str, str] | None = None) -> list:
    clauses = [Event.project_id == project_id]
    if start is not None:
        clauses.append(Event.ts >= start)
    if end is not None:
        clauses.append(Event.ts < end)
    for key, value in (filters or {}).items():
        clauses.append(DIMENSIONS[key] == value)
    return clauses


def issue_clauses(project_id, filters: dict[str, str] | None = None) -> list:
    """The same filters applied to issues (labels live in JSONB lists)."""
    clauses = [Issue.project_id == project_id]
    for key, value in (filters or {}).items():
        if key == "level":
            clauses.append(Issue.level == value)
        elif key == "environment":
            clauses.append(Issue.environments.contains([value]))
        elif key == "release":
            clauses.append(Issue.releases.contains([value]))
    return clauses


_EVENTS = func.count(Event.id)
_USERS = func.count(func.distinct(Event.user_hash))


def totals(session: Session, project_id, start: datetime, end: datetime, filters: dict[str, str] | None = None, *, with_open: bool = True) -> dict:
    """``{events, users, issues_new[, issues_open]}`` for a UTC window."""
    row = session.execute(select(_EVENTS, _USERS).where(*where_clauses(project_id, start, end, filters))).one()
    out = {"events": int(row[0]), "users": int(row[1])}
    out["issues_new"] = int(
        session.scalar(
            select(func.count(Issue.id)).where(*issue_clauses(project_id, filters), Issue.first_seen >= start, Issue.first_seen < end)
        )
        or 0
    )
    if with_open:
        out["issues_open"] = int(
            session.scalar(select(func.count(Issue.id)).where(*issue_clauses(project_id, filters), Issue.status == "open")) or 0
        )
    return out


def _bucket_key(dt: datetime, interval: str) -> str:
    if interval == "hour":
        return dt.strftime("%Y-%m-%dT%H:00")
    if interval == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


def _step(dt: datetime, interval: str) -> datetime:
    if interval == "hour":
        return dt + timedelta(hours=1)
    if interval == "day":
        return dt + timedelta(days=1)
    year, month = (dt.year + 1, 1) if dt.month == 12 else (dt.year, dt.month + 1)
    return dt.replace(year=year, month=month, day=1)


def _truncate(dt: datetime, interval: str) -> datetime:
    if interval == "hour":
        return dt.replace(minute=0, second=0, microsecond=0)
    if interval == "day":
        return dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return dt.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def timeseries(session: Session, project_id, rng: Range, filters: dict[str, str] | None = None) -> list[dict]:
    """One ``{ts, events, users}`` point per bucket of ``rng.interval`` in
    ``rng.tz``; ``ts`` is the bucket start as a local ISO datetime with offset;
    missing buckets are zero."""
    local_ts = func.timezone(rng.tz, Event.ts)
    bucket = func.date_trunc(rng.interval, local_ts)
    rows = session.execute(
        select(bucket, _EVENTS, _USERS)
        .where(*where_clauses(project_id, rng.start, rng.end, filters))
        .group_by(bucket)
        .order_by(bucket)
    ).all()
    found = {_bucket_key(b, rng.interval): (int(ev), int(us)) for b, ev, us in rows}

    zone = rng.zone
    cursor = _truncate(rng.start.astimezone(zone).replace(tzinfo=None), rng.interval)
    end_local = rng.end.astimezone(zone).replace(tzinfo=None)
    points: list[dict] = []
    while cursor < end_local and len(points) < 10000:
        key = _bucket_key(cursor, rng.interval)
        ev, us = found.get(key, (0, 0))
        points.append({"ts": cursor.replace(tzinfo=zone).isoformat(), "events": ev, "users": us})
        cursor = _step(cursor, rng.interval)
    return points


def breakdown(session: Session, project_id, start: datetime, end: datetime, by: str, filters: dict[str, str] | None = None, *, limit: int = BREAKDOWN_LIMIT) -> list[dict]:
    """Top values of one dimension: ``[{value, events, users}]`` by events."""
    if by not in DIMENSIONS:
        raise StatsError("invalid_dimension", f"by must be one of: {', '.join(DIMENSIONS)}.")
    col = DIMENSIONS[by]
    rows = session.execute(
        select(col, _EVENTS, _USERS)
        .where(*where_clauses(project_id, start, end, filters), col.isnot(None))
        .group_by(col)
        .order_by(_EVENTS.desc(), _USERS.desc(), col)
        .limit(limit)
    ).all()
    return [{"value": value, "events": int(ev), "users": int(us)} for value, ev, us in rows]


def breakdowns(session: Session, project_id, rng: Range, filters: dict[str, str] | None = None) -> dict:
    return {by: breakdown(session, project_id, rng.start, rng.end, by, filters) for by in DIMENSIONS}


def live(session: Session, project_id, minutes: int) -> dict:
    """``{events, window_min}``: events received in the last ``minutes``."""
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    count = session.scalar(select(_EVENTS).where(Event.project_id == project_id, Event.ts >= since)) or 0
    return {"events": int(count), "window_min": minutes}


def project_counts(session: Session, project_ids: list) -> dict:
    """``{project_id: {open_issues, events_24h, events_30d, users_30d, last_event_at}}``
    for the project cards and ``GET /projects/<id>/summary``."""
    out = {
        pid: {"open_issues": 0, "events_24h": 0, "events_30d": 0, "users_30d": 0, "last_event_at": None}
        for pid in project_ids
    }
    if not project_ids:
        return out
    now = datetime.now(timezone.utc)
    since_30d = now - timedelta(days=30)
    since_24h = now - timedelta(hours=24)
    rows = session.execute(
        select(
            Event.project_id,
            func.count(Event.id),
            func.count(Event.id).filter(Event.ts >= since_24h),
            func.count(func.distinct(Event.user_hash)),
            func.max(Event.ts),
        )
        .where(Event.project_id.in_(project_ids), Event.ts >= since_30d)
        .group_by(Event.project_id)
    ).all()
    for pid, ev30, ev24, users, last in rows:
        out[pid].update({"events_30d": int(ev30), "events_24h": int(ev24), "users_30d": int(users), "last_event_at": last})
    open_rows = session.execute(
        select(Issue.project_id, func.count(Issue.id))
        .where(Issue.project_id.in_(project_ids), Issue.status == "open")
        .group_by(Issue.project_id)
    ).all()
    for pid, n in open_rows:
        out[pid]["open_issues"] = int(n)
    # Projects quiet for 30 days still show when they last reported.
    stale = [pid for pid in project_ids if out[pid]["last_event_at"] is None]
    if stale:
        last_rows = session.execute(
            select(Issue.project_id, func.max(Issue.last_seen)).where(Issue.project_id.in_(stale)).group_by(Issue.project_id)
        ).all()
        for pid, last in last_rows:
            out[pid]["last_event_at"] = last
    return out
