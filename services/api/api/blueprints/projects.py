"""Projects blueprint: CRUD, public-key rotation, summary and event purge.

These endpoints accept EITHER a dashboard JWT OR a management API key.
Everything is scoped to ``g.account_id`` so one account can never see
another's projects (a foreign project is a 404, never a 403), and each
endpoint declares the RBAC scope it needs. Mutations are written to the audit
log in the same transaction as the change.

Creating a project mints its public key (``oops_pub_…``, what the SDK and
server-side reporters post events with). The helpers (``get_owned_project``,
``public_limit``, ``limit_reached``) are shared with the issues blueprint.
"""
from __future__ import annotations

import uuid

from flask import Blueprint, g, jsonify, request
from sqlalchemy import delete, func, or_, select

from dbcore import audit
from dbcore.config import config
from dbcore.db import session_scope
from dbcore.models import Account, Event, Issue, IssueUser, Project
from dbcore.plans import effective_plan_limits, within_limit
from dbcore.posthog_client import capture
from dbcore.slugs import is_valid_hostname, is_valid_project_key, slugify
from dbcore.stats import project_counts, valid_timezone

from ..auth_utils import PUBLIC_KEY_PREFIX, actor, generate_secret_key, hash_token, require_auth_or_api_key, require_scope
from ..errors import ApiError
from ..extensions import limiter, public_api_key_func
from ..serializers import iso, json_body, serialize_project

bp = Blueprint("projects", __name__)

# Public-API budget applies on top of the global default limit.
public_limit = limiter.limit(config.rate_limit_public_api, key_func=public_api_key_func)

_STRING_FIELDS = {"name": 120, "description": 20000, "url": 2048}
_BOOL_FIELDS = ("ingest_enabled", "store_ip")
MAX_ALLOWED_ORIGINS = 20


# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #
def get_owned_project(session, project_id_str: str) -> Project:
    """Fetch a project by id, scoped to the current account, or 404."""
    try:
        project_id = uuid.UUID(str(project_id_str))
    except (ValueError, AttributeError):
        raise ApiError(404, "not_found", "Project not found.")
    project = session.scalar(
        select(Project).where(Project.id == project_id, Project.account_id == g.account_id)
    )
    if project is None:
        raise ApiError(404, "not_found", "Project not found.")
    return project


def limit_reached(account: Account, which: str, message: str) -> ApiError:
    """Emit the funnel event and build the 402 the contract expects."""
    capture(
        str(account.id),
        "limit_reached",
        {"which": which, "plan": account.plan},
        groups={"account": str(account.id)},
    )
    return ApiError(402, "limit_reached", message, extra={"which": which})


def _mint_public_key(project: Project) -> None:
    full_key, prefix = generate_secret_key(PUBLIC_KEY_PREFIX)
    project.public_key = full_key
    project.public_key_hash = hash_token(full_key)
    project.public_key_prefix = prefix


def _serialize_one(session, project: Project) -> dict:
    return serialize_project(project, project_counts(session, [project.id]).get(project.id))


def _clean_origins(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        raw = [part for part in raw.replace("\n", ",").split(",")]
    if not isinstance(raw, list):
        raise ApiError(400, "invalid_origins", "allowed_origins must be a list of hostnames.")
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            raise ApiError(400, "invalid_origins", "allowed_origins must be a list of hostnames.")
        host = item.strip().lower()
        if not host:
            continue
        # Accept full URLs and strip them down to the hostname.
        if "://" in host:
            from urllib.parse import urlsplit

            host = (urlsplit(host).hostname or "").lower()
        host = host.rstrip("/")
        if not is_valid_hostname(host):
            raise ApiError(400, "invalid_origins", f"'{item}' is not a valid hostname (use example.com or *.example.com).")
        if host not in out:
            out.append(host)
    if len(out) > MAX_ALLOWED_ORIGINS:
        raise ApiError(400, "invalid_origins", f"At most {MAX_ALLOWED_ORIGINS} allowed origins.")
    return out


# --------------------------------------------------------------------------- #
# List + create
# --------------------------------------------------------------------------- #
@bp.get("")
@public_limit
@require_auth_or_api_key
@require_scope("projects:read")
def list_projects():
    q = (request.args.get("q") or "").strip()
    with session_scope() as session:
        stmt = select(Project).where(Project.account_id == g.account_id)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(Project.name.ilike(like), Project.key.ilike(like), Project.url.ilike(like)))
        projects = session.scalars(stmt.order_by(Project.created_at.desc(), Project.id)).all()
        counts = project_counts(session, [p.id for p in projects])
        items = [serialize_project(p, counts.get(p.id)) for p in projects]
    return jsonify({"items": items})


@bp.post("")
@public_limit
@require_auth_or_api_key
@require_scope("projects:write")
def create_project():
    data = json_body()
    name = (data.get("name") or "").strip()
    if not name:
        raise ApiError(400, "missing_name", "name is required.")
    key = (data.get("key") or "").strip().lower() or slugify(name)
    if not is_valid_project_key(key):
        raise ApiError(400, "invalid_key", "key must match ^[a-z0-9][a-z0-9-]{0,62}$.")
    description = (data.get("description") or "").strip() or None
    url = (data.get("url") or "").strip()[:2048] or None
    tz = (data.get("timezone") or "UTC").strip()
    if not valid_timezone(tz):
        raise ApiError(400, "invalid_timezone", "timezone must be an IANA time zone name.")
    origins = _clean_origins(data.get("allowed_origins"))

    with session_scope() as session:
        account = session.get(Account, g.account_id)
        limits = effective_plan_limits(account.plan, str(account.id))
        used = session.scalar(select(func.count(Project.id)).where(Project.account_id == account.id)) or 0
        if not within_limit(used, limits["projects"]):
            raise limit_reached(account, "projects", "Project limit reached for your plan.")

        taken = session.scalar(
            select(Project.id).where(Project.account_id == account.id, Project.key == key)
        )
        if taken:
            raise ApiError(409, "key_taken", f"A project with key '{key}' already exists.")

        project = Project(
            account_id=account.id,
            key=key,
            name=name,
            description=description,
            url=url,
            timezone=tz,
            allowed_origins=origins,
            ingest_enabled=bool(data.get("ingest_enabled", True)),
            store_ip=bool(data.get("store_ip", False)),
        )
        _mint_public_key(project)
        session.add(project)
        session.flush()

        audit.record(
            session,
            account_id=account.id,
            action="project.create",
            target_type="project",
            target_id=str(project.id),
            meta={"key": key, "name": name},
            **actor(),
        )
        session.flush()
        body = serialize_project(project)

    capture(str(g.account_id), "project_created", {"plan": account.plan}, groups={"account": str(g.account_id)})
    return jsonify(body), 201


