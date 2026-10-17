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

    # rate limiting. RATE_LIMITS_ENABLED=false switches the limiter off
    # entirely (CI runs the e2e suite from one address and would trip the
    # per-IP default); never set it in production.
    rate_limits_enabled: bool = os.getenv("RATE_LIMITS_ENABLED", "true").strip().lower() not in ("false", "0", "no", "off")
    rate_limit_default: str = os.getenv("RATE_LIMIT_DEFAULT", "120/minute")
    rate_limit_public_api: str = os.getenv("RATE_LIMIT_PUBLIC_API", "60/minute")
    # Ingest: per (project public key, client IP). A broken deploy can make one
    # page report in bursts, so the budget is generous; the SDK also throttles
    # itself to 30 events per minute per page.
    rate_limit_ingest: str = os.getenv("RATE_LIMIT_INGEST", "600/minute")

    # privacy: raw IPs are never stored by default; see dbcore/privacy.py
    ip_hash_secret: str = os.getenv("IP_HASH_SECRET", "dev-insecure-ip-salt")

    # How many minutes count as "live" for the live-events endpoint.
    live_window_min: int = int(os.getenv("LIVE_WINDOW_MIN", "5"))


config = Config()
