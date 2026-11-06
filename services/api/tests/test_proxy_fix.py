"""The app runs behind exactly one trusted proxy (Caddy): ProxyFix must take
the client address from the first X-Forwarded-For hop, otherwise every
request carries the proxy's address and per-IP rate limits share one bucket."""
from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
for p in (ROOT, ROOT / "services" / "api"):
    sys.path.insert(0, str(p))

from werkzeug.middleware.proxy_fix import ProxyFix  # noqa: E402
from werkzeug.test import Client  # noqa: E402


class ProxyFixTest(unittest.TestCase):
    def test_app_is_wrapped_in_proxy_fix(self):
        from api.app import create_app

        app = create_app()
        self.assertIsInstance(app.wsgi_app, ProxyFix)
        self.assertEqual((app.wsgi_app.x_for, app.wsgi_app.x_proto, app.wsgi_app.x_host), (1, 1, 1))

    def test_proxy_fix_takes_first_forwarded_hop(self):
        seen = {}

        def inner(environ, start_response):
            seen["ip"] = environ["REMOTE_ADDR"]
            start_response("204 No Content", [])
            return [b""]

        c = Client(ProxyFix(inner, x_for=1, x_proto=1, x_host=1))
        c.get("/", headers={"X-Forwarded-For": "203.0.113.9"}, environ_base={"REMOTE_ADDR": "10.0.0.2"})
        self.assertEqual(seen["ip"], "203.0.113.9")
        c.get("/", environ_base={"REMOTE_ADDR": "10.0.0.2"})
        self.assertEqual(seen["ip"], "10.0.0.2")


if __name__ == "__main__":
    unittest.main()
