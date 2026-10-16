/**
 * Issue references as agents and humans write them.
 *
 * The REST API accepts either the issue uuid or its per-project number in the
 * `<issue_id>` path segment, so the server only has to normalise what the
 * model passed: `12`, `"12"`, `"#12"` and `" # 12 "` all become `"12"`; a uuid
 * passes through unchanged (lower-cased); anything else is rejected before a
 * request is made.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMBER_RE = /^#?\s*(\d{1,9})$/;

export class InvalidIssueRef extends Error {
  constructor(public readonly input: unknown) {
    super(`Invalid issue reference ${JSON.stringify(input)}: pass the issue uuid, its number (12) or "#12".`);
    this.name = "InvalidIssueRef";
  }
}

/** Returns the path segment to use with the API (`"12"` or the uuid). */
export function parseIssueRef(input: string | number): string {
  if (typeof input === "number") {
    if (!Number.isInteger(input) || input < 1) throw new InvalidIssueRef(input);
    return String(input);
  }
  const s = input.trim();
  if (UUID_RE.test(s)) return s.toLowerCase();
  const m = NUMBER_RE.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1) return String(n);
  }
  throw new InvalidIssueRef(input);
}

/** `#12` for numbers, the uuid otherwise: how the reference is echoed back in summaries. */
export function formatIssueRef(ref: string): string {
  return /^\d+$/.test(ref) ? `#${ref}` : ref;
}
