"""Unit tests for ``dbcore.ingest`` — normalisation, caps and scrubbing
(pure Python, no database).

    python3 -m unittest discover -s services/api/tests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # repo root → dbcore importable

import json
import unittest
from datetime import datetime, timedelta, timezone

from dbcore.ingest import (
    FILTERED,
    IngestError,
    normalize_breadcrumbs,
    normalize_event,
    normalize_extra,
    normalize_level,
    normalize_tags,
    normalize_user,
    parse_timestamp,
    scrub,
    scrub_message,
    split_url,
)

NOW = datetime(2026, 10, 16, 10, 0, 0, tzinfo=timezone.utc)


class ScrubTests(unittest.TestCase):
    def test_secret_keys_are_filtered_recursively(self):
        data = {
            "password": "x", "Passwd": "y", "client_secret": "z", "access_token": "t", "Authorization": "a",
            "cookie": "c", "api_key": "k", "apikey": "k", "API-KEY": "k", "card_number": "4111", "cvv": "1", "ssn": "s",
            "ok": {"token": "nested", "fine": 1, "list": [{"password": "p"}, "plain"]},
        }
        out = scrub(data)
        for key in ("password", "Passwd", "client_secret", "access_token", "Authorization", "cookie", "api_key", "apikey", "API-KEY", "card_number", "cvv", "ssn"):
            self.assertEqual(out[key], FILTERED, key)
        self.assertEqual(out["ok"]["token"], FILTERED)
        self.assertEqual(out["ok"]["fine"], 1)
        self.assertEqual(out["ok"]["list"], [{"password": FILTERED}, "plain"])

    def test_scalars_pass_through(self):
        self.assertEqual(scrub("x"), "x")
        self.assertEqual(scrub([1, "a"]), [1, "a"])

    def test_message_scrubbing(self):
        self.assertEqual(scrub_message("auth failed: Bearer eyJhbGciOiJIUzI1NiJ9.abc"), f"auth failed: Bearer {FILTERED}")
        self.assertEqual(scrub_message("Authorization: Bearer s3cret"), f"Authorization: Bearer {FILTERED}")
        self.assertEqual(scrub_message("card 4111 1111 1111 1111 declined"), f"card {FILTERED} declined")
        self.assertEqual(scrub_message("card 4111-1111-1111-1111 declined"), f"card {FILTERED} declined")
        # Not Luhn-valid: an order number, not a card.
        self.assertEqual(scrub_message("order 1234 5678 9012 3456 shipped"), "order 1234 5678 9012 3456 shipped")
        self.assertEqual(scrub_message(""), "")


class FieldTests(unittest.TestCase):
    def test_levels(self):
        for raw, expected in (("fatal", "fatal"), ("critical", "fatal"), ("warn", "warning"), ("WARNING", "warning"), ("info", "info"), ("debug", "info"), ("nonsense", "error"), (None, "error")):
            self.assertEqual(normalize_level(raw), expected, raw)

    def test_timestamp_skew(self):
        self.assertEqual(parse_timestamp("2026-10-16T09:58:00Z", now=NOW), NOW - timedelta(minutes=2))
        self.assertIsNone(parse_timestamp("2026-10-16T09:00:00Z", now=NOW), "more than 5 min skew → server time")
        self.assertEqual(parse_timestamp(NOW.timestamp(), now=NOW), NOW)
        self.assertEqual(parse_timestamp(int(NOW.timestamp() * 1000), now=NOW), NOW)
        self.assertIsNone(parse_timestamp("yesterday", now=NOW))
        self.assertIsNone(parse_timestamp(None, now=NOW))
        self.assertIsNone(parse_timestamp(True, now=NOW))

    def test_split_url(self):
        self.assertEqual(split_url("https://App.example/checkout?x=1#frag"), ("https://App.example/checkout", "/checkout", "app.example"))
        self.assertEqual(split_url("/bare/path?x=1"), ("/bare/path", "/bare/path", None))
        self.assertEqual(split_url(""), (None, None, None))
        self.assertEqual(split_url(42), (None, None, None))
        url, path, host = split_url("https://x.example/" + "a" * 5000)
        self.assertEqual(len(url), 2048)

    def test_user(self):
        self.assertEqual(normalize_user({"id": 42, "email": "a@b", "name": "A", "password": "p", "other": 1}), {"id": "42", "email": "a@b", "name": "A"})
        self.assertEqual(normalize_user("u_1"), {"id": "u_1"})
        self.assertIsNone(normalize_user({}))
        self.assertIsNone(normalize_user([1]))
        self.assertEqual(len(normalize_user({"id": "x" * 500})["id"]), 120)

    def test_tags(self):
        tags = normalize_tags({"page": "checkout", "n": 3, "flag": True, "nested": {"a": 1}, "password": "x", "k" * 100: "v" * 500, "none": None})
        self.assertEqual(tags["page"], "checkout")
        self.assertEqual(tags["n"], "3")
        self.assertEqual(tags["flag"], "true")
        self.assertNotIn("nested", tags)
        self.assertNotIn("none", tags)
        self.assertEqual(tags["password"], FILTERED)
        self.assertEqual(len(tags["k" * 40]), 200)
        many = normalize_tags({f"t{i}": "v" for i in range(50)})
        self.assertEqual(len(many), 20)
        self.assertEqual(normalize_tags("nope"), {})

    def test_extra_is_scrubbed_and_trimmed(self):
        self.assertEqual(normalize_extra({"token": "t", "cart": 3}), {"token": FILTERED, "cart": 3})
        big = {"blob": "x" * 20000, "small": 1}
        out = normalize_extra(big)
        self.assertLessEqual(len(json.dumps(out)), 8 * 1024)
        self.assertEqual(out["small"], 1)
        self.assertEqual(out["_truncated"], ["blob"])
        self.assertEqual(normalize_extra([1, 2]), {})

    def test_breadcrumbs_keep_the_last_30_within_8kb(self):
        crumbs = normalize_breadcrumbs([{"category": "click", "message": f"button#{i}", "data": {"cookie": "c", "x": i}} for i in range(50)])
        self.assertEqual(len(crumbs), 30)
        self.assertEqual(crumbs[-1]["message"], "button#49")
        self.assertEqual(crumbs[0]["data"], {"cookie": FILTERED, "x": 20})
        heavy = normalize_breadcrumbs([{"category": "log", "message": "m" * 500, "data": {"blob": "y" * 1000}} for _ in range(30)])
        self.assertLess(len(heavy), 30)
        self.assertLessEqual(len(json.dumps(heavy)), 8 * 1024)
        self.assertEqual(normalize_breadcrumbs([{"message": "no category"}])[0]["category"], "default")
        self.assertEqual(normalize_breadcrumbs("x"), [])


class NormalizeEventTests(unittest.TestCase):
    def test_minimal_and_rejections(self):
        ev = normalize_event({"message": "hi"})
        self.assertEqual((ev.type, ev.message, ev.level, ev.environment, ev.source), (None, "hi", "error", "production", "api"))
        self.assertEqual(normalize_event({"type": "Boom"}).message, "")
        for bad in ({}, {"level": "error"}, {"type": "", "message": "   "}, [], "x", None):
            with self.assertRaises(IngestError) as ctx:
                normalize_event(bad)
            self.assertEqual(ctx.exception.code, "invalid_event")

    def test_full_payload(self):
        payload = {
            "type": "TypeError", "message": "x is not a function Bearer abcdefghijklmnop", "level": "fatal",
            "stack": "TypeError: x\n    at init (https://app/x.js:12:4)",
            "url": "https://app.example/checkout?x=1", "release": "1.4.2", "environment": "staging",
            "platform": "javascript", "sdk": "oops-js/0.1.0", "source": "sdk",
            "user": {"id": "u_42", "email": "e@x"}, "tags": {"page": "checkout", "token": "t"},
            "extra": {"cart": 3, "secret": "s"}, "breadcrumbs": [{"category": "click", "message": "button#pay", "data": {"cookie": "c"}}],
            "fingerprint": ["checkout", "pay-failed"], "ts": "2026-10-16T09:59:30Z",
        }
        ev = normalize_event(payload, now=NOW)
        self.assertEqual(ev.message, f"x is not a function Bearer {FILTERED}")
        self.assertEqual(ev.level, "fatal")
        self.assertEqual(ev.frames[0]["function"], "init")
        self.assertTrue(ev.stack_raw.startswith("TypeError"))
        self.assertEqual((ev.url, ev.path, ev.hostname, ev.page_host), ("https://app.example/checkout", "/checkout", "app.example", "app.example"))
        self.assertEqual((ev.release, ev.environment, ev.platform, ev.sdk), ("1.4.2", "staging", "javascript", "oops-js/0.1.0"))
        self.assertEqual(ev.user, {"id": "u_42", "email": "e@x"})
        self.assertEqual(ev.tags, {"page": "checkout", "token": FILTERED})
        self.assertEqual(ev.extra, {"cart": 3, "secret": FILTERED})
        self.assertEqual(ev.breadcrumbs[0]["data"], {"cookie": FILTERED})
        self.assertEqual(ev.fingerprint, ["checkout", "pay-failed"])
        self.assertEqual(ev.ts, NOW - timedelta(seconds=30))
        self.assertEqual(ev.source, "sdk")

    def test_source_follows_the_sdk_label_only(self):
        self.assertEqual(normalize_event({"message": "m", "source": "sdk"}).source, "api")
        self.assertEqual(normalize_event({"message": "m", "source": "sdk", "sdk": "sentry/7"}).source, "api")
        self.assertEqual(normalize_event({"message": "m", "sdk": "oops-js/0.1.0", "platform": "javascript"}).source, "sdk")
        self.assertEqual(normalize_event({"message": "m", "source": "api", "sdk": "oops-js/0.1.0"}).source, "sdk")
        self.assertEqual(normalize_event({"message": "m", "platform": "python"}).source, "api")

    def test_caps(self):
        ev = normalize_event({
            "type": "T" * 500, "message": "m" * 10000, "stack": "s" * 40000,
            "environment": "e" * 100, "release": "r" * 200, "platform": "p" * 100, "sdk": "k" * 100,
            "fingerprint": ["f" * 300] * 10,
        })
        self.assertEqual(len(ev.type), 200)
        self.assertEqual(len(ev.message), 4096)
        self.assertEqual(len(ev.stack_raw), 16 * 1024)
        self.assertEqual((len(ev.environment), len(ev.release), len(ev.platform), len(ev.sdk)), (40, 100, 30, 60))
        self.assertEqual(len(ev.fingerprint), 5)
        self.assertEqual(len(ev.fingerprint[0]), 100)

    def test_client_frames_win_over_stack(self):
        ev = normalize_event({"message": "m", "frames": [{"filename": "a.js", "function": "f"}], "stack": "    at g (b.js:1:1)"})
        self.assertEqual(ev.frames[0]["function"], "f")
        self.assertEqual(ev.stack_raw, "    at g (b.js:1:1)")


if __name__ == "__main__":
    unittest.main()
