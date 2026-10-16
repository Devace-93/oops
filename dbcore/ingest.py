"""Event payload normalisation shared by the ingest endpoints.

* ``normalize_event`` turns the SDK / API payload into a
  :class:`NormalizedEvent` (type, message, level, frames, context, user, tags,
  extra, breadcrumbs, client fingerprint) with the size caps and the
  scrubbing rules from CONTRACT.md; it raises :class:`IngestError` so the API
  layer can answer 400 ``invalid_event`` with a stable code.
* ``scrub`` / ``scrub_message`` replace secret-looking values with
  ``"[Filtered]"``: keys matching the secret pattern inside ``tags``, ``extra``,
  ``breadcrumbs[].data`` and ``user``, bearer tokens and card numbers inside
  the message.
* ``parse_user_agent`` derives browser / OS / device. The raw user agent is
  never stored. There is no bot verdict: errors from headless browsers and
  CLIs are legitimate reports.

Every helper is defensive: bad input yields ``None`` fields or a trimmed
value rather than an exception, because one weird event must never break
reporting for an app. Only "neither type nor message" is rejected.

Pure Python, no database imports: this module is unit-tested standalone.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from .stacktrace import normalize_frames, parse_stack

LEVELS = ("fatal", "error", "warning", "info")
SOURCES = ("sdk", "api")
SDK_LABEL_PREFIX = "oops-js/"

MAX_TYPE = 200
MAX_MESSAGE = 4096
MAX_STACK = 16 * 1024
MAX_URL = 2048
MAX_HOST = 255
MAX_ENVIRONMENT = 40
MAX_RELEASE = 100
MAX_PLATFORM = 30
MAX_SDK = 60
MAX_TAGS = 20
MAX_TAG_KEY = 40
MAX_TAG_VALUE = 200
MAX_EXTRA_BYTES = 8 * 1024
MAX_BREADCRUMBS = 30
MAX_BREADCRUMBS_BYTES = 8 * 1024
MAX_BREADCRUMB_MESSAGE = 500
MAX_BREADCRUMB_CATEGORY = 60
MAX_FINGERPRINT_PARTS = 5
MAX_FINGERPRINT_PART = 100
MAX_USER_ID = 120
MAX_USER_EMAIL = 255
MAX_USER_NAME = 120
MAX_BATCH = 20
MAX_CLOCK_SKEW = timedelta(minutes=5)

FILTERED = "[Filtered]"

_SECRET_KEY = re.compile(r"password|passwd|secret|token|authorization|cookie|api[_-]?key|card|cvv|ssn", re.I)
_BEARER = re.compile(r"\b[Bb]earer\s+[A-Za-z0-9\-._~+/]{4,}=*")
# 13-19 digits, optionally separated by spaces or dashes; validated with Luhn
# so order numbers and timestamps are not filtered by mistake.
_CARD = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")

_LEVEL_ALIASES = {
    "fatal": "fatal", "critical": "fatal", "crit": "fatal", "alert": "fatal", "emergency": "fatal",
    "error": "error", "err": "error", "exception": "error",
    "warning": "warning", "warn": "warning",
    "info": "info", "information": "info", "notice": "info", "log": "info", "debug": "info", "trace": "info",
}


class IngestError(ValueError):
    """Validation failure with a stable error code (``400`` at the API layer)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class NormalizedEvent:
    type: str | None
    message: str
    level: str
    frames: list[dict]
    stack_raw: str | None
    url: str | None
    path: str | None
    hostname: str | None
    release: str | None
    environment: str
    platform: str | None
    sdk: str | None
    user: dict | None
    tags: dict
    extra: dict
    breadcrumbs: list[dict]
    fingerprint: list[str] | None
    ts: datetime | None            # client timestamp when trustworthy, else None (server time)
    source: str
    page_host: str | None = field(default=None)  # hostname for the allowed-origins check


# --------------------------------------------------------------------------- #
# Small coercions
# --------------------------------------------------------------------------- #
def _opt_str(value, max_len: int) -> str | None:
    if value is None or isinstance(value, (dict, list)):
        return None
    text = str(value).strip()
    return text[:max_len] if text else None


def _json_size(value) -> int:
    try:
        return len(json.dumps(value, separators=(",", ":"), default=str).encode())
    except (TypeError, ValueError):
        return MAX_EXTRA_BYTES + 1


def _luhn_ok(digits: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(digits)):
        n = int(char)
        if index % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def _card_sub(match: re.Match) -> str:
    digits = re.sub(r"\D", "", match.group(0))
    return FILTERED if _luhn_ok(digits) else match.group(0)


# --------------------------------------------------------------------------- #
# Scrubbing
# --------------------------------------------------------------------------- #
def is_secret_key(key) -> bool:
    return bool(_SECRET_KEY.search(str(key)))


