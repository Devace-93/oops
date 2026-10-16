"""IP hashing. oops never stores a raw IP address.

``ip_hash(ip)`` = sha256(ip + ":" + daily_salt) where
``daily_salt`` = sha256(IP_HASH_SECRET + ":" + YYYY-MM-DD). The salt rotates
every UTC day, so a hash can only ever be correlated within one day — enough
for rate limits and for counting unique visitors per day, and useless for
tracking people across time.

``visitor_hash(project_id, ip, user_agent)`` is the per-project daily visitor
id (the same idea Plausible and Fathom use): no cookie, no localStorage, no
cross-site or cross-day identity. "Unique visitors" over a range longer than a
day is therefore the sum of daily uniques, and the dashboard says so.
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
    """Daily, per-project, cookie-less visitor id."""
    raw = f"{daily_salt()}:{project_id}:{ip or ''}:{user_agent or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()
