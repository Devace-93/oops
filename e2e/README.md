# oops e2e

Playwright suite against a running stack (`make up`, then `make e2e`). Each spec
creates its own account through the API; nothing is shared or reused between
runs. Set `E2E_BASE_URL` to point at another host (default `http://localhost:8084`).

| Spec | Covers |
|---|---|
| `auth.spec.ts` | sign up → dashboard, log out, log in, wrong password |
| `project.spec.ts` | create project → settings show the public key + snippet → hits on the overview (KPIs, chart, breakdowns, filters) → API keys / RBAC → events page |
| `collect.spec.ts` | `POST /api/collect` (JSON, text/plain), the pixel, bots / paused / origins, validation, key rotation, purge, CORS, `/m.js` headers |
| `tracker.spec.ts` | `/m.js` on a host page: page view on load, SPA route change, `oops.track()`, `data-oops-event`, never throws, skips localhost |

The browser and every API-level hit use a real Chrome user agent: headless
Chrome's own UA is filtered out as a bot by design.

`bun run test:critical` runs only the `@critical` tests.
