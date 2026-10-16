"""Stack trace parsing: raw stack strings into ``Frame`` dicts.

Three formats are recognised line by line, best-effort (CONTRACT.md):

* V8 (Chrome, Node, Edge): ``at fn (file:line:col)`` / ``at file:line:col``
* Firefox / Safari (Gecko / JavaScriptCore): ``fn@file:line:col`` / ``@file:line:col``
* Python tracebacks: ``File "x", line N, in fn``

Frames come out **top of the stack first** (the frame that threw is
``frames[0]``), which means Python tracebacks — printed "most recent call
last" — are reversed. Lines that match nothing (the ``TypeError: …`` header,
Python source echo lines, ``Traceback (most recent call last):``) are skipped;
the raw string is kept separately in ``Event.stack_raw`` so nothing is lost.

``in_app`` is a heuristic when the client did not say: dependency, runtime and
browser-extension frames are out, everything else is in. The top *in-app*
frame is what grouping uses, so this keeps ``node_modules`` noise out of the
fingerprint.

Pure Python, no database imports: this module is unit-tested standalone.
"""
from __future__ import annotations

import re

MAX_FRAMES = 50
MAX_FILENAME = 1024
MAX_FUNCTION = 255

# ``at fn (location)`` — the function part may contain spaces ("new Foo",
# "async main", "Object.<anonymous>") and even parens ("eval at <anonymous>").
_V8_WITH_FN = re.compile(r"^\s*at\s+(?P<function>.+?)\s+\((?P<location>[^()]*|.*\))\)\s*$")
_V8_BARE = re.compile(r"^\s*at\s+(?P<location>\S+)\s*$")
# ``fn@location`` / ``@location``; Safari also prints ``fn@[native code]``.
_GECKO = re.compile(r"^\s*(?P<function>[^@\s][^@]*?|)@(?P<location>\S.*)$")
_PY_FILE = re.compile(r'^\s*File\s+"(?P<filename>[^"]+)",\s+line\s+(?P<lineno>\d+)(?:,\s+in\s+(?P<function>.+?))?\s*$')
# ``file:line:col`` → the two trailing numeric groups are optional.
_LOCATION = re.compile(r"^(?P<filename>.*?)(?::(?P<lineno>\d+))?(?::(?P<colno>\d+))?$")

_NOT_IN_APP = re.compile(
    r"node_modules|/site-packages/|/dist-packages/|/lib/python\d|^node:|^internal/|"
    r"^<anonymous>$|^native$|^\[native code\]$|^debugger eval code|^eval at |"
    r"chrome-extension://|moz-extension://|safari(-web)?-extension://|webpack/runtime|"
    r"^\[wasm",
    re.I,
)


def _int(value) -> int | None:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return None
    return n if 0 <= n < 10**9 else None


def _clip(value, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text[:max_len] if text else None


def in_app_guess(filename: str | None, function: str | None = None) -> bool:
    """Heuristic ``in_app`` for frames the client did not classify."""
    if not filename:
        return False
    if _NOT_IN_APP.search(filename):
        return False
    return True


def _frame(filename, function, lineno, colno, in_app=None) -> dict:
    filename = _clip(filename, MAX_FILENAME)
    function = _clip(function, MAX_FUNCTION)
    if function in ("", "<anonymous>", "?"):
        function = None
    return {
        "filename": filename,
        "function": function,
        "lineno": _int(lineno),
        "colno": _int(colno),
        "in_app": bool(in_app) if in_app is not None else in_app_guess(filename, function),
    }


def _split_location(location: str) -> tuple[str | None, str | None, str | None]:
    """``"https://app/x.js:12:4"`` → ``("https://app/x.js", "12", "4")``.
    Locations without numbers (``<anonymous>``, ``native``) keep the text."""
    text = (location or "").strip()
    if text.startswith("(") and text.endswith(")"):
        text = text[1:-1]
    match = _LOCATION.match(text)
    if not match:
        return text or None, None, None
    filename = match.group("filename") or None
    return filename, match.group("lineno"), match.group("colno")


def _parse_v8(line: str) -> dict | None:
    match = _V8_WITH_FN.match(line)
    if match:
        function = match.group("function").strip()
        if function.startswith("async "):
            function = function[len("async "):]
        filename, lineno, colno = _split_location(match.group("location"))
        return _frame(filename, function, lineno, colno)
    match = _V8_BARE.match(line)
    if match:
        filename, lineno, colno = _split_location(match.group("location"))
        return _frame(filename, None, lineno, colno)
    return None


def _parse_gecko(line: str) -> dict | None:
    match = _GECKO.match(line)
    if not match:
        return None
    function = match.group("function").strip() or None
    if function and function.startswith("async*"):
        function = function[len("async*"):]
    filename, lineno, colno = _split_location(match.group("location"))
    return _frame(filename, function, lineno, colno)


def _parse_python(line: str) -> dict | None:
    match = _PY_FILE.match(line)
    if not match:
        return None
    return _frame(match.group("filename"), match.group("function"), match.group("lineno"), None)


def parse_stack(stack: str | None) -> list[dict]:
    """Parse a raw stack string into frames, top of the stack first. Lines
    that fit no known format are ignored. At most ``MAX_FRAMES`` frames."""
    if not stack or not isinstance(stack, str):
        return []
    js_frames: list[dict] = []
    py_frames: list[dict] = []
    for line in stack.splitlines():
        if not line.strip():
            continue
        frame = _parse_python(line)
        if frame is not None:
            py_frames.append(frame)
            continue
        frame = _parse_v8(line) or _parse_gecko(line)
        if frame is not None:
            js_frames.append(frame)
    if py_frames and not js_frames:
        # Python prints the outermost call first; we want the raising frame first.
        return py_frames[::-1][:MAX_FRAMES]
    frames = js_frames or py_frames
    return frames[:MAX_FRAMES]


def normalize_frames(raw) -> list[dict]:
    """Client-provided ``frames`` → clean frame dicts (first ``MAX_FRAMES``
    kept, lengths capped, ``in_app`` guessed when missing). Non-dict items
    are dropped; a non-list yields ``[]``."""
    if not isinstance(raw, list):
        return []
    frames: list[dict] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        in_app = item.get("in_app")
        frames.append(
            _frame(
                item.get("filename") or item.get("file") or item.get("abs_path"),
                item.get("function") or item.get("func"),
                item.get("lineno") if item.get("lineno") is not None else item.get("line"),
                item.get("colno") if item.get("colno") is not None else item.get("col"),
                in_app if isinstance(in_app, bool) else None,
            )
        )
        if len(frames) >= MAX_FRAMES:
            break
    return frames


def top_in_app_frame(frames: list[dict]) -> dict | None:
    """The first in-app frame, else the first frame, else None."""
    for frame in frames:
        if frame.get("in_app"):
            return frame
    return frames[0] if frames else None
