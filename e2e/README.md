# oops e2e

Playwright suite against a running stack (`make up`, then `make e2e`). Each spec
creates its own account through the API; nothing is shared or reused between
runs. Set `E2E_BASE_URL` to point at another host (default `http://localhost:8084`).
`global-setup.ts` waits for `/api/healthz` and `/o.js` before the first test.

| Spec | Covers |
|---|---|
| `auth.spec.ts` | sign up → dashboard, log out, log in, wrong password |
| `project.spec.ts` | API: create → read → settings (`allowed_origins`, `timezone`, `ingest_enabled`, `store_ip`) → counts → rotate key (old key 401) → delete cascades; explicit key slug; other account's project is a 404 |
| `ingest.spec.ts` | `POST /api/ingest` (JSON + header, `text/plain` with `k`): grouping by fingerprint, `user_count`, scrubbing (`[Filtered]`, tokens in messages), query string dropped, client `fingerprint[]`, message normalisation, `paused` / `origin` drops (202), 400 / 401, `/ingest/event`, batch, server-side stack parsing (V8 + Firefox), CORS preflight, `/o.js` headers |
| `issues.spec.ts` | list filters (`status`, `level`, `environment`, `release`, `q`), sort, paging; resolve → new event reopens with `regressed_at`; ignored stays ignored; bulk; events / issue events / single event; stats (totals, previous, series, breakdowns, filters, intervals); summary; live; RBAC (viewer 403 + `auth.denied` audit, editor triages, admin purges) |
| `sdk.spec.ts` | `/o.js` on a routed `https://host.example` page: uncaught error, unhandled rejection, `oops.capture` / `oops.message`, queue replay, breadcrumbs (click, navigation, failed fetch), frames, `source: "sdk"`; dedup within 2 s; `setUser` / `setContext` / `breadcrumb`; bad key never throws; localhost skipped unless `data-local` |
| `dashboard.spec.ts` | UI: log in, create a project, settings snippet with the public key, inbox lists ingested issues, Resolve / Ignore from the issue page, status tabs follow |

`bun run test:critical` runs only the `@critical` tests.

## UI vocabulary the suite depends on

Selectors are role / label / text based on these English strings (plus two
`data-*` hooks), so the web app must keep them:

- `/login` and `/signup`: labels **Email**, **Password**; buttons **Log in**, **Create account**; both land on `/dashboard`. The marketing header (`role=banner`) has a `[data-auth-state]` element with a **Log out** button.
- `/dashboard`: heading containing **Projects**; button **New project**; input labelled **Project name**; submit button starting with **Create**; project cards are links named after the project. Creating lands on `/dashboard/projects/<id>/settings`.
- Settings: an element with `data-public-key="oops_pub_…"` and `data-testid="snippet"` whose text contains `o.js` and the key.
- `/dashboard/projects/<id>`: the inbox lists issue titles (`Type: message`) as links to `/dashboard/projects/<id>/issues/<…>`; status tabs **Open**, **Resolved**, **Ignored**, **All** (role `tab`, link or button) whose accessible name starts with the word and includes the count.
- Issue page: heading with the title, the top frame's file name visible, buttons **Resolve**, **Ignore**, **Reopen** (exact), and the status word (**Resolved**) shown.

## Browser flags

Chromium runs with Local Network Access checks disabled so the routed
`https://host.example` page can load `/o.js` from, and post to, the loopback
stack; the UA is a normal desktop Chrome so events parse into a real
browser / os / device.
