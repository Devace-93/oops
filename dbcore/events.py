"""Hit normalisation and enrichment shared by the collect endpoints.

* ``normalize_hit`` turns the tracker / pixel payload into a :class:`Hit`
  (page path, hostname, referrer, UTM tags, screen, language, custom event
  name and props) with the size caps from CONTRACT.md; it raises
  :class:`HitError` so the API layer can answer 400 with a stable code.
* ``parse_user_agent`` derives device / OS / browser and a bot verdict. The
  raw user agent is never stored.
* ``geo_lookup`` resolves the (never stored) client IP to country / region /
  city with the optional GeoLite2 database.

Every helper is defensive: bad input yields ``None`` fields rather than an
exception, because one weird hit must never break tracking for a site.
"""
from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

from .config import config

KINDS = ("pageview", "event")
SOURCES = ("script", "pixel", "api")
DEVICES = ("desktop", "mobile", "tablet", "bot")

MAX_PATH = 2048
MAX_HOST = 255
MAX_TITLE = 200
MAX_REFERRER = 2048
MAX_NAME = 60
MAX_UTM = 100
MAX_LANG = 16
MAX_PROPS_BYTES = 2 * 1024
MAX_SCREEN = 20000

_NAME_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_ .:/-]{0,59}$")
# Crawlers, monitors and headless browsers that the ua-parser bot list misses.
_BOT_RE = re.compile(
    r"bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|preview|"
    r"facebookexternalhit|embedly|quora link|curl/|wget/|python-requests|python-urllib|"
    r"go-http-client|java/|okhttp|libwww|httpclient|scrapy|phantomjs|puppeteer|playwright",
    re.I,
)


