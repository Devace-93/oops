# oops — Web analytics — Project Plan

> Status: Phase 1 (MVP) in progress. Last updated: 2026-10-15.

Owner: Enrique Magallon Alvarez. License: **MIT** (open-source core, self-hostable).

oops counts the visits to your apps — page views, visitors, pages,
referrers, countries and cities, devices, browsers, languages, UTM campaigns
and custom events — from one script tag, a tracking pixel or an API call,
without cookies and without storing anyone's IP address.

## 1. Locked decisions

| Topic | Decision |
|---|---|
| Stack | Same as 3m4 / exp / retro: Flask API + PostgreSQL + Redis, Qwik City frontend (Bun), MCP server (TS), Caddy, Docker |
| Domain | `oops.3m4.net`, single host: web + `/api` + `/mcp` + `/m.js` |
| Brand | Tailwind **fuchsia** |
| Auth | Roll-your-own JWT + refresh tokens; management API keys `oops_live_…` with roles; per-project **public keys** `oops_pub_…` for the collect API, the tracker and the pixel |
| Tenancy | Account is the billing unit; users join via memberships |
| Model | account → projects → events (one row per hit, aggregated on the fly with indexed GROUP BY; no roll-ups yet) |
| Integration surfaces | (1) `/m.js` tracker (SPA-aware, `oops.track()`, `data-oops-event`), (2) `/api/collect/pixel.gif`, (3) `POST /api/collect` (CORS `*`, `text/plain` bodies), (4) management API + MCP server for reading stats |
| Dimensions | path, hostname, referrer, country, region, city, device, browser, os, lang, utm_source / medium / campaign, custom event name |
| Visitors | Daily, per-project, cookie-less hash of (IP, UA): no cookie, no storage, no cross-day identity; multi-day visitor totals are daily uniques summed |
| Privacy | Never store raw user agents; raw IPs only when a project opts in (`store_ip`, off by default); drop URL query strings (UTM tags only); geo from GeoLite2 (shared with the shortener on the server), switchable with the `geo` feature; bot filter on by default |
| Limits | Hard: projects, API keys (402). Soft-drop: events/month (202, counted, not stored past the budget; a tracked site never sees an error). Retention per plan, pruned by `dbcore.cli prune-events` |
| Early access | Feature `early-access` ON ⇒ enterprise limits for everyone, billing hidden |
| Own feature switches | Called **features**; PostHog keys prefixed `oops-` (one PostHog project shared with 3m4/exp/retro) |
| i18n / theme | Same 34 locales and `3m4.lang` / `3m4.theme` storage keys as the other apps |
| Production | Another compose project on the 3m4 Hetzner box; routed by the 3m4 edge Caddy over the `edge` network; GeoLite2 mounted from `/opt/3m4/deploy/geoip` |
| MCP npm name | `oops-errors-mcp` |

## 2. Phases

- **Phase 1 — MVP (now):** auth, projects + public keys, collect API + pixel +
  tracker, stats (totals, previous period, series, breakdowns, live, raw
  events), dashboard (overview with chart / KPIs / click-to-filter breakdowns,
  events log, settings with snippets), API keys + RBAC + audit, MCP server,
  marketing pages, i18n, theme, e2e suite, deploy.
- **Phase 2:** daily roll-up table for projects past ~1M events, sessions /
  bounce rate / time on page (needs a leave beacon), goals and funnels, email
  weekly report, public shareable dashboards (`/s/<slug>`), CSV export, more
  dimensions (screen class, entry/exit pages), Cloudflare-style country header
  support for hosts behind a CDN.
- **Phase 3:** billing on (RevenueCat), team members and invitations,
  dogfooding (oops on every 3m4 app, including oops itself).

## 3. Open questions

- npm publish of `oops-errors-mcp`.
- Whether `info.3m4.net` lists oops as `building` or `live` at first deploy.
