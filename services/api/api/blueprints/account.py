"""Account blueprint: usage counters and the audit log.

Both endpoints accept a dashboard JWT or an API key with the matching scope.
"""
from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, select

from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import Account, AuditEvent
from dbcore.plans import effective_plan_limits
from dbcore.usage import get_or_create_counter

from ..auth_utils import require_auth_or_api_key, require_scope
from ..errors import ApiError
from ..extensions import limiter, public_api_key_func
from ..serializers import paged, serialize_audit_event, serialize_usage
from .auth import account_counts

bp = Blueprint("account", __name__)

_public_limit = limiter.limit(config.rate_limit_public_api, key_func=public_api_key_func)
MAX_PER_PAGE = 200


@bp.get("/usage")
@_public_limit
@require_auth_or_api_key
@require_scope("usage:read")
def usage():
    with session_scope() as session:
        account = session.get(Account, g.account_id)
        if account is None:
            raise ApiError(404, "not_found", "Account not found.")
        limits = effective_plan_limits(account.plan, str(account.id))
        counter = get_or_create_counter(session, account.id)
        body = serialize_usage(counter, limits, account_counts(session, account.id))
    return jsonify(body)


def _int_arg(name: str, default: int, lo: int, hi: int) -> int:
    try:
        value = int(request.args.get(name, default))
    except (TypeError, ValueError):
        value = default
    return min(max(value, lo), hi)


def _parse_since(raw: str) -> datetime:
    text = raw.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        raise ApiError(400, "invalid_since", "since must be an ISO-8601 date or datetime.")
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


@bp.get("/audit")
@_public_limit
@require_auth_or_api_key
@require_scope("audit:read")
def audit_log():
    """Paged audit events for the account, newest first. Filters ``action``,
    ``actor_type``, ``outcome``, ``since``. ``limit`` is accepted as an alias
    of ``per_page``."""
    page = _int_arg("page", 1, 1, 100000)
    per_page = _int_arg("per_page", _int_arg("limit", 50, 1, MAX_PER_PAGE), 1, MAX_PER_PAGE)
    action = (request.args.get("action") or "").strip()
    actor_type = (request.args.get("actor_type") or "").strip()
    outcome = (request.args.get("outcome") or "").strip()
    since_raw = (request.args.get("since") or "").strip()

    with session_scope() as session:
        where = [AuditEvent.account_id == g.account_id]
        if action:
            where.append(AuditEvent.action == action)
        if actor_type:
            where.append(AuditEvent.actor_type == actor_type)
        if outcome:
            where.append(AuditEvent.outcome == outcome)
        if since_raw:
            where.append(AuditEvent.ts >= _parse_since(since_raw))
        total = session.scalar(select(func.count(AuditEvent.id)).where(*where)) or 0
        rows = session.scalars(
            select(AuditEvent).where(*where).order_by(AuditEvent.ts.desc(), AuditEvent.id).limit(per_page).offset((page - 1) * per_page)
        ).all()
        body = paged([serialize_audit_event(r) for r in rows], page, per_page, total)
    return jsonify(body)
