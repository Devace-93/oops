# oops — Error tracking — Project Plan

> Status: Phase 1 (MVP) in progress. Last updated: 2026-10-16.

Owner: Enrique Magallon Alvarez. License: **MIT** (open-source core, self-hostable).

oops catches the errors your apps throw — in the browser, on the server, in
scripts and in AI agents — groups them into issues, tells you how many users
each one affects and in which release and environment it happens, and lets
you resolve or ignore them from the dashboard, the API or an MCP client.

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Stack | Same as 3m4 / exp / retro / metrics: Flask API + PostgreSQL + Redis, Qwik City frontend (Bun), MCP server (TS), Caddy, Docker |
| Domain | `oops.3m4.net`, single host: web + `/api` + `/mcp` + `/o.js` |
| Brand | Tailwind **fuchsia** (red / rose would clash with the danger buttons and the `error` level badge) |
| Auth | Roll-your-own JWT + refresh tokens; management API keys `oops_live_…` with roles; per-project **public keys** `oops_pub_…` for the ingest API and the SDK |
| Tenancy | Account is the billing unit; users join via memberships |
| Model | account → projects → issues → events. One row per occurrence; issues are the grouping by fingerprint with denormalised counters updated on ingest; `issue_users` keeps distinct users per issue |
| Grouping | Client `fingerprint[]` wins; otherwise `type` + normalised message + top in-app frame. Resolved issues reopen on a new event (`regressed_at`), ignored ones stay ignored |
| Integration surfaces | (1) `/o.js` browser SDK (onerror, unhandledrejection, optional console, breadcrumbs, `oops.capture()`), (2) `POST /api/ingest` + `/batch` (CORS `*`, `text/plain` bodies) for backends, CLIs and agents, (3) management API + MCP server for triage |
| Dimensions | level, environment, release, browser, os, device, type |
| Privacy | Never store raw user agents; raw IPs only when a project opts in (`store_ip`); query strings and fragments dropped from URLs; secret-looking keys scrubbed (`[Filtered]`) in tags / extra / breadcrumbs / user; no geo lookup (not needed for errors) |
| Limits | Hard: projects, API keys (402). Soft-drop: events/month (202, counted, not stored past the budget; a failing app never gets a second error back). Retention per plan, pruned by `dbcore.cli prune-events` |
| Early access | Feature `early-access` ON ⇒ enterprise limits for everyone, billing hidden |
| Own feature switches | Called **features**; PostHog keys prefixed `oops-` (one PostHog project shared with the other 3m4 apps) |
| i18n / theme | Same 34 locales and `3m4.lang` / `3m4.theme` storage keys as the other apps |
| Production | Another compose project on the 3m4 Hetzner box (`/opt/oops`); routed by the 3m4 edge Caddy over the `edge` network |
| MCP npm name | `oops-errors-mcp` (`oops-mcp` is taken) |
| GitHub | `Devace-93/oops` |

## 2. Phases

- **Phase 1 — MVP (now):** auth, projects + public keys, ingest API (+ batch)
  with stack parsing, fingerprinting, scrubbing and issue upsert, browser SDK,
  issues list / detail / events, stats (totals, previous period, series,
  breakdowns, live), dashboard (issues inbox with status tabs and filters,
  issue page with stack trace, breadcrumbs, tags, occurrences, resolve /
  ignore; events log; settings with snippets), API keys + RBAC + audit, MCP
  server with `triage` prompt, marketing pages, i18n, theme, e2e suite, deploy.
- **Phase 2:** alerts (email / webhook on new issue, regression, spike),
  source maps upload + frame de-minification, issue assignment and comments,
  merge issues, per-issue sampling, release health (crash-free users), a
  Python / Node helper package, public issue share links, CSV export.
- **Phase 3:** billing on (RevenueCat), team members and invitations,
  dogfooding (oops on every 3m4 app, including oops itself, via the SDK and
  the Flask error handler).

## 3. Open questions

- npm publish of `oops-errors-mcp`.
- Whether `info.3m4.net` lists oops as `building` or `live` at first deploy.
- Whether the Flask apps (3m4, exp, retro, metrics) report their own 500s to
  oops through a shared `dbcore` error handler.
