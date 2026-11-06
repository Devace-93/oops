"""Application factory.

``create_app()`` builds and returns the Flask app. Gunicorn runs it directly::

    gunicorn -b 0.0.0.0:5000 -w 2 'api.app:create_app()'

Responsibilities here: CORS, request size cap, rate limiting, blueprint
registration, health checks,
and a small set of error handlers that always emit the ``{"error": {...}}``
envelope.
"""
from __future__ import annotations

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from dbcore.config import config

from .errors import ApiError
from .extensions import limiter


def create_app() -> Flask:
    app = Flask(__name__)
    # One trusted proxy (Caddy) in front: take the client address, scheme and
    # host from the X-Forwarded-* headers it sets. Without this every request
    # has Caddy's container IP as ``remote_addr`` and the per-IP rate limits
    # become one shared bucket. Caddy >= 2.5 drops X-Forwarded-* headers that
    # clients send unless they come from a configured trusted proxy, so the
    # first hop is the real client.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[method-assign]
    # An event with a stack and breadcrumbs is a few KB; anything bigger than
    # 64 KB is a 413 (CONTRACT.md caps the body there).
    app.config["MAX_CONTENT_LENGTH"] = 64 * 1024

    # ---- CORS --------------------------------------------------------------
    # Management routes: dashboard (and apex) origins only. Ingest routes are
    # called from the apps that embed the SDK, so they allow any origin (no
    # credentials). flask-cors matches the FIRST resource whose pattern fits,
    # so the public ones come first.
    try:
        from flask_cors import CORS

        public_origins = {"origins": "*", "supports_credentials": False,
                          "allow_headers": ["Content-Type", "X-Project-Key", "Authorization"]}
        CORS(
            app,
            resources={
                r"/api/ingest*": public_origins,
                r"/api/features": public_origins,
                r"/api/*": {"origins": [config.dashboard_url, config.app_base_url], "supports_credentials": True},
            },
        )
    except ImportError:  # pragma: no cover
        pass

    # ---- Rate limiting (Redis-backed) --------------------------------------
    limiter.init_app(app)

    # ---- Blueprints, all mounted under /api --------------------------------
    from .blueprints.account import bp as account_bp
    from .blueprints.apikeys import bp as apikeys_bp
    from .blueprints.auth import bp as auth_bp
    from .blueprints.ingest import bp as ingest_bp
    from .blueprints.issues import bp as issues_bp
    from .blueprints.projects import bp as projects_bp
    from .features import bp as features_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(projects_bp, url_prefix="/api/projects")
    app.register_blueprint(issues_bp, url_prefix="/api/projects/<project_id>")
    app.register_blueprint(ingest_bp, url_prefix="/api/ingest")
    app.register_blueprint(account_bp, url_prefix="/api/account")
    app.register_blueprint(apikeys_bp, url_prefix="/api/apikeys")
    app.register_blueprint(features_bp, url_prefix="/api/features")

    # No billing blueprint: the RevenueCat integration was removed (Nov 2026).
    # Paid plans arrive with the payments.3m4.net portal once oops joins the
    # accounts.3m4.net SSO; until then Account.plan is only ever "free".

    # ---- Health checks ------------------------------------------------------
    # Bare /healthz for the container/load-balancer; /api/healthz behind Caddy.
    @app.get("/healthz")
    @app.get("/api/healthz")
    @limiter.exempt
    def healthz():
        return jsonify({"status": "ok"})

    _register_error_handlers(app)
    return app


def _register_error_handlers(app: Flask) -> None:
    """Every error path returns the shared ``{"error": {...}}`` JSON shape."""

    @app.errorhandler(ApiError)
    def _handle_api_error(err: ApiError):
        return jsonify(err.to_dict()), err.status

    @app.errorhandler(429)
    def _handle_rate_limit(err):
        return (
            jsonify({"error": {"code": "rate_limited", "message": "Too many requests."}}),
            429,
        )

    @app.errorhandler(HTTPException)
    def _handle_http_exception(err: HTTPException):
        # Map any other werkzeug error (404, 405, 400, 413, ...) into our envelope.
        code = (err.name or "error").lower().replace(" ", "_")
        return (
            jsonify({"error": {"code": code, "message": err.description or err.name}}),
            err.code or 500,
        )

    @app.errorhandler(Exception)
    def _handle_unexpected(err: Exception):  # pragma: no cover
        app.logger.exception("Unhandled exception")
        return (
            jsonify({"error": {"code": "internal_error", "message": "An unexpected error occurred."}}),
            500,
        )
