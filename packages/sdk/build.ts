/**
 * Bundles the SDK into a single minified IIFE (ES2019) and writes it to the
 * web app's public folder so the web service serves it at /o.js and /o/v1.js.
 * Fails the build when the gzipped output exceeds the contract budget (4 KB).
 */
import { gzipSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const outputs = [resolve(root, "apps/web/public/o.js"), resolve(root, "apps/web/public/o/v1.js")];
const BUDGET_GZ = 4 * 1024;

const result = await Bun.build({
  entrypoints: [resolve(import.meta.dir, "src/index.ts")],
  target: "browser",
  format: "iife",
  minify: true,
  sourcemap: "none",
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const [artifact] = result.outputs;
const code = await artifact!.text();
const banner = "/* oops sdk v0.1.0 — https://oops.3m4.net — MIT */\n";
const out = banner + code;
const gz = gzipSync(Buffer.from(out)).length;
for (const path of outputs) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, out);
}
console.log(`o.js: ${(out.length / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(2)} KB gzipped`);
if (gz > BUDGET_GZ) {
  console.error(`Over budget: ${gz} B gzipped > ${BUDGET_GZ} B`);
  process.exit(1);
}
