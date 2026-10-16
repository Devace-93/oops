/**
 * Client-side stack parsing. The raw `stack` string is sent too (the server
 * re-parses it when `frames` is missing), but parsing here lets the server
 * group on `frames[0]` without guessing the browser format.
 *
 * Supported formats:
 *   V8 (Chrome, Edge, Node):   `    at fn (https://app/x.js:12:4)` / `    at https://app/x.js:12:4`
 *   Gecko / JavaScriptCore:    `fn@https://app/x.js:12:4` / `@https://app/x.js:12:4`
 * Lines that match neither (the `Error: message` header, `[native code]`,
 * `<anonymous>` without a position) are skipped: they stay in the raw string.
 */
export interface Frame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app: boolean;
}

export const MAX_FRAMES = 50;

const V8 = /^\s*at (?:(?:async )?(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/;
const GECKO = /^(.*?)@(.+?):(\d+):(\d+)\s*$/;

/**
 * A frame is "in app" when its file lives on the page's own origin or is a
 * relative path. Other origins (CDNs, extensions) and synthetic names like
 * `<anonymous>` are not.
 */
export function isInApp(filename: string | undefined, origin: string): boolean {
  if (!filename || filename.charAt(0) === "<") return false;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(filename)) return true;
  return !!origin && (filename === origin || filename.indexOf(origin + "/") === 0);
}

/** Parse a stack string into frames, top of the stack first (≤ 50). */
export function parseStack(stack: string | null | undefined, origin: string): Frame[] {
  const frames: Frame[] = [];
  if (!stack) return frames;
  const lines = String(stack).split("\n");
  for (let i = 0; i < lines.length && frames.length < MAX_FRAMES; i++) {
    const line = lines[i] as string;
    const m = V8.exec(line) || GECKO.exec(line);
    if (!m) continue;
    const fn = (m[1] || "").trim();
    const frame: Frame = {
      filename: (m[2] as string).slice(0, 1024),
      lineno: +(m[3] as string),
      colno: +(m[4] as string),
      in_app: isInApp(m[2], origin),
    };
    if (fn) frame.function = fn.slice(0, 255);
    frames.push(frame);
  }
  return frames;
}
