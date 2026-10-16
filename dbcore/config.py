"""Environment-driven configuration. No secrets in code."""
from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    # database / cache
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://oops:oops@localhost:5432/oops",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # auth
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "dev-insecure-change-me")
    access_token_ttl_min: int = int(os.getenv("ACCESS_TOKEN_TTL_MIN", "30"))
    refresh_token_ttl_days: int = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "30"))

    # urls
    app_base_url: str = os.getenv("APP_BASE_URL", "http://localhost:8084")
    dashboard_url: str = os.getenv("DASHBOARD_URL", "http://localhost:8084")

    # billing
    billing_enabled: bool = _bool("BILLING_ENABLED", True)
    revenuecat_webhook_token: str = os.getenv("REVENUECAT_WEBHOOK_AUTH_TOKEN", "")
    revenuecat_api_key: str = os.getenv("REVENUECAT_SECRET_API_KEY", "")

    # posthog
    posthog_api_key: str = os.getenv("POSTHOG_API_KEY", "")
    posthog_host: str = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")
    # Personal API key enables local evaluation of feature flags (no network
    # in the request path). Without it, flags fall back to registry defaults.
    posthog_personal_api_key: str = os.getenv("POSTHOG_PERSONAL_API_KEY", "")
    # One PostHog project is shared with the other 3m4 apps, so oops' own
    # feature switches live there under a prefixed key (``oops-signups`` ...).
    # Registry keys (packages/shared/feature_flags.json) stay unprefixed.
    posthog_flag_prefix: str = os.getenv("POSTHOG_FLAG_PREFIX", "oops-")

    # rate limiting
    rate_limit_default: str = os.getenv("RATE_LIMIT_DEFAULT", "120/minute")
    rate_limit_public_api: str = os.getenv("RATE_LIMIT_PUBLIC_API", "60/minute")
    # Collect: per (project public key, client IP). Tracker traffic is bursty
    # (SPAs fire a hit per route change), so the budget is generous.
    rate_limit_collect: str = os.getenv("RATE_LIMIT_COLLECT", "600/minute")

    # privacy: raw IPs are never stored; see dbcore/privacy.py
    ip_hash_secret: str = os.getenv("IP_HASH_SECRET", "dev-insecure-ip-salt")

    # geo: MaxMind GeoLite2-City database (optional; no file = no location).
    geoip_db_path: str = os.getenv("GEOIP_DB_PATH", "/geoip/GeoLite2-City.mmdb")

    # How many minutes count as "live" for the live-visitors endpoint.
    live_window_min: int = int(os.getenv("LIVE_WINDOW_MIN", "5"))


config = Config()
