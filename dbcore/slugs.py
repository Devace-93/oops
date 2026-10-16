"""Project key validation and slugification.

Rule from CONTRACT.md: project keys match ``^[a-z0-9][a-z0-9-]{0,62}$`` and
are unique per account.
"""
from __future__ import annotations

import re
import unicodedata

PROJECT_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,62}$")
HOSTNAME_RE = re.compile(r"^(\*\.)?([a-z0-9-]+\.)*[a-z0-9-]+$")


def is_valid_project_key(key: str) -> bool:
    return bool(PROJECT_KEY_RE.match(key or ""))


def is_valid_hostname(host: str) -> bool:
    """``example.com``, ``app.example.com``, ``*.example.com`` or ``localhost``."""
    return bool(host) and len(host) <= 253 and bool(HOSTNAME_RE.match(host))


def slugify(name: str, max_len: int = 63) -> str:
    """``"Web App (EU)"`` -> ``"web-app-eu"``. Lowercase ASCII, dashes between
    words, trimmed to ``max_len``; empty input yields ``""`` (caller decides)."""
    text = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode()
    text = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return text[:max_len].rstrip("-")


def host_allowed(hostname: str | None, allowed: list[str] | None) -> bool:
    """True when ``hostname`` matches one of the allowed patterns (or the
    list is empty). ``*.example.com`` matches any subdomain and the apex."""
    if not allowed:
        return True
    if not hostname:
        return False
    host = hostname.lower()
    for pattern in allowed:
        pattern = (pattern or "").lower().strip()
        if not pattern:
            continue
        if pattern.startswith("*."):
            base = pattern[2:]
            if host == base or host.endswith("." + base):
                return True
        elif host == pattern:
            return True
    return False
