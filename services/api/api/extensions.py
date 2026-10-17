"""Flask extensions instantiated once and wired up in the app factory.

Right now that's just the rate limiter (Flask-Limiter backed by Redis). Keeping
it here lets blueprints import the shared ``limiter`` object without importing
the application module (which would be circular).
"""
from __future__ import annotations

from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from dbcore.config import config


def _bearer(prefix: str) -> str | None:
    """The bearer token when it carries ``prefix`` (``oops_live_`` / ``oops_pub_``)."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        token = header[len("Bearer ") :].strip()
        if token.startswith(prefix):
            return token
    return None


def public_api_key_func() -> str:
    """Rate-limit key for management routes.

    When the caller authenticates with an API key we bucket the limit by that
    key; otherwise we fall back to the client IP. This way one account hammering
    the public API does not eat into another account's budget.
    """
    return request.headers.get("X-API-Key") or _bearer("oops_live_") or get_remote_address()


def ingest_key_func() -> str:
    """Rate-limit key for ingest routes: (project public key, client IP).

    Bucketing per project AND per address means one noisy client cannot
    exhaust a project's budget for everyone else, while an attacker rotating
    projects still hits the per-IP default limit.
    """
    from .auth_utils import presented_project_key

    return f"{presented_project_key() or '-'}|{get_remote_address()}"


# Default limit applies to every route. Management routes additionally apply
# `config.rate_limit_public_api` and ingest routes `config.rate_limit_ingest`
# via explicit `@limiter.limit(...)` decorators (which override the default).
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[config.rate_limit_default],
    storage_uri=config.redis_url,
    strategy="fixed-window",
    enabled=config.rate_limits_enabled,
)
