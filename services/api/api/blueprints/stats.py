"""Stats blueprint (``/projects/<id>/stats`` …): what the dashboard charts,
the breakdown drill-downs, the raw event list and the live counter read.

All endpoints need ``stats:read``. Ranges are inclusive local dates in the
``tz`` query parameter (default: the project's time zone); see
``dbcore.stats.parse_range`` for ``period`` shortcuts.
"""
from __future__ import annotations

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select

from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import Event
from dbcore.stats import (
    DIMENSIONS,
    StatsError,
    breakdown,
    breakdown_total,
    live,
    parse_filters,
    parse_range,
    timeseries,
    totals,
    where_clauses,
)

from ..auth_utils import require_auth_or_api_key, require_scope
from ..errors import ApiError
from ..serializers import serialize_event
from .projects import get_owned_project, public_limit

bp = Blueprint("stats", __name__)

OVERVIEW_DIMENSIONS = (
    "path", "referrer", "country", "region", "city", "device", "browser", "os", "lang",
    "utm_source", "utm_medium", "utm_campaign", "name", "ip",
)


def _int_arg(name: str, default: int, lo: int, hi: int) -> int:
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, lo), hi)


def _range_and_filters(project):
    try:
        rng = parse_range(request.args, project.timezone or "UTC")
    except StatsError as err:
        raise ApiError(400, err.code, err.message)
    return rng, parse_filters(request.args)


def _range_body(rng) -> dict:
    return {
        "from": rng.from_date.isoformat(),
        "to": rng.to_date.isoformat(),
        "tz": rng.tz,
        "interval": rng.interval,
        "days": rng.days,
    }


@bp.get("/stats")
@public_limit
@require_auth_or_api_key
@require_scope("stats:read")
def stats(project_id):
    """Everything the overview page shows in one round trip."""
    limit = _int_arg("limit", 8, 1, 50)
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        rng, filters = _range_and_filters(project)
        where = where_clauses(project.id, rng.start, rng.end, filters)
        prev_start, prev_end = rng.previous()
        body = {
            "project_id": str(project.id),
            "range": _range_body(rng),
            "filters": filters,
            "totals": totals(session, where),
            "previous": totals(session, where_clauses(project.id, prev_start, prev_end, filters)),
            "series": timeseries(session, where, rng),
            "breakdowns": {by: breakdown(session, where, by, limit=limit) for by in OVERVIEW_DIMENSIONS},
            "live": live(session, project.id, config.live_window_min),
        }
    return jsonify(body)


@bp.get("/stats/breakdown")
@public_limit
@require_auth_or_api_key
@require_scope("stats:read")
def stats_breakdown(project_id):
    """One dimension, paginated: ``?by=path&page=1&per_page=50``."""
    by = (request.args.get("by") or "path").strip()
    if by not in DIMENSIONS:
        raise ApiError(400, "invalid_dimension", f"by must be one of: {', '.join(DIMENSIONS)}.")
    page = _int_arg("page", 1, 1, 100000)
    per_page = _int_arg("per_page", 50, 1, 200)
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        rng, filters = _range_and_filters(project)
        where = where_clauses(project.id, rng.start, rng.end, filters)
        items = breakdown(session, where, by, limit=per_page, offset=(page - 1) * per_page)
        total = breakdown_total(session, where, by)
        body = {
            "project_id": str(project.id),
            "range": _range_body(rng),
            "filters": filters,
            "by": by,
            "items": items,
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    return jsonify(body)


@bp.get("/stats/series")
@public_limit
@require_auth_or_api_key
@require_scope("stats:read")
def stats_series(project_id):
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        rng, filters = _range_and_filters(project)
        where = where_clauses(project.id, rng.start, rng.end, filters)
        body = {"project_id": str(project.id), "range": _range_body(rng), "filters": filters, "series": timeseries(session, where, rng)}
    return jsonify(body)


@bp.get("/live")
@public_limit
@require_auth_or_api_key
@require_scope("stats:read")
def live_visitors(project_id):
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        body = {"project_id": str(project.id), **live(session, project.id, config.live_window_min)}
    return jsonify(body)


@bp.get("/events")
@public_limit
@require_auth_or_api_key
@require_scope("stats:read")
def list_events(project_id):
    """Raw events, newest first. Same range and dimension filters as /stats,
    plus ``kind`` (pageview | event) and ``q`` (substring of path or title)."""
    page = _int_arg("page", 1, 1, 100000)
    per_page = _int_arg("per_page", 50, 1, 200)
    kind = (request.args.get("kind") or "").strip().lower()
    q = (request.args.get("q") or "").strip()
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        rng, filters = _range_and_filters(project)
        where = where_clauses(project.id, rng.start, rng.end, filters)
        if kind in ("pageview", "event"):
            where.append(Event.kind == kind)
        if q:
            like = f"%{q}%"
            where.append((Event.path.ilike(like)) | (Event.title.ilike(like)) | (Event.name.ilike(like)))
        total = int(session.scalar(select(func.count(Event.id)).where(*where)) or 0)
        rows = session.scalars(
            select(Event).where(*where).order_by(Event.ts.desc(), Event.id.desc()).limit(per_page).offset((page - 1) * per_page)
        ).all()
        body = {
            "project_id": str(project.id),
            "range": _range_body(rng),
            "filters": filters,
            "items": [serialize_event(e) for e in rows],
            "page": page,
            "per_page": per_page,
            "total": total,
        }
    return jsonify(body)