def scrub(value, depth: int = 0):
    """Recursively replace the value of every secret-looking key with
    ``"[Filtered]"``. Lists are walked; scalars pass through. Nesting deeper
    than 8 levels is cut off (``"[Truncated]"``) to bound the work."""
    if depth > 8:
        return "[Truncated]"
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            key_text = str(key)
            out[key_text] = FILTERED if is_secret_key(key_text) else scrub(item, depth + 1)
        return out
    if isinstance(value, list):
        return [scrub(item, depth + 1) for item in value]
    return value


def scrub_message(text: str) -> str:
    """Replace bearer tokens and (Luhn-valid) card numbers inside free text."""
    if not text:
        return text
    text = _BEARER.sub(f"Bearer {FILTERED}", text)
    text = _CARD.sub(_card_sub, text)
    return text


# --------------------------------------------------------------------------- #
# Field normalisers
# --------------------------------------------------------------------------- #
def normalize_level(value) -> str:
    text = str(value or "").strip().lower()
    return _LEVEL_ALIASES.get(text, "error")


def parse_timestamp(value, *, now: datetime | None = None) -> datetime | None:
    """Client ``ts`` (ISO 8601, or epoch seconds / milliseconds) when it is
    within 5 minutes of the server clock; otherwise None (= use server time)."""
    if value is None or value == "":
        return None
    now = now or datetime.now(timezone.utc)
    parsed: datetime | None = None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        seconds = float(value)
        if seconds > 1e11:  # milliseconds
            seconds /= 1000.0
        try:
            parsed = datetime.fromtimestamp(seconds, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    elif isinstance(value, str):
        text = value.strip()
        if text.endswith("Z") or text.endswith("z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
    else:
        return None
    if abs(parsed - now) > MAX_CLOCK_SKEW:
        return None
    return parsed.astimezone(timezone.utc)


def split_url(raw) -> tuple[str | None, str | None, str | None]:
    """``(url, path, hostname)`` with the query string and fragment dropped.
    A bare path (``/checkout``) yields ``(path, path, None)``."""
    if not isinstance(raw, str):
        return None, None, None
    text = raw.strip()
    if not text:
        return None, None, None
    try:
        parts = urlsplit(text)
    except ValueError:
        return None, None, None
    path = parts.path or "/"
    host = (parts.hostname or "").lower()[:MAX_HOST] or None
    if parts.scheme and parts.netloc:
        url = f"{parts.scheme}://{parts.netloc}{path}"
    elif host:
        url = f"//{parts.netloc}{path}"
    else:
        url = path
    return url[:MAX_URL], path[:MAX_URL], host


def normalize_user(raw) -> dict | None:
    """``{id?, email?, name?}`` with caps; a bare string is the id."""
    if raw is None:
        return None
    if isinstance(raw, (str, int)):
        raw = {"id": raw}
    if not isinstance(raw, dict):
        return None
    out: dict = {}
    user_id = _opt_str(raw.get("id"), MAX_USER_ID)
    email = _opt_str(raw.get("email"), MAX_USER_EMAIL)
    name = _opt_str(raw.get("name") or raw.get("username"), MAX_USER_NAME)
    if user_id is not None:
        out["id"] = user_id
    if email is not None:
        out["email"] = email
    if name is not None:
        out["name"] = name
    if not out:
        return None
    return scrub(out)


def normalize_tags(raw) -> dict:
    """At most 20 ``str → str`` pairs (key ≤ 40, value ≤ 200), secrets filtered."""
    if not isinstance(raw, dict):
        return {}
    out: dict = {}
    for key, value in raw.items():
        key_text = str(key).strip()[:MAX_TAG_KEY]
        if not key_text or isinstance(value, (dict, list)):
            continue
        if value is None:
            continue
        if isinstance(value, bool):
            value = "true" if value else "false"
        out[key_text] = FILTERED if is_secret_key(key_text) else str(value)[:MAX_TAG_VALUE]
        if len(out) >= MAX_TAGS:
            break
    return out


def normalize_extra(raw) -> dict:
    """Scrubbed ``extra`` object trimmed to 8 KB of JSON: the largest keys go
    first and ``_truncated`` lists what was removed."""
    if not isinstance(raw, dict):
        return {}
    extra = scrub(raw)
    if _json_size(extra) <= MAX_EXTRA_BYTES:
        return extra
    sized = sorted(((_json_size(v), k) for k, v in extra.items()), reverse=True)
    removed: list[str] = []
    for _, key in sized:
        removed.append(str(key))
        extra.pop(key, None)
        extra["_truncated"] = removed
        if _json_size(extra) <= MAX_EXTRA_BYTES:
            break
    return extra


def _breadcrumb(item: dict) -> dict:
    crumb: dict = {
        "category": _opt_str(item.get("category"), MAX_BREADCRUMB_CATEGORY) or "default",
    }
    ts = item.get("ts") if item.get("ts") is not None else item.get("timestamp")
    if ts is not None and not isinstance(ts, (dict, list)):
        crumb["ts"] = str(ts)[:40]
    message = _opt_str(item.get("message"), MAX_BREADCRUMB_MESSAGE)
    if message is not None:
        crumb["message"] = scrub_message(message)
    if item.get("level") is not None:
        crumb["level"] = normalize_level(item.get("level"))
    data = item.get("data")
    if isinstance(data, dict) and data:
        crumb["data"] = scrub(data)
    return crumb


def normalize_breadcrumbs(raw) -> list[dict]:
    """The last 30 breadcrumbs, scrubbed, within 8 KB (oldest dropped first)."""
    if not isinstance(raw, list):
        return []
    crumbs = [_breadcrumb(item) for item in raw if isinstance(item, dict)][-MAX_BREADCRUMBS:]
    while crumbs and _json_size(crumbs) > MAX_BREADCRUMBS_BYTES:
        crumbs.pop(0)
    return crumbs


def normalize_fingerprint(raw) -> list[str] | None:
    """Client fingerprint: ≤ 5 string parts of ≤ 100 chars, or None."""
    if raw is None:
        return None
    if isinstance(raw, (str, int)):
        raw = [raw]
    if not isinstance(raw, list):
        return None
    parts = []
    for item in raw:
        if isinstance(item, (dict, list)) or item is None:
            continue
        text = str(item).strip()[:MAX_FINGERPRINT_PART]
        if text:
            parts.append(text)
        if len(parts) >= MAX_FINGERPRINT_PARTS:
            break
    return parts or None


def normalize_source(data: dict, sdk: str | None) -> str:
    """``sdk`` when the ``sdk`` label is ours (``oops-js/…``), ``api`` for
    everything else. The browser SDK sends no ``source`` field, so the label
    decides; a client-sent ``source`` is ignored."""
    if sdk and sdk.startswith(SDK_LABEL_PREFIX):
        return "sdk"
    return "api"


# --------------------------------------------------------------------------- #
# The whole payload
# --------------------------------------------------------------------------- #
def normalize_event(data, *, now: datetime | None = None) -> NormalizedEvent:
    """Validate and cap one event payload (see CONTRACT.md). Raises
    :class:`IngestError` (``invalid_event``) when the payload is not an object
    or carries neither ``type`` nor ``message``."""
    if not isinstance(data, dict):
        raise IngestError("invalid_event", "Event payload must be a JSON object.")

    type_ = _opt_str(data.get("type") or data.get("name"), MAX_TYPE)
    raw_message = data.get("message")
    if raw_message is None:
        raw_message = data.get("value")
    if isinstance(raw_message, (dict, list)):
        raw_message = json.dumps(raw_message, separators=(",", ":"), default=str)
    message = str(raw_message).strip()[:MAX_MESSAGE] if raw_message is not None else ""
    if not type_ and not message:
        raise IngestError("invalid_event", "An event needs a type or a message.")
    message = scrub_message(message)

    raw_stack = data.get("stack")
    stack_raw = str(raw_stack)[:MAX_STACK] if isinstance(raw_stack, str) and raw_stack.strip() else None
    frames = normalize_frames(data.get("frames"))
    if not frames and stack_raw:
        frames = parse_stack(stack_raw)

    url, path, hostname = split_url(data.get("url"))
    sdk = _opt_str(data.get("sdk"), MAX_SDK)

    return NormalizedEvent(
        type=type_,
        message=message,
        level=normalize_level(data.get("level")),
        frames=frames,
        stack_raw=stack_raw,
        url=url,
        path=path,
        hostname=hostname,
        release=_opt_str(data.get("release"), MAX_RELEASE),
        environment=_opt_str(data.get("environment") or data.get("env"), MAX_ENVIRONMENT) or "production",
        platform=_opt_str(data.get("platform"), MAX_PLATFORM),
        sdk=sdk,
        user=normalize_user(data.get("user")),
        tags=normalize_tags(data.get("tags")),
        extra=normalize_extra(data.get("extra")),
        breadcrumbs=normalize_breadcrumbs(data.get("breadcrumbs")),
        fingerprint=normalize_fingerprint(data.get("fingerprint")),
        ts=parse_timestamp(data.get("ts") if data.get("ts") is not None else data.get("timestamp"), now=now),
        source=normalize_source(data, sdk),
        page_host=hostname,
    )


# --------------------------------------------------------------------------- #
# User agent
# --------------------------------------------------------------------------- #
def parse_user_agent(ua_string: str | None) -> dict:
    """``{browser, os, device}`` from a UA string; ``device`` is desktop |
    mobile | tablet (None when unknown, e.g. curl or a Node runtime). No bot
    filter: a crawler or a CLI that hits an error is still an error."""
    empty = {"browser": None, "os": None, "device": None}
    if not ua_string:
        return empty
    try:
        from user_agents import parse as parse_ua

        ua = parse_ua(ua_string[:512])
    except Exception:
        return empty

    if ua.is_mobile:
        device = "mobile"
    elif ua.is_tablet:
        device = "tablet"
    elif ua.is_pc:
        device = "desktop"
    else:
        device = None

    os_family = ua.os.family if ua.os.family and ua.os.family != "Other" else None
    browser_family = ua.browser.family if ua.browser.family and ua.browser.family != "Other" else None
    return {
        "browser": (browser_family or "")[:40] or None,
        "os": (os_family or "")[:40] or None,
        "device": device,
    }
