"""Unit tests for ``dbcore.stacktrace`` (pure Python, no database).

    python3 -m unittest discover -s services/api/tests
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))  # repo root → dbcore importable

import unittest

from dbcore.stacktrace import MAX_FRAMES, normalize_frames, parse_stack, top_in_app_frame

V8 = """TypeError: x is not a function
    at init (https://app.example/x.js?v=3:12:4)
    at new Foo (https://app.example/vendor/node_modules/lib.js:1:2)
    at async main (https://app.example/x.js:40:1)
    at https://app.example/y.js:7:8
    at Object.<anonymous> (node:internal/main:1:1)
    at native"""

GECKO = """init@https://app.example/x.js:12:4
@https://app.example/y.js:7:8
promiseReactionJob@[native code]
global code@https://app.example/z.js:1:2"""

PYTHON = '''Traceback (most recent call last):
  File "/app/main.py", line 10, in <module>
    run()
  File "/app/svc.py", line 22, in run
    db.get(42)
  File "/usr/lib/python3.12/site-packages/sqlalchemy/orm.py", line 5, in get
    raise KeyError(key)
KeyError: 42'''


class ParseStackTests(unittest.TestCase):
    def test_v8(self):
        frames = parse_stack(V8)
        self.assertEqual(len(frames), 6)
        self.assertEqual(frames[0], {"filename": "https://app.example/x.js?v=3", "function": "init", "lineno": 12, "colno": 4, "in_app": True})
        self.assertEqual(frames[1]["function"], "new Foo")
        self.assertFalse(frames[1]["in_app"], "node_modules is not in-app")
        self.assertEqual(frames[2]["function"], "main", "async prefix is dropped")
        self.assertIsNone(frames[3]["function"])
        self.assertEqual((frames[3]["lineno"], frames[3]["colno"]), (7, 8))
        self.assertFalse(frames[4]["in_app"], "node: internals are not in-app")
        self.assertEqual(frames[5]["filename"], "native")
        self.assertFalse(frames[5]["in_app"])

    def test_firefox_safari(self):
        frames = parse_stack(GECKO)
        self.assertEqual(len(frames), 4)
        self.assertEqual(frames[0]["function"], "init")
        self.assertEqual(frames[0]["lineno"], 12)
        self.assertIsNone(frames[1]["function"])
        self.assertEqual(frames[2]["filename"], "[native code]")
        self.assertFalse(frames[2]["in_app"])
        self.assertEqual(frames[3]["function"], "global code")

    def test_python_is_reversed_to_top_first(self):
        frames = parse_stack(PYTHON)
        self.assertEqual([f["function"] for f in frames], ["get", "run", "<module>"])
        self.assertEqual(frames[0]["lineno"], 5)
        self.assertIsNone(frames[0]["colno"])
        self.assertFalse(frames[0]["in_app"], "site-packages is not in-app")
        self.assertTrue(frames[1]["in_app"])
        self.assertEqual(top_in_app_frame(frames)["function"], "run")

    def test_garbage_and_empty(self):
        self.assertEqual(parse_stack(None), [])
        self.assertEqual(parse_stack(""), [])
        self.assertEqual(parse_stack("just a message\nwith two lines"), [])
        self.assertEqual(parse_stack(123), [])

    def test_frame_cap(self):
        stack = "\n".join(f"    at fn{i} (https://app/x.js:{i}:1)" for i in range(80))
        self.assertEqual(len(parse_stack(stack)), MAX_FRAMES)


class NormalizeFramesTests(unittest.TestCase):
    def test_client_frames_are_kept_and_capped(self):
        frames = normalize_frames(
            [
                {"filename": "https://app/x.js", "function": "init", "lineno": "12", "colno": 4, "in_app": True},
                {"filename": "x" * 2000, "function": "f" * 300, "lineno": -1, "colno": "nope"},
                "not a frame",
                {"filename": "https://cdn/node_modules/a.js", "function": "g"},
            ]
        )
        self.assertEqual(len(frames), 3)
        self.assertEqual(frames[0]["lineno"], 12)
        self.assertTrue(frames[0]["in_app"])
        self.assertEqual(len(frames[1]["filename"]), 1024)
        self.assertEqual(len(frames[1]["function"]), 255)
        self.assertIsNone(frames[1]["lineno"])
        self.assertIsNone(frames[1]["colno"])
        self.assertFalse(frames[2]["in_app"], "in_app is guessed when the client omits it")

    def test_non_list(self):
        self.assertEqual(normalize_frames({"filename": "x"}), [])
        self.assertEqual(normalize_frames(None), [])

    def test_top_in_app_frame_falls_back_to_first(self):
        frames = [{"filename": "node:fs", "in_app": False}, {"filename": "node:net", "in_app": False}]
        self.assertEqual(top_in_app_frame(frames)["filename"], "node:fs")
        self.assertIsNone(top_in_app_frame([]))


if __name__ == "__main__":
    unittest.main()
