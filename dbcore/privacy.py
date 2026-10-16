"""IP and user hashing. oops never stores a raw IP address by default.

``ip_hash(ip)`` = sha256(ip + ":" + daily_salt) where
``daily_salt`` = sha256(IP_HASH_SECRET + ":" + YYYY-MM-DD). The salt rotates
every UTC day, so a hash can only ever be correlated within one day — enough
for rate limits and for counting anonymous users per day, and useless for
tracking people across time.

Two "who was affected" identities exist on an event:

* ``user_hash(project_id, user_id)`` when the reporting app told us who its
  user is (``user.id`` in the payload). Stable across days, scoped to the
  project, so "affected users" on an issue is exact for identified traffic.
* ``visitor_hash(project_id, ip, user_agent)`` otherwise: the per-project,
  cookie-less daily hash of (IP, user agent). Anonymous users therefore count
  once per day.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from .config import config


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def daily_salt(day: str | None = None) -> str:
    return hashlib.sha256(f"{config.ip_hash_secret}:{day or _today()}".encode()).hexdigest()


def ip_hash(ip: str | None) -> str | None:
    """Daily-salted sha256 hex digest of ``ip`` (None for a missing address)."""
    if not ip:
        return None
    return hashlib.sha256(f"{ip}:{daily_salt()}".encode()).hexdigest()


def visitor_hash(project_id, ip: str | None, user_agent: str | None) -> str:
    """Daily, per-project, cookie-less anonymous user id."""
    raw = f"{daily_salt()}:{project_id}:{ip or ''}:{user_agent or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()


def user_hash(project_id, user_id: str) -> str:
    """Stable per-project hash of the client's own ``user.id``."""
    return hashlib.sha256(f"{project_id}:{user_id}".encode()).hexdigest()
