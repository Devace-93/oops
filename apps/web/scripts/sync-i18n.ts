/**
 * Bring the non-English catalogs in line with the English reference WITHOUT
 * translating anything:
 *
 *   - keys that no longer exist in English are removed (their line(s) are cut
 *     from the source, every other line is left untouched);
 *   - keys missing from a BASE catalog (`xx.ts`, not `xx-YY.ts`) are appended
 *     with the English string as a fallback, under a `TODO(translate)` marker,
 *     so `check:i18n` passes until the next translation pass regenerates them.
 *
 *   bun scripts/sync-i18n.ts          # rewrite the catalogs
 *   bun scripts/sync-i18n.ts --check  # only report, exit 1 when out of sync
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import en from "../src/i18n/catalog/en";

const dir = join(import.meta.dir, "..", "src", "i18n", "catalog");
const checkOnly = process.argv.includes("--check");
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "en.ts").sort();
const enKeys = Object.keys(en);
const MARKER = "  // TODO(translate): English fallbacks added by scripts/sync-i18n.ts";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let removed = 0;
let added = 0;
let dirty = false;

for (const file of files) {
  const path = join(dir, file);
  const name = file.replace(".ts", "");
  const variant = name.includes("-");
  const cat: Record<string, string> = (await import(path)).default;
  let src = readFileSync(path, "utf8");

  const stale = Object.keys(cat).filter((k) => !(k in en));
  for (const k of stale) {
    // `"key": "value",` — the literal may start on the next line and may span
    // escaped quotes; everything else on those lines belongs to the entry.
    const re = new RegExp(`^[ \\t]*"${escapeRe(k)}":[ \\t]*\\n?[ \\t]*"(?:[^"\\\\]|\\\\.)*",?[ \\t]*\\n`, "m");
    if (!re.test(src)) {
      console.error(`${name}: could not locate "${k}" in the source — remove it by hand`);
      process.exitCode = 1;
      continue;
    }
    src = src.replace(re, "");
    removed++;
  }

  const missing = variant ? [] : enKeys.filter((k) => !(k in cat));
  if (missing.length) {
    const block = [MARKER, ...missing.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify((en as Record<string, string>)[k])},`)].join("\n");
    // Append before the closing `};` of the object literal.
    const close = src.lastIndexOf("\n};");
    if (close < 0) {
      console.error(`${name}: could not find the closing "};"`);
      process.exitCode = 1;
      continue;
    }
    // Reuse the marker if a previous run already left one at the end.
    const markerAt = src.lastIndexOf(MARKER);
    if (markerAt >= 0 && markerAt < close) {
      src = src.slice(0, close) + "\n" + block.slice(MARKER.length + 1) + src.slice(close);
    } else {
      src = src.slice(0, close) + "\n" + block + src.slice(close);
    }
    added += missing.length;
  }

  if (stale.length || missing.length) {
    dirty = true;
    console.log(`${name.padEnd(6)} -${stale.length} stale, +${missing.length} fallback${checkOnly ? "" : "  (written)"}`);
    if (!checkOnly) writeFileSync(path, src);
  }
}

console.log(`${checkOnly ? "Would remove" : "Removed"} ${removed} stale entries, ${checkOnly ? "would add" : "added"} ${added} English fallbacks across ${files.length} catalogs.`);
if (checkOnly && dirty) process.exit(1);
