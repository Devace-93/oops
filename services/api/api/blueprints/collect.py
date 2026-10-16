"""Collect blueprint (``/collect``): what the tracker script, the pixel and
server-side clients call, with a project public key.

Design rules:

* **Never break the host page.** Everything that is not a malformed request
  answers 202 (or the GIF): a paused project, a disallowed origin, a bot, a
  hit over the plan budget. The JSON body says why, the tracker ignores it.
* **Soft-drop limit.** Every hit is metered (+1 ``events`` on the account's
  monthly counter); past the plan budget the hit is counted but not stored,
  and one PostHog ``limit_reached`` event fires per period.
* **No raw user agent, and no raw IP unless the project opts in.** Both are
  used transiently for the daily visitor hash, the rate limit, the device /
  browser / OS fields and the geo lookup; the IP is kept on the event only
  when ``Project.store_ip`` is on. See ``dbcore.privacy`` and ``dbcore.events``.
* ``collect-api`` OFF is an emergency kill switch (503).
"""
from __future__ import annotations

from flask import Blueprint, Response, g, jsonify, request
from sqlalchemy.orm import Session

from dbcore.config import config
from dbcore.db import session_scope
from dbcore.events import SOURCES, Hit, HitError, geo_lookup, normalize_hit, parse_user_agent
from dbcore.feature_flags import is_enabled
from dbcore.models import Account, Event, Project
from dbcore.plans import effective_plan_limits
from dbcore.posthog_client import capture
from dbcore.privacy import ip_hash, visitor_hash
from dbcore.slugs import host_allowed
from dbcore.usage import meter_event

from ..auth_utils import require_project_key
from ..errors import ApiError
from ..extensions import collect_key_func, limiter
from ..features import require_feature
from ..serializers import json_or_form_body

bp = Blueprint("collect", __name__)

_collect_limit = limiter.limit(config.rate_limit_collect, key_func=collect_key_func)

# 1x1 transparent GIF (43 bytes).
PIXEL = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04\x01\x00\x00\x00\x00"
    b"\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


def client_ip() -> str | None:
    # Caddy sets X-Forwarded-For; the first hop is the client.
    forwarded = request.headers.get("X-Forwarded-For", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.remote_addr


def _origin_host() -> str | None:
    """Hostname of the calling page from the ``Origin`` header (browsers set
    it on cross-origin POSTs) or the ``Referer`` header (pixel)."""
    from urllib.parse import urlsplit

    for header in ("Origin", "Referer"):
        value = request.headers.get(header)
        if value:
            try:
                host = urlsplit(value).hostname
            except ValueError:
                host = None
            if host:
                return host.lower()
    return None


def store_hit(session: Session, project: Project, hit: Hit, *, source: str) -> tuple[bool, str | None]:
    """Meter and persist one hit. Returns ``(stored, reason)`` where ``reason``
    explains a drop: paused | origin | bot | limit."""
    if not project.collect_enabled:
        return False, "paused"
    # The allowed-origins check needs a hostname to compare: the page URL's, or
    # the Origin / Referer header. A bare path with neither (a pixel in an
    # email, a server-side call) cannot be attributed to a host and passes.
    page_host = hit.hostname or _origin_host()
    if project.allowed_origins and page_host and not host_allowed(page_host, project.allowed_origins):
        return False, "origin"

    ua = request.headers.get("User-Agent") or ""
    ua_info = parse_user_agent(ua)
    if ua_info["is_bot"] and project.exclude_bots:
        return False, "bot"

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
        return False, "limit"

    ip = client_ip()
    geo = geo_lookup(ip) if is_enabled("geo", str(account.id)) else {"country": None, "region": None, "city": None}
    session.add(
        Event(
            project_id=project.id,
            kind=hit.kind,
            name=hit.name,
            hostname=hit.hostname,
            path=hit.path,
            title=hit.title,
            referrer=hit.referrer,
            referrer_host=hit.referrer_host,
            utm_source=hit.utm_source,
            utm_medium=hit.utm_medium,
            utm_campaign=hit.utm_campaign,
            country=geo["country"],
            region=geo["region"],
            city=geo["city"],
            device=ua_info["device"],
            browser=ua_info["browser"],
            os=ua_info["os"],
            screen_w=hit.screen_w,
            screen_h=hit.screen_h,
            lang=hit.lang,
            visitor_hash=visitor_hash(project.id, ip, ua),
            ip_hash=ip_hash(ip),
            ip=(ip or "")[:45] or None if project.store_ip else None,
            source=source,
            props=hit.props,
        )
    )
    return True, None


def _source(data: dict, default: str) -> str:
    source = str(data.get("s") or data.get("source") or default).strip().lower()
    return source if source in SOURCES else default


@bp.post("")
@bp.post("/")
@bp.post("/event")
@_collect_limit
@require_project_key
@require_feature("collect-api", status=503)
def collect():
    """One hit (page view or custom event) as JSON. ``text/plain`` bodies are
    accepted so the tracker can post without a CORS preflight."""
    data = json_or_form_body()
    with session_scope() as session:
        project = session.get(Project, g.project_id)
        if project is None:
            raise ApiError(401, "invalid_project_key", "Missing or invalid project key.")
        try:
            hit = normalize_hit(data)
        except HitError as err:
            raise ApiError(400, err.code, err.message)
        stored, reason = store_hit(session, project, hit, source=_source(data, "script"))
    body = {"ok": stored}
    if reason:
        body["reason"] = reason
    response = jsonify(body)
    response.status_code = 202
    response.headers["Cache-Control"] = "no-store"
    return response


@bp.get("/pixel.gif")
@_collect_limit
@require_project_key
@require_feature("collect-api", status=503)
def pixel():
    """No-JavaScript tracking: ``<img src=".../api/collect/pixel.gif?k=…&u=/path">``.
    The page URL falls back to the ``Referer`` header. Always answers the GIF."""
    data = {k: v for k, v in request.args.items()}
    with session_scope() as session:
        project = session.get(Project, g.project_id)
        if project is not None:
            try:
                hit = normalize_hit(data, fallback_url=request.headers.get("Referer"))
                store_hit(session, project, hit, source="pixel")
            except HitError:
                pass
    response = Response(PIXEL, mimetype="image/gif")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response