class HitError(ValueError):
    """Validation failure with a stable error code (``400`` at the API layer)."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Hit:
    kind: str
    name: str | None
    hostname: str | None
    path: str
    title: str | None
    referrer: str | None
    referrer_host: str | None
    utm_source: str | None
    utm_medium: str | None
    utm_campaign: str | None
    screen_w: int | None
    screen_h: int | None
    lang: str | None
    props: dict


def _opt_str(value, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:max_len] if text else None


def _opt_int(value, max_value: int) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    if n <= 0 or n > max_value:
        return None
    return n


def split_url(raw: str | None) -> tuple[str | None, str, str]:
    """``(hostname, path, query)`` from a full URL or a bare path.

    Query strings are only used to read UTM tags; they are never stored, so a
    token or an email in a URL cannot leak into the dashboard.
    """
    text = (raw or "").strip()
    if not text:
        return None, "/", ""
    if text.startswith("/"):
        parts = urlsplit(text)
        return None, (parts.path or "/")[:MAX_PATH], parts.query
    try:
        parts = urlsplit(text)
    except ValueError:
        return None, "/", ""
    host = (parts.hostname or "").lower()[:MAX_HOST] or None
    path = (parts.path or "/")[:MAX_PATH]
    return host, path, parts.query


def _utm(query: str) -> tuple[str | None, str | None, str | None]:
    if not query:
        return None, None, None
    try:
        params = parse_qs(query, keep_blank_values=False)
    except ValueError:
        return None, None, None

    def first(key: str) -> str | None:
        values = params.get(key) or []
        return _opt_str(values[0], MAX_UTM) if values else None

    return first("utm_source"), first("utm_medium"), first("utm_campaign")


def parse_props(raw) -> dict:
    """``props`` as a dict (the pixel sends a JSON string); capped at 2 KB."""
    if raw is None or raw == "":
        return {}
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            raise HitError("invalid_props", "props must be a JSON object.")
    if not isinstance(raw, dict):
        raise HitError("invalid_props", "props must be a JSON object.")
    if len(json.dumps(raw, separators=(",", ":")).encode()) > MAX_PROPS_BYTES:
        raise HitError("props_too_large", "props must be at most 2 KB of JSON.")
    return raw


def normalize_hit(data: dict, *, fallback_url: str | None = None) -> Hit:
    """Validate a collect payload. Short keys are what the tracker sends
    (``n`` name, ``u`` url, ``r`` referrer, ``t`` title, ``w``/``h`` screen,
    ``l`` language, ``p`` props); long keys are accepted for hand-written
    clients."""
    name = (data.get("n") or data.get("name") or "pageview")
    name = str(name).strip()
    if name.lower() == "pageview":
        kind, name = "pageview", None
    else:
        if len(name) > MAX_NAME or not _NAME_RE.match(name):
            raise HitError("invalid_name", "Event names are 1-60 letters, digits, spaces, _ . : / or -.")
        kind = "event"

    url = data.get("u") or data.get("url") or fallback_url
    hostname, path, query = split_url(url if isinstance(url, str) else None)
    utm_source, utm_medium, utm_campaign = _utm(query)

    referrer = referrer_host = None
    raw_ref = data.get("r") or data.get("referrer")
    if isinstance(raw_ref, str) and raw_ref.strip():
        ref_host, ref_path, _ = split_url(raw_ref)
        # Internal navigation and same-site reloads are not a referral.
        if ref_host and ref_host != hostname:
            referrer_host = ref_host
            scheme = "https" if raw_ref.strip().lower().startswith("https") else "http"
            referrer = f"{scheme}://{ref_host}{ref_path}"[:MAX_REFERRER]

    props = parse_props(data.get("p") if "p" in data else data.get("props")) if kind == "event" else {}

    return Hit(
        kind=kind,
        name=name,
        hostname=hostname,
        path=path,
        title=_opt_str(data.get("t") or data.get("title"), MAX_TITLE),
        referrer=referrer,
        referrer_host=referrer_host,
        utm_source=utm_source,
        utm_medium=utm_medium,
        utm_campaign=utm_campaign,
        screen_w=_opt_int(data.get("w") or data.get("screen_w"), MAX_SCREEN),
        screen_h=_opt_int(data.get("h") or data.get("screen_h"), MAX_SCREEN),
        lang=_opt_str(data.get("l") or data.get("lang"), MAX_LANG),
        props=props,
    )


# --------------------------------------------------------------------------- #
# User agent
# --------------------------------------------------------------------------- #
def parse_user_agent(ua_string: str | None) -> dict:
    """``{device, os, browser, is_bot}`` from a UA string.

    ``device`` is one of desktop | mobile | tablet | bot (None when unknown).
    """
    empty = {"device": None, "os": None, "browser": None, "is_bot": False}
    if not ua_string:
        return empty
    try:
        from user_agents import parse as parse_ua

        ua = parse_ua(ua_string[:512])
    except Exception:
        return {**empty, "is_bot": bool(_BOT_RE.search(ua_string))}

    is_bot = bool(ua.is_bot or _BOT_RE.search(ua_string))
    if is_bot:
        device = "bot"
    elif ua.is_mobile:
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
        "device": device,
        "os": (os_family or "")[:40] or None,
        "browser": (browser_family or "")[:40] or None,
        "is_bot": is_bot,
    }


# --------------------------------------------------------------------------- #
# Geo
# --------------------------------------------------------------------------- #
_geo_reader = None
_geo_init_done = False


def _get_geo_reader():
    """Lazily open the GeoLite2 reader. Returns None if unavailable."""
    global _geo_reader, _geo_init_done
    if _geo_init_done:
        return _geo_reader
    _geo_init_done = True
    try:
        import geoip2.database

        if config.geoip_db_path and os.path.isfile(config.geoip_db_path):
            _geo_reader = geoip2.database.Reader(config.geoip_db_path)
    except Exception:
        _geo_reader = None
    return _geo_reader


def geo_available() -> bool:
    return _get_geo_reader() is not None


def geo_lookup(ip: str | None) -> dict:
    """Resolve an IP to ``{country, region, city}``. All-None when unavailable.

    The raw IP is only used here, transiently, and is never persisted.
    """
    empty = {"country": None, "region": None, "city": None}
    if not ip:
        return empty
    reader = _get_geo_reader()
    if reader is None:
        return empty
    try:
        resp = reader.city(ip)
    except Exception:
        return empty
    region = resp.subdivisions.most_specific.name if resp.subdivisions else None
    return {
        "country": resp.country.iso_code,
        "region": (region or "")[:100] or None,
        "city": (resp.city.name or "")[:100] or None,
    }