# --------------------------------------------------------------------------- #
# Get / patch / delete / rotate
# --------------------------------------------------------------------------- #
@bp.get("/<project_id>")
@public_limit
@require_auth_or_api_key
@require_scope("projects:read")
def get_project(project_id):
    with session_scope() as session:
        body = _serialize_one(session, get_owned_project(session, project_id))
    return jsonify(body)


@bp.patch("/<project_id>")
@public_limit
@require_auth_or_api_key
@require_scope("projects:write")
def patch_project(project_id):
    data = json_body()
    changed: list[str] = []
    with session_scope() as session:
        project = get_owned_project(session, project_id)

        for field, max_len in _STRING_FIELDS.items():
            if field in data:
                value = (data.get(field) or "").strip()[:max_len] or None
                if field == "name" and not value:
                    raise ApiError(400, "missing_name", "name cannot be empty.")
                setattr(project, field, value)
                changed.append(field)

        for field in _BOOL_FIELDS:
            if field in data:
                setattr(project, field, bool(data.get(field)))
                changed.append(field)

        if "timezone" in data:
            tz = (data.get("timezone") or "UTC").strip()
            if not valid_timezone(tz):
                raise ApiError(400, "invalid_timezone", "timezone must be an IANA time zone name.")
            project.timezone = tz
            changed.append("timezone")

        if "allowed_origins" in data:
            project.allowed_origins = _clean_origins(data.get("allowed_origins"))
            changed.append("allowed_origins")

        audit.record(
            session,
            account_id=g.account_id,
            action="project.update",
            target_type="project",
            target_id=str(project.id),
            meta={"key": project.key, "fields": sorted(set(changed))},
            **actor(),
        )
        session.flush()
        session.refresh(project)
        body = _serialize_one(session, project)
    return jsonify(body)


@bp.delete("/<project_id>")
@public_limit
@require_auth_or_api_key
@require_scope("projects:delete")
def delete_project(project_id):
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        audit.record(
            session,
            account_id=g.account_id,
            action="project.delete",
            target_type="project",
            target_id=str(project.id),
            meta={"key": project.key, "name": project.name},
            **actor(),
        )
        # ON DELETE CASCADE takes the issues and events with it.
        session.delete(project)
    return "", 204


@bp.post("/<project_id>/rotate-key")
@public_limit
@require_auth_or_api_key
@require_scope("projects:write")
def rotate_key(project_id):
    """Replace the public key. The old key stops working immediately: every
    snippet out there must be updated. Returns the project."""
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        old_prefix = project.public_key_prefix
        _mint_public_key(project)
        audit.record(
            session,
            account_id=g.account_id,
            action="project.rotate_key",
            target_type="project",
            target_id=str(project.id),
            meta={"key": project.key, "old_prefix": old_prefix, "new_prefix": project.public_key_prefix},
            **actor(),
        )
        session.flush()
        session.refresh(project)
        body = _serialize_one(session, project)
    return jsonify(body)


# --------------------------------------------------------------------------- #
# Summary + purge
# --------------------------------------------------------------------------- #
@bp.get("/<project_id>/summary")
@public_limit
@require_auth_or_api_key
@require_scope("projects:read")
def summary(project_id):
    """``{open_issues, events_24h, events_30d, users_30d, last_event_at}`` for
    the project cards and the MCP ``get_project`` tool."""
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        counts = project_counts(session, [project.id])[project.id]
        body = {
            "project_id": str(project.id),
            "open_issues": counts["open_issues"],
            "events_24h": counts["events_24h"],
            "events_30d": counts["events_30d"],
            "users_30d": counts["users_30d"],
            "last_event_at": iso(counts["last_event_at"]),
        }
    return jsonify(body)


@bp.delete("/<project_id>/events")
@public_limit
@require_auth_or_api_key
@require_scope("events:delete")
def purge_events(project_id):
    """Delete every event and issue of the project (and the per-issue user
    sets). The project and its key survive."""
    with session_scope() as session:
        project = get_owned_project(session, project_id)
        issue_ids = select(Issue.id).where(Issue.project_id == project.id)
        deleted_events = session.execute(delete(Event).where(Event.project_id == project.id)).rowcount or 0
        session.execute(delete(IssueUser).where(IssueUser.issue_id.in_(issue_ids)))
        deleted_issues = session.execute(delete(Issue).where(Issue.project_id == project.id)).rowcount or 0
        audit.record(
            session,
            account_id=g.account_id,
            action="events.purge",
            target_type="project",
            target_id=str(project.id),
            meta={"key": project.key, "deleted_events": int(deleted_events), "deleted_issues": int(deleted_issues)},
            **actor(),
        )
    return jsonify({"deleted_events": int(deleted_events), "deleted_issues": int(deleted_issues)})
