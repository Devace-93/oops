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
    """JSON object when the request is JSON (any content type: the tracker
    posts ``text/plain`` to avoid a CORS preflight), otherwise the form
    fields, otherwise the query string."""
    if request.is_json:
        return json_body()
    data = request.get_json(silent=True, force=True)
    if isinstance(data, dict):
        return data
    if request.form:
        return {k: v for k, v in request.form.items()}
    return {k: v for k, v in request.args.items()}


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
        "collect_enabled": project.collect_enabled,
        "exclude_bots": project.exclude_bots,
        "store_ip": project.store_ip,
        "counts": {
            "pageviews_30d": counts.get("pageviews_30d", 0),
            "visitors_30d": counts.get("visitors_30d", 0),
            "pageviews_today": counts.get("pageviews_today", 0),
            "last_event_at": iso(counts.get("last_event_at")),
        },
        "created_at": iso(project.created_at),
        "updated_at": iso(project.updated_at),
    }


def serialize_event(event) -> dict:
    """Exactly the CONTRACT.md "Event" shape. No hashes beyond a short visitor id;
    ``ip`` is null unless the project stores addresses."""
    return {
        "id": event.id,
        "ts": iso(event.ts),
        "kind": event.kind,
        "name": event.name,
        "hostname": event.hostname,
        "path": event.path,
        "title": event.title,
        "referrer": event.referrer,
        "referrer_host": event.referrer_host,
        "utm_source": event.utm_source,
        "utm_medium": event.utm_medium,
        "utm_campaign": event.utm_campaign,
        "country": event.country,
        "region": event.region,
        "city": event.city,
        "device": event.device,
        "browser": event.browser,
        "os": event.os,
        "screen_w": event.screen_w,
        "screen_h": event.screen_h,
        "lang": event.lang,
        "visitor": (event.visitor_hash or "")[:8],
        "ip": event.ip,
        "source": event.source,
        "props": event.props or {},
    }


def serialize_api_key(api_key) -> dict:
    """Never includes the secret — only the non-sensitive prefix."""
    return {
        "id": str(api_key.id),
        "name": api_key.name,
        "prefix": api_key.prefix,
        "role": api_key.role,
        "last_used_at": iso(api_key.last_used_at),
        "created_at": iso(api_key.created_at),
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
