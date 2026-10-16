"""Grouping: message normalisation, fingerprints, issue title and culprit.

The fingerprint decides which issue an event lands in (CONTRACT.md):

* the client's ``fingerprint`` array wins when present (``["checkout",
  "pay-failed"]`` → one issue no matter the message);
* otherwise sha256 of ``type`` + normalised ``message`` + the top in-app frame
  (``filename`` without query string + ``function``).

Normalisation replaces the parts of a message that vary per occurrence —
quoted strings, UUIDs, hex blobs of 8+ chars, runs of digits — with
placeholders and truncates to 200 chars, so ``User 42 not found`` and
``User 43 not found`` are one issue while ``User not found`` and ``Order not
found`` stay apart.

Pure Python, no database imports: this module is unit-tested standalone.
"""
from __future__ import annotations

import hashlib
import re
from urllib.parse import urlsplit

from .stacktrace import top_in_app_frame

NORMALIZED_MESSAGE_LEN = 200
MAX_TITLE = 500
MAX_CULPRIT = 500

_QUOTED = re.compile(r"""(["'`])(?:\\.|(?!\1).)*\1""")
_UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)
# 8+ hex chars with at least one digit (so plain words such as "deadbeef" or
# "accede" are left alone; ids, hashes and addresses always carry a digit).
_HEX = re.compile(r"\b(?=[0-9a-f]*\d)[0-9a-f]{8,}\b", re.I)
_HEX_LITERAL = re.compile(r"\b0x[0-9a-f]+\b", re.I)   # pointers, addresses
_NUM = re.compile(r"\d+")
_WS = re.compile(r"\s+")


def normalize_message(message: str | None) -> str:
    """Placeholder-ised, whitespace-collapsed, 200-char message."""
    text = str(message or "")
    text = _QUOTED.sub("<str>", text)
    text = _UUID.sub("<uuid>", text)
    text = _HEX_LITERAL.sub("<hex>", text)
    text = _HEX.sub("<hex>", text)
    text = _NUM.sub("<n>", text)
    text = _WS.sub(" ", text).strip()
    return text[:NORMALIZED_MESSAGE_LEN]


def strip_query(filename: str | None) -> str | None:
    """``https://app/x.js?v=3#frag`` → ``https://app/x.js``; bare paths untouched."""
    if not filename:
        return None
    if "://" in filename:
        try:
            parts = urlsplit(filename)
        except ValueError:
            return filename.split("?", 1)[0].split("#", 1)[0]
        return f"{parts.scheme}://{parts.netloc}{parts.path}"
    return filename.split("?", 1)[0].split("#", 1)[0]


def compute_fingerprint(
    type_: str | None,
    message: str | None,
    frames: list[dict] | None,
    client_fingerprint: list[str] | None = None,
) -> str:
    """sha256 hex digest that identifies the issue (see module docstring)."""
    if client_fingerprint:
        parts = ["client", *[str(part) for part in client_fingerprint]]
    else:
        frame = top_in_app_frame(frames or []) or {}
        parts = [
            "auto",
            str(type_ or ""),
            normalize_message(message),
            strip_query(frame.get("filename")) or "",
            str(frame.get("function") or ""),
        ]
    return hashlib.sha256("\x00".join(parts).encode("utf-8", "replace")).hexdigest()


def issue_title(type_: str | None, message: str | None) -> str:
    """``"TypeError: x is not a function"``: type + first line of the message,
    or whichever of the two exists."""
    first_line = str(message or "").strip().splitlines()
    head = first_line[0].strip() if first_line else ""
    type_ = (type_ or "").strip()
    if type_ and head:
        title = f"{type_}: {head}"
    else:
        title = type_ or head or "Unknown error"
    return title[:MAX_TITLE]


def issue_culprit(frames: list[dict] | None) -> str | None:
    """``"init in https://app/x.js"`` from the top in-app frame (None without frames)."""
    frame = top_in_app_frame(frames or [])
    if not frame:
        return None
    filename = strip_query(frame.get("filename"))
    function = frame.get("function")
    if function and filename:
        culprit = f"{function} in {filename}"
    else:
        culprit = function or filename
    return culprit[:MAX_CULPRIT] if culprit else None
