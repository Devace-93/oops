# oops — notes for agents

- Spec: `CONTRACT.md` (API, objects, scopes, ingest / grouping / SDK semantics). Keep it in sync with the code.
- Sibling projects and reference implementations: `/home/enrique/metrics` (web analytics; oops was bootstrapped from it), `/home/enrique/retro` (user feedback), `/home/enrique/exp` (feature flags) and `/home/enrique/3m4` (URL shortener). Same stack, same chrome. When in doubt, do what metrics does.
- Everything in this repo (code, comments, commits, docs) is written in English.
- Local stack: `make up` → http://localhost:8084 (8080 belongs to 3m4, 8081 to exp, 8082 to retro, 8083 to metrics). Compose project name `oops`.
- Build mode: Claude writes the whole codebase unless Enrique says "modo aprender".
- Visual PRs carry a demo GIF + webm in the description (`docs/pr/`).
- Brand colour: Tailwind **fuchsia** (3m4 blue, exp violet, retro emerald, metrics cyan, bubbles orange).
- Never store raw user agents; raw IPs only behind the per-project `store_ip` switch; scrub secret-looking keys in every client-supplied object.
- Ingest never returns an error to a reporting app for business reasons: paused / origin / limit are all 202 with `ok:false`.
- The SDK is served at `/o.js` from `apps/web/public` (built by `make sdk`), budget 4 KB gzipped.
- oops itself is tracked by metrics (`VITE_METRICS_*`); those tokens are not part of the oops brand and must stay.
