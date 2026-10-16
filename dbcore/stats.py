"""Aggregation queries over the ``events`` table.

Everything the stats API and the MCP tools need: range parsing (dates in the
project's time zone), totals, the time series (hour / day / month buckets in
that zone, gaps filled with zeros), breakdowns (pages, referrers, countries,
devices …) and the live-visitors window. Pure SQL ``GROUP BY`` over the
``(project_id, ts)`` index; no roll-up tables yet.

"Visitors" is ``COUNT(DISTINCT visitor_hash)``. The hash is salted per day
(see ``dbcore.privacy``), so over multi-day ranges it is the number of daily
unique visitors, summed — the usual cookie-less definition.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .models import Event

PERIODS = ("today", "yesterday", "7d", "30d", "90d", "12mo")
INTERVALS = ("hour", "day", "month")
MAX_RANGE_DAYS = 400

# Query-parameter name -> column, for filters and breakdowns.
DIMENSIONS = {
    "path": Event.path,
    "hostname": Event.hostname,
    "referrer": Event.referrer_host,
    "country": Event.country,
    "region": Event.region,
    "city": Event.city,
    "device": Event.device,
    "browser": Event.browser,
    "os": Event.os,
    "lang": Event.lang,
    "utm_source": Event.utm_source,
    "utm_medium": Event.utm_medium,
    "utm_campaign": Event.utm_campaign,
    "name": Event.name,
    "ip": Event.ip,
}
DIRECT = "(direct)"


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
    from_date: date          # local, inclusive
    to_date: date            # local, inclusive
    interval: str            # hour | day | month
    start: datetime          # UTC, inclusive
    end: datetime            # UTC, exclusive

    @property
    def days(self) -> int:
        return (self.to_date - self.from_date).days + 1

    def previous(self) -> tuple[datetime, datetime]:
        length = self.end - self.start
        return self.start - length, self.start


def _local_bounds(tz: str, from_date: date, to_date: date) -> tuple[datetime, datetime]:
    zone = ZoneInfo(tz)
    start = datetime.combine(from_date, time.min, tzinfo=zone).astimezone(timezone.utc)
    end = datetime.combine(to_date + timedelta(days=1), time.min, tzinfo=zone).astimezone(timezone.utc)
    return start, end


def parse_range(args, default_tz: str = "UTC") -> Range:
    """Build a :class:`Range` from query args: ``period`` (today | yesterday |
    7d | 30d | 90d | 12mo) or explicit ``from`` / ``to`` (YYYY-MM-DD, local
    dates in ``tz``), plus an optional ``interval``."""
    tz = (args.get("tz") or default_tz or "UTC").strip()
    if not valid_timezone(tz):
        raise StatsError("invalid_tz", "tz must be an IANA time zone name, e.g. Europe/Madrid.")
    today = datetime.now(ZoneInfo(tz)).date()

    raw_from, raw_to = (args.get("from") or "").strip(), (args.get("to") or "").strip()
    period = (args.get("period") or "").strip().lower()
    if raw_from or raw_to:
        try:
            from_date = date.fromisoformat(raw_from) if raw_from else today - timedelta(days=29)
            to_date = date.fromisoformat(raw_to) if raw_to else today
        except ValueError:
            raise StatsError("invalid_range", "from and to must be YYYY-MM-DD dates.")
    else:
        period = period or "30d"
        if period not in PERIODS:
            raise StatsError("invalid_period", f"period must be one of: {', '.join(PERIODS)}.")
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
    if to_date < from_date:
        from_date, to_date = to_date, from_date
    span = (to_date - from_date).days + 1
    if span > MAX_RANGE_DAYS:
        raise StatsError("invalid_range", f"Ranges are limited to {MAX_RANGE_DAYS} days.")

    interval = (args.get("interval") or "").strip().lower()
    if interval and interval not in INTERVALS:
        raise StatsError("invalid_interval", "interval must be hour, day or month.")
    if not interval:
        interval = "hour" if span <= 2 else "month" if span > 120 else "day"

    start, end = _local_bounds(tz, from_date, to_date)
    return Range(tz=tz, from_date=from_date, to_date=to_date, interval=interval, start=start, end=end)


def parse_filters(args) -> dict[str, str]:
    """``{dimension: value}`` from query args, only known dimensions, non-empty."""
    out: dict[str, str] = {}
    for key in DIMENSIONS:
        value = (args.get(key) or "").strip()
        if value:
            out[key] = value[:2048]
    return out


def where_clauses(project_id, start: datetime, end: datetime, filters: dict[str, str] | None = None) -> list:
    clauses = [Event.project_id == project_id, Event.ts >= start, Event.ts < end]
    for key, value in (filters or {}).items():
        col = DIMENSIONS[key]
        if key == "referrer" and value == DIRECT:
            clauses.append(col.is_(None))
        elif key == "name":
            clauses.append(Event.kind == "event")
            clauses.append(col == value)
        else:
            clauses.append(col == value)
    return clauses


_PAGEVIEWS = func.coalesce(func.sum(case((Event.kind == "pageview", 1), else_=0)), 0)
_EVENTS = func.coalesce(func.sum(case((Event.kind == "event", 1), else_=0)), 0)
_VISITORS = func.count(func.distinct(Event.visitor_hash))


def totals(session: Session, where: list) -> dict:
    row = session.execute(select(_PAGEVIEWS, _VISITORS, _EVENTS).where(*where)).one()
    return {"pageviews": int(row[0]), "visitors": int(row[1]), "events": int(row[2])}


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


def timeseries(session: Session, where: list, rng: Range) -> list[dict]:
    """One point per bucket of ``rng.interval`` in ``rng.tz``; missing buckets are zero."""
    local_ts = func.timezone(rng.tz, Event.ts)
    bucket = func.date_trunc(rng.interval, local_ts)
    rows = session.execute(
        select(bucket, _PAGEVIEWS, _VISITORS, _EVENTS).where(*where).group_by(bucket).order_by(bucket)
    ).all()
    found = {_bucket_key(b, rng.interval): (int(pv), int(vis), int(ev)) for b, pv, vis, ev in rows}

    points: list[dict] = []
    cursor = datetime.combine(rng.from_date, time.min)
    if rng.interval == "month":
        cursor = cursor.replace(day=1)
    end_local = datetime.combine(rng.to_date + timedelta(days=1), time.min)
    while cursor < end_local:
        key = _bucket_key(cursor, rng.interval)
        pv, vis, ev = found.get(key, (0, 0, 0))
        points.append({"bucket": key, "pageviews": pv, "visitors": vis, "events": ev})
        cursor = _step(cursor, rng.interval)
    return points


def breakdown(session: Session, where: list, by: str, *, limit: int = 10, offset: int = 0) -> list[dict]:
    """Top values of one dimension with their page views, visitors and events."""
    if by not in DIMENSIONS:
        raise StatsError("invalid_dimension", f"by must be one of: {', '.join(DIMENSIONS)}.")
    col = DIMENSIONS[by]
    clauses = list(where)
    if by == "referrer":
        value_col = func.coalesce(col, DIRECT)
    elif by == "name":
        value_col = col
        clauses.append(Event.kind == "event")
        clauses.append(col.isnot(None))
    else:
        value_col = col
        clauses.append(col.isnot(None))
    order = (_EVENTS.desc(), _VISITORS.desc()) if by == "name" else (_VISITORS.desc(), _PAGEVIEWS.desc())
    rows = session.execute(
        select(value_col, _PAGEVIEWS, _VISITORS, _EVENTS)
        .where(*clauses)
        .group_by(value_col)
        .order_by(*order, value_col)
        .limit(limit)
        .offset(offset)
    ).all()
    return [{"value": v, "pageviews": int(pv), "visitors": int(vis), "events": int(ev)} for v, pv, vis, ev in rows]


def breakdown_total(session: Session, where: list, by: str) -> int:
    """Number of distinct values of ``by`` (for paginating a breakdown)."""
    col = DIMENSIONS[by]
    clauses = list(where)
    value_col = func.coalesce(col, DIRECT) if by == "referrer" else col
    if by != "referrer":
        clauses.append(col.isnot(None))
    if by == "name":
        clauses.append(Event.kind == "event")
    sub = select(value_col).where(*clauses).group_by(value_col).subquery()
    return int(session.scalar(select(func.count()).select_from(sub)) or 0)


def live(session: Session, project_id, minutes: int) -> dict:
    """Visitors and page views in the last ``minutes``, plus the pages they are on."""
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    where = [Event.project_id == project_id, Event.ts >= since]
    t = totals(session, where)
    pages = session.execute(
        select(Event.path, _VISITORS, _PAGEVIEWS)
        .where(*where, Event.kind == "pageview")
        .group_by(Event.path)
        .order_by(_VISITORS.desc(), _PAGEVIEWS.desc())
        .limit(10)
    ).all()
    return {
        "window_minutes": minutes,
        "visitors": t["visitors"],
        "pageviews": t["pageviews"],
        "pages": [{"path": p, "visitors": int(v), "pageviews": int(pv)} for p, v, pv in pages],
    }


def window_totals(session: Session, project_id, tz: str, from_date: date, to_date: date) -> dict:
    """Totals for an inclusive local date window (summary cards)."""
    start, end = _local_bounds(tz, from_date, to_date)
    return totals(session, where_clauses(project_id, start, end))
