"""Unit tests for ``dbcore.grouping`` (pure Python, no database).

    python3 -m unittest discover -s services/api/tests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # repo root → dbcore importable

import unittest

from dbcore.grouping import compute_fingerprint, issue_culprit, issue_title, normalize_message, strip_query

FRAMES = [
    {"filename": "https://app/vendor/node_modules/lib.js", "function": "wrap", "lineno": 1, "colno": 1, "in_app": False},
    {"filename": "https://app/x.js?v=3", "function": "init", "lineno": 12, "colno": 4, "in_app": True},
]


class NormalizeMessageTests(unittest.TestCase):
    def test_digits(self):
        self.assertEqual(normalize_message("User 42 not found"), normalize_message("User 43 not found"))
        self.assertEqual(normalize_message("User 42 not found"), "User <n> not found")

    def test_uuid_hex_quotes(self):
        text = "Order 'abc-123' failed for 550e8400-e29b-41d4-a716-446655440000 at 0x7fff5fbff8c0 sha deadbeef12 word deadbeef"
        self.assertEqual(normalize_message(text), "Order <str> failed for <uuid> at <hex> sha <hex> word deadbeef")
        self.assertEqual(normalize_message('Cannot read "foo" of undefined'), "Cannot read <str> of undefined")
        self.assertEqual(normalize_message("Bad `tpl` here"), "Bad <str> here")

    def test_whitespace_and_truncation(self):
        self.assertEqual(normalize_message("  a \n\n b\t c  "), "a b c")
        self.assertEqual(len(normalize_message("x" * 500)), 200)
        self.assertEqual(normalize_message(None), "")

    def test_different_words_stay_apart(self):
        self.assertNotEqual(normalize_message("User not found"), normalize_message("Order not found"))


class FingerprintTests(unittest.TestCase):
    def test_same_issue_despite_varying_ids(self):
        a = compute_fingerprint("TypeError", "User 42 not found", FRAMES)
        b = compute_fingerprint("TypeError", "User 43 not found", FRAMES)
        self.assertEqual(a, b)
        self.assertEqual(len(a), 64)

    def test_type_message_frame_matter(self):
        base = compute_fingerprint("TypeError", "x", FRAMES)
        self.assertNotEqual(base, compute_fingerprint("RangeError", "x", FRAMES))
        self.assertNotEqual(base, compute_fingerprint("TypeError", "y", FRAMES))
        other = [{"filename": "https://app/z.js", "function": "init", "in_app": True}]
        self.assertNotEqual(base, compute_fingerprint("TypeError", "x", other))

    def test_top_in_app_frame_ignores_query_and_vendor(self):
        with_query = [{"filename": "https://app/x.js?v=4", "function": "init", "in_app": True}]
        self.assertEqual(compute_fingerprint("E", "m", FRAMES), compute_fingerprint("E", "m", with_query))
        vendor_only = [FRAMES[0]]
        self.assertNotEqual(compute_fingerprint("E", "m", FRAMES), compute_fingerprint("E", "m", vendor_only))

    def test_client_fingerprint_wins(self):
        a = compute_fingerprint("TypeError", "anything", FRAMES, ["checkout", "pay-failed"])
        b = compute_fingerprint("Other", "else", [], ["checkout", "pay-failed"])
        self.assertEqual(a, b)
        self.assertNotEqual(a, compute_fingerprint("TypeError", "anything", FRAMES))
        self.assertNotEqual(a, compute_fingerprint("TypeError", "anything", FRAMES, ["checkout"]))

    def test_no_frames(self):
        self.assertEqual(compute_fingerprint("E", "m 1", []), compute_fingerprint("E", "m 2", None))


class TitleCulpritTests(unittest.TestCase):
    def test_title(self):
        self.assertEqual(issue_title("TypeError", "x is not a function\n  at foo"), "TypeError: x is not a function")
        self.assertEqual(issue_title(None, "just a message"), "just a message")
        self.assertEqual(issue_title("Boom", None), "Boom")
        self.assertEqual(issue_title(None, ""), "Unknown error")
        self.assertEqual(len(issue_title("T", "m" * 1000)), 500)

    def test_culprit(self):
        self.assertEqual(issue_culprit(FRAMES), "init in https://app/x.js")
        self.assertEqual(issue_culprit([{"filename": "https://app/y.js", "function": None, "in_app": True}]), "https://app/y.js")
        self.assertEqual(issue_culprit([{"filename": None, "function": "main", "in_app": False}]), "main")
        self.assertIsNone(issue_culprit([]))
        self.assertIsNone(issue_culprit(None))

    def test_strip_query(self):
        self.assertEqual(strip_query("https://app/x.js?v=3#frag"), "https://app/x.js")
        self.assertEqual(strip_query("/srv/app/x.py"), "/srv/app/x.py")
        self.assertIsNone(strip_query(None))


if __name__ == "__main__":
    unittest.main()
