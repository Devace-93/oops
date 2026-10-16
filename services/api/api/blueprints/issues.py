"""Issues blueprint (``/projects/<id>/issues`` …): what the issues inbox, the
issue page, the events log, the charts and the live counter read, and where
issues are resolved / ignored / reopened.

Reads need ``issues:read``, status changes ``issues:write``. ``<issue_id>``
is the issue uuid or its per-project number (``12``). Status changes are
audited (``issue.update`` / ``issues.bulk_update``) in the same transaction.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_, select, update

from dbcore import audit
from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import ISSUE_STATUSES, Event, Issue
from dbcore.posthog_client import capture
from dbcore.stats import (
    StatsError,
    breakdowns,
    issue_clauses,
    list_period_start,
    live,
    parse_filters,
    parse_range,
    timeseries,
    totals,
    where_clauses,
)

from ..auth_utils import actor, require_auth_or_api_key, require_scope
from ..errors import ApiError
from ..serializers import json_body, paged, serialize_event, serialize_issue
from .projects import get_owned_project, public_limit

bp = Blueprint("issues", __name__)

MAX_PER_PAGE = 100
MAX_BULK = 100
ISSUE_SORTS = {
    "last_seen": (Issue.last_seen.desc(), Issue.id),
    "first_seen": (Issue.first_seen.desc(), Issue.id),
    "events": (Issue.event_count.desc(), Issue.last_seen.desc(), Issue.id),
    "users": (Issue.user_count.desc(), Issue.last_seen.desc(), Issue.id),
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _int_arg(name: str, default: int, lo: int, hi: int) -> int:
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, lo), hi)


def _paging() -> tuple[int, int]:
    return _int_arg("page", 1, 1, 100000), _int_arg("per_page", 25, 1, MAX_PER_PAGE)


def _period_start(default: str):
    try:
        return list_period_start(request.args.get("period") or default)
    except StatsError as err:
        raise ApiError(400, err.code, err.message)


def _issue_ref(raw) -> tuple[uuid.UUID | None, int | None]:
    """``(uuid, None)`` or ``(None, number)`` from a path/body reference."""
    text = str(raw or "").strip().lstrip("#")
    if not text:
        raise ApiError(404, "not_found", "Issue not found.")
    if text.isdigit():
        return None, int(text)
    try:
        return uuid.UUID(text), None
    except ValueError:
        raise ApiError(404, "not_found", "Issue not found.")


def get_project_issue(session, project, issue_ref, *, for_update: bool = False) -> Issue:
    """The issue by uuid or number, scoped to ``project``, or 404."""
    issue_uuid, number = _issue_ref(issue_ref)
    stmt = select(Issue).where(Issue.project_id == project.id)
    stmt = stmt.where(Issue.id == issue_uuid) if issue_uuid else stmt.where(Issue.number == number)
    if for_update:
        stmt = stmt.with_for_update()
    issue = session.scalar(stmt)
    if issue is None:
        raise ApiError(404, "not_found", "Issue not found.")
    return issue


def _latest_event(session, issue: Issue) -> Event | None:
    if issue.latest_event_id is not None:
        event = session.get(Event, issue.latest_event_id)
        if event is not None and event.issue_id == issue.id:
            return event
    return session.scalar(
        select(Event).where(Event.issue_id == issue.id).order_by(Event.ts.desc(), Event.id.desc()).limit(1)
    )


def _validated_status(data: dict) -> str:
    status = str(data.get("status") or "").strip().lower()
    if status not in ISSUE_STATUSES:
        raise ApiError(400, "invalid_status", f"status must be one of: {', '.join(ISSUE_STATUSES)}.")
    return status


def _apply_status(issue: Issue, status: str, now: datetime) -> bool:
    """Set ``status`` on ``issue``; returns True when something changed."""
    if issue.status == status:
        return False
    issue.status = status
    issue.resolved_at = now if status == "resolved" else None
    return True


# --------------------------------------------------------------------------- #
# Issues
# --------------------------------------------------------------------------- #
@bp.get("/issues")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def list_issues(project_id):
    """Paged issue list. ``status`` (open default | resolved | ignored | all),
    ``level`` / ``environment`` / ``release`` filters, ``q`` (title, culprit,
    type), ``period`` by last_seen (24h | 7d | 30d default | 90d | all),
    ``sort`` (last_seen default | first_seen | events | users)."""
    page, per_page = _paging()
    status = (request.args.get("status") or "open").strip().lower()
    if status not in ISSUE_STATUSES and status != "all":
        raise ApiError(400, "invalid_status", "status must be open, resolved, ignored or all.")
    sort = (request.args.get("sort") or "last_seen").strip().lower()
    if sort not in ISSUE_SORTS:
        raise ApiError(400, "invalid_sort", f"sort must be one of: {', '.join(ISSUE_SORTS)}.")
    q = (request.args.get("q") or "").strip()[:200]
    since = _period_start("30d")

    with session_scope() as session:
        project = get_owned_project(session, project_id)
        where = issue_clauses(project.id, parse_filters(request.args))
        if status != "all":
            where.append(Issue.status == status)
        if since is not None:
            where.append(Issue.last_seen >= since)
        if q:
            like = f"%{q}%"
            where.append(or_(Issue.title.ilike(like), Issue.culprit.ilike(like), Issue.type.ilike(like)))
        total = session.scalar(select(func.count(Issue.id)).where(*where)) or 0
        rows = session.scalars(
            select(Issue).where(*where).order_by(*ISSUE_SORTS[sort]).limit(per_page).offset((page - 1) * per_page)
        ).all()
        body = paged([serialize_issue(i) for i in rows], page, per_page, total)
    return jsonify(body)


@bp.get("/issues/<issue_id>")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def get_issue(project_id, issue_id):
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        issue = get_project_issue(session, project, issue_id)
        body = serialize_issue(issue, _latest_event(session, issue), include_latest=True)
    return jsonify(body)


@bp.patch("/issues/<issue_id>")
@public_limit
@require_auth_or_api_key
@require_scope("issues:write")
def patch_issue(project_id, issue_id):
    """``{status}`` → the issue. Resolving stamps ``resolved_at``; reopening or
    ignoring clears it (``regressed_at`` is only ever set by ingest)."""
    status = _validated_status(json_body())
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        issue = get_project_issue(session, project, issue_id, for_update=True)
        previous = issue.status
        changed = _apply_status(issue, status, now)
        audit.record(
            session,
            account_id=g.account_id,
            action="issue.update",
            target_type="issue",
            target_id=str(issue.id),
            meta={"project_id": str(project.id), "number": issue.number, "from": previous, "to": status},
            **actor(),
        )
        session.flush()
        session.refresh(issue)
        body = serialize_issue(issue, _latest_event(session, issue), include_latest=True)
    if changed and status == "resolved":
        capture(str(g.account_id), "issue_resolved", {"count": 1, "from": previous}, groups={"account": str(g.account_id)})
    return jsonify(body)


@bp.post("/issues/bulk")
@public_limit
@require_auth_or_api_key
@require_scope("issues:write")
def bulk_update_issues(project_id):
    """``{ids: [≤ 100 uuids or numbers], status}`` → ``{updated}``."""
    data = json_body()
    status = _validated_status(data)
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids:
        raise ApiError(400, "invalid_ids", "ids must be a non-empty list of issue ids.")
    if len(ids) > MAX_BULK:
        raise ApiError(400, "invalid_ids", f"At most {MAX_BULK} ids per call.")
    uuids: list[uuid.UUID] = []
    numbers: list[int] = []
    for raw in ids:
        issue_uuid, number = _issue_ref(raw)
        (uuids.append(issue_uuid) if issue_uuid else numbers.append(number))

    now = datetime.now(timezone.utc)
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        where = [Issue.project_id == project.id, Issue.status != status]
        refs = []
        if uuids:
            refs.append(Issue.id.in_(uuids))
        if numbers:
            refs.append(Issue.number.in_(numbers))
        where.append(or_(*refs))
        updated = session.execute(
            update(Issue)
            .where(*where)
            .values(status=status, resolved_at=now if status == "resolved" else None, updated_at=now)
        ).rowcount or 0
        audit.record(
            session,
            account_id=g.account_id,
            action="issues.bulk_update",
            target_type="project",
            target_id=str(project.id),
            meta={"status": status, "requested": len(ids), "updated": int(updated)},
            **actor(),
        )
    if updated and status == "resolved":
        capture(str(g.account_id), "issue_resolved", {"count": int(updated), "bulk": True}, groups={"account": str(g.account_id)})
    return jsonify({"updated": int(updated)})


@bp.get("/issues/<issue_id>/events")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def list_issue_events(project_id, issue_id):
    """Occurrences of one issue, newest first."""
    page, per_page = _paging()
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        issue = get_project_issue(session, project, issue_id)
        where = [Event.issue_id == issue.id]
        total = session.scalar(select(func.count(Event.id)).where(*where)) or 0
        rows = session.scalars(
            select(Event).where(*where).order_by(Event.ts.desc(), Event.id.desc()).limit(per_page).offset((page - 1) * per_page)
        ).all()
        body = paged([serialize_event(e, issue_number=issue.number) for e in rows], page, per_page, total)
    return jsonify(body)


# --------------------------------------------------------------------------- #
# Events
# --------------------------------------------------------------------------- #
@bp.get("/events")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def list_events(project_id):
    """Events across the project, newest first. Filters ``level``,
    ``environment``, ``release``, ``q`` (message), ``issue`` (uuid or
    number), ``period`` (24h | 7d | 30d default | 90d | all)."""
    page, per_page = _paging()
    q = (request.args.get("q") or "").strip()[:200]
    since = _period_start("30d")
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        where = where_clauses(project.id, since, None, parse_filters(request.args))
        issue_ref = (request.args.get("issue") or "").strip()
        if issue_ref:
            where.append(Event.issue_id == get_project_issue(session, project, issue_ref).id)
        if q:
            where.append(Event.message.ilike(f"%{q}%"))
        total = session.scalar(select(func.count(Event.id)).where(*where)) or 0
        rows = session.scalars(
            select(Event).where(*where).order_by(Event.ts.desc(), Event.id.desc()).limit(per_page).offset((page - 1) * per_page)
        ).all()
        body = paged([serialize_event(e) for e in rows], page, per_page, total)
    return jsonify(body)


@bp.get("/events/<event_id>")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def get_event(project_id, event_id):
    try:
        eid = int(str(event_id).strip())
    except ValueError:
        raise ApiError(404, "not_found", "Event not found.")
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        event = session.scalar(select(Event).where(Event.id == eid, Event.project_id == project.id))
        if event is None:
            raise ApiError(404, "not_found", "Event not found.")
        body = serialize_event(event)
    return jsonify(body)


# --------------------------------------------------------------------------- #
# Stats + live
# --------------------------------------------------------------------------- #
@bp.get("/stats")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def stats(project_id):
    """``{range, totals, previous, series, breakdowns}`` in one round trip."""
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        try:
            rng = parse_range(request.args, project.timezone or "UTC")
        except StatsError as err:
            raise ApiError(400, err.code, err.message)
        filters = parse_filters(request.args)
        prev_start, prev_end = rng.previous()
        body = {
            "project_id": str(project.id),
            "range": rng.to_dict(),
            "filters": filters,
            "totals": totals(session, project.id, rng.start, rng.end, filters),
            "previous": totals(session, project.id, prev_start, prev_end, filters, with_open=False),
            "series": timeseries(session, project.id, rng, filters),
            "breakdowns": breakdowns(session, project.id, rng, filters),
        }
    return jsonify(body)


@bp.get("/live")
@public_limit
@require_auth_or_api_key
@require_scope("issues:read")
def live_events(project_id):
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        body = {"project_id": str(project.id), **live(session, project.id, config.live_window_min)}
    return jsonify(body)
