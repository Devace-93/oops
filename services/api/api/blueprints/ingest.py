"""Ingest blueprint (``/ingest``): what the browser SDK and server-side
reporters call, with a project public key.

Design rules:

* **Never return an error to a reporting app for business reasons.** A paused
  project, a disallowed origin or an event over the plan budget are all 202
  with ``{ok:false, reason}``; the SDK ignores the body. Only a malformed
  payload (400 ``invalid_event``), a bad key (401 ``invalid_project_key``) or
  the ``ingest-api`` kill switch (503) are errors.
* **Soft-drop limit.** Every event is metered (+1 ``events`` on the account's
  monthly counter); past the plan budget the event is counted but not stored,
  and one PostHog ``limit_reached`` event fires per period.
* **No raw user agent, and no raw IP unless the project opts in.** Both are
  used transiently for the anonymous user hash, the rate limit and the
  browser / OS / device fields; the IP is kept on the event only when
  ``Project.store_ip`` is on. See ``dbcore.privacy`` and ``dbcore.ingest``.
* ``source`` is ``sdk`` only when the ``sdk`` label is ours (``oops-js/…``);
  everything else is ``api``, whatever the payload claims.
"""
from __future__ import annotations

from datetime import datetime, timezone
from urllib.parse import urlsplit

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import Session

from dbcore.config import config
from dbcore.db import session_scope
from dbcore.ingest import MAX_BATCH, IngestError, NormalizedEvent, normalize_event
from dbcore.issues import record_event
from dbcore.models import Account, Project
from dbcore.plans import effective_plan_limits
from dbcore.posthog_client import capture
from dbcore.slugs import host_allowed
from dbcore.usage import meter_event

from ..auth_utils import require_project_key
from ..errors import ApiError
from ..extensions import ingest_key_func, limiter
from ..features import require_feature
from ..serializers import json_or_form_body

bp = Blueprint("ingest", __name__)

_ingest_limit = limiter.limit(config.rate_limit_ingest, key_func=ingest_key_func)


def client_ip() -> str | None:
    # Caddy sets X-Forwarded-For; the first hop is the client.
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.remote_addr


def _origin_host() -> str | None:
    """Hostname of the calling page from the ``Origin`` header (browsers set
    it on cross-origin POSTs; server-side callers usually send none)."""
    value = request.headers.get("Origin")
    if not value:
        return None
    try:
        host = urlsplit(value).hostname
    except ValueError:
        return None
    return host.lower() if host else None


def store_event(session: Session, project: Project, ev: NormalizedEvent, *, now: datetime | None = None) -> dict:
    """Meter and persist one normalised event. Returns the per-event result
    body: ``{ok: true, event_id, issue_id, issue_number}`` or
    ``{ok: false, reason}`` with reason paused | origin | limit."""
    if not project.ingest_enabled:
        return {"ok": False, "reason": "paused"}
    # The allowed-origins check needs a hostname to compare: the page URL's,
    # or the Origin header. A server-side call with neither cannot be
    # attributed to a host and passes.
    page_host = ev.page_host or _origin_host()
    if project.allowed_origins and page_host and not host_allowed(page_host, project.allowed_origins):
        return {"ok": False, "reason": "origin"}

    account = session.get(Account, project.account_id)
    limits = effective_plan_limits(account.plan, str(account.id))
    stored, notify = meter_event(session, account.id, limits["events_per_month"])
    if notify:
        capture(
            str(account.id),
            "limit_reached",
            {"which": "events", "plan": account.plan},
            groups={"account": str(account.id)},
        )
    if not stored:
        return {"ok": False, "reason": "limit"}

    event, issue, _created = record_event(
        session,
        project,
        ev,
        ip=client_ip(),
        user_agent=request.headers.get("User-Agent") or "",
        now=now,
    )
    return {"ok": True, "event_id": str(event.id), "issue_id": str(issue.id), "issue_number": issue.number}


def _accepted(body: dict):
    response = jsonify(body)
    response.status_code = 202
    response.headers["Cache-Control"] = "no-store"
    return response


def _load_project(session: Session) -> Project:
    project = session.get(Project, g.project_id)
    if project is None:
        raise ApiError(401, "invalid_project_key", "Missing or invalid project key.")
    return project


@bp.post("")
@bp.post("/")
@bp.post("/event")
@_ingest_limit
@require_project_key
@require_feature("ingest-api", status=503)
def ingest():
    """One event as JSON (``text/plain`` bodies are accepted so the SDK can
    post without a CORS preflight; form-encoded bodies work for curl)."""
    data = json_or_form_body()
    now = datetime.now(timezone.utc)
    try:
        ev = normalize_event(data, now=now)
    except IngestError as err:
        raise ApiError(400, err.code, err.message)
    with session_scope() as session:
        project = _load_project(session)
        body = store_event(session, project, ev, now=now)
    return _accepted(body)


@bp.post("/batch")
@_ingest_limit
@require_project_key
@require_feature("ingest-api", status=503)
def ingest_batch():
    """``{events: [ … ≤ 20 ]}`` → 202 ``{ok: true, results: [per-event result]}``.
    A malformed item is reported in its slot (``{ok:false, reason:"invalid_event"}``)
    instead of failing the whole batch; a malformed envelope is a 400."""
    data = json_or_form_body()
    events = data.get("events")
    if not isinstance(events, list) or not events:
        raise ApiError(400, "invalid_event", "Body must be {\"events\": [ ... ]} with at least one event.")
    if len(events) > MAX_BATCH:
        raise ApiError(400, "invalid_event", f"A batch holds at most {MAX_BATCH} events.")
    now = datetime.now(timezone.utc)
    results: list[dict] = []
    with session_scope() as session:
        project = _load_project(session)
        for item in events:
            try:
                ev = normalize_event(item, now=now)
            except IngestError as err:
                results.append({"ok": False, "reason": err.code, "message": err.message})
                continue
            results.append(store_event(session, project, ev, now=now))
    return _accepted({"ok": True, "results": results})
