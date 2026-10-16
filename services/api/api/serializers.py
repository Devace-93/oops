"""Pure functions that turn ORM rows into JSON-safe dicts (and helpers for
the opposite direction, ``json_body`` / ``json_or_form_body``).

Centralising serialization keeps the wire format (the CONTRACT.md shapes)
consistent across every blueprint.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask import request

from .errors import ApiError


def iso(dt: datetime | None) -> str | None:
    """UTC ISO-8601 with a trailing ``Z`` (or None). Naive datetimes are
    assumed to already be UTC (Postgres timestamptz comes back tz-aware)."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def json_body() -> dict:
    """The request's JSON object, or ``{}`` for an empty body. A body that is
    valid JSON but not an object is a 400 rather than a 500 downstream."""
    data = request.get_json(silent=True)
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ApiError(400, "invalid_body", "Request body must be a JSON object.")
    return data


def json_or_form_body() -> dict:
    """JSON object when the request is JSON (any content type: the SDK posts
    ``text/plain`` to avoid a CORS preflight), otherwise the form fields,
    otherwise the query string."""
    if request.is_json:
        return json_body()
    data = request.get_json(silent=True, force=True)
    if isinstance(data, dict):
        return data
    if request.form:
        return {k: v for k, v in request.form.items()}
    return {k: v for k, v in request.args.items()}


def paged(items: list, page: int, per_page: int, total: int) -> dict:
    """The paging envelope every list endpoint returns."""
    return {"items": items, "page": page, "per_page": per_page, "total": int(total)}


def serialize_user(user) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "email_verified": user.email_verified_at is not None,
        "created_at": iso(user.created_at),
    }


def serialize_account(account) -> dict:
    return {
        "id": str(account.id),
        "name": account.name,
        "plan": account.plan,
        "created_at": iso(account.created_at),
    }


def serialize_project(project, counts: dict | None = None) -> dict:
    """Exactly the CONTRACT.md "Project" shape (owner-only: includes the public key)."""
    counts = counts or {}
    return {
        "id": str(project.id),
        "key": project.key,
        "name": project.name,
        "description": project.description,
        "url": project.url,
        "public_key": project.public_key,
        "public_key_prefix": project.public_key_prefix,
        "timezone": project.timezone or "UTC",
        "allowed_origins": list(project.allowed_origins or []),
        "ingest_enabled": project.ingest_enabled,
        "store_ip": project.store_ip,
        "counts": {
            "open_issues": int(counts.get("open_issues", 0)),
            "events_24h": int(counts.get("events_24h", 0)),
            "events_30d": int(counts.get("events_30d", 0)),
            "users_30d": int(counts.get("users_30d", 0)),
            "last_event_at": iso(counts.get("last_event_at")),
        },
        "created_at": iso(project.created_at),
        "updated_at": iso(project.updated_at),
    }


def serialize_issue(issue, latest_event=None, *, include_latest: bool = False) -> dict:
    """Exactly the CONTRACT.md "Issue" shape; ``latest_event`` only on detail."""
    body = {
        "id": str(issue.id),
        "project_id": str(issue.project_id),
        "number": issue.number,
        "fingerprint": issue.fingerprint,
        "title": issue.title,
        "culprit": issue.culprit,
        "type": issue.type,
        "level": issue.level,
        "status": issue.status,
        "first_seen": iso(issue.first_seen),
        "last_seen": iso(issue.last_seen),
        "resolved_at": iso(issue.resolved_at),
        "regressed_at": iso(issue.regressed_at),
        "event_count": int(issue.event_count or 0),
        "user_count": int(issue.user_count or 0),
        "environments": list(issue.environments or []),
        "releases": list(issue.releases or []),
        "latest_event_id": str(issue.latest_event_id) if issue.latest_event_id is not None else None,
        "created_at": iso(issue.created_at),
        "updated_at": iso(issue.updated_at),
    }
    if include_latest:
        body["latest_event"] = serialize_event(latest_event, issue_number=issue.number) if latest_event else None
    return body


def serialize_event(event, issue_number: int | None = None) -> dict:
    """Exactly the CONTRACT.md "Event" shape. ``id`` is the bigint as a string;
    ``ip`` is null unless the project stores addresses."""
    if issue_number is None:
        issue = getattr(event, "issue", None)
        issue_number = issue.number if issue is not None else None
    return {
        "id": str(event.id),
        "project_id": str(event.project_id),
        "issue_id": str(event.issue_id),
        "issue_number": issue_number,
        "ts": iso(event.ts),
        "level": event.level,
        "type": event.type,
        "message": event.message or "",
        "frames": list(event.frames or []),
        "stack_raw": event.stack_raw,
        "url": event.url,
        "path": event.path,
        "hostname": event.hostname,
        "release": event.release,
        "environment": event.environment,
        "platform": event.platform,
        "sdk": event.sdk,
        "user": event.user,
        "user_hash": event.user_hash,
        "browser": event.browser,
        "os": event.os,
        "device": event.device,
        "ip": event.ip,
        "tags": dict(event.tags or {}),
        "extra": dict(event.extra or {}),
        "breadcrumbs": list(event.breadcrumbs or []),
        "source": event.source,
    }


def serialize_api_key(api_key) -> dict:
    """Never includes the secret — only the non-sensitive prefix."""
    return {
        "id": str(api_key.id),
        "name": api_key.name,
        "role": api_key.role,
        "prefix": api_key.prefix,
        "created_at": iso(api_key.created_at),
        "last_used_at": iso(api_key.last_used_at),
        "revoked_at": iso(api_key.revoked_at),
    }


def serialize_usage(counter, limits: dict, counts: dict) -> dict:
    limit = int(limits.get("events_per_month", -1))
    over = max(0, counter.events - limit) if limit >= 0 else 0
    return {
        "period_start": counter.period_start.isoformat(),
        "period_end": counter.period_end.isoformat(),
        "events": counter.events,
        "events_dropped": over,
        "counts": counts,
        "limits": limits,
    }


def serialize_audit_event(event) -> dict:
    return {
        "id": str(event.id),
        "ts": iso(event.ts),
        "actor_type": event.actor_type,
        "actor_id": str(event.actor_id) if event.actor_id else None,
        "actor_label": event.actor_label,
        "action": event.action,
        "target_type": event.target_type,
        "target_id": event.target_id,
        "outcome": event.outcome,
        "meta": event.meta or {},
    }
