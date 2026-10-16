# oops

**Open-source, privacy-friendly web analytics for your apps, your scripts and your AI agents.**
Register a project per site, drop one script tag (or a pixel, or one HTTP call)
into it, and see page views, visitors, top pages, referrers, countries and
cities, devices, browsers, languages, UTM campaigns and custom events — live.
No cookies, no stored IP addresses, nothing to put in a consent banner. Read it
in the dashboard, through a role-scoped REST API, or let an agent do it through
the MCP server. MIT.

> Built by Enrique Magallon Alvarez. Hosted edition runs at `oops.3m4.net`
> (free during early access); the core is free to self-host.

---

## Why oops

- **One tag, any stack.** A zero-dependency tracker under 3 KB (`/m.js`) that
  counts page views, follows single-page-app route changes and exposes
  `oops.track()` for custom events. Works in Qwik, Astro, React, jQuery
  pages and Phaser games alike.
- **Or no JavaScript at all.** A 1×1 pixel for emails and READMEs, and a
  collect API for backends, CLIs and cron jobs.
- **Privacy by default.** The tracker sets no cookie and stores nothing in
  the browser. The server hashes IPs with a daily salt, keeps only the
  derived country / region / city, discards the user agent once device /
  browser / OS are known, and drops query strings from page URLs. Projects
  that need raw addresses flip one switch (`store_ip`) and get them in the
  event log and as a breakdown.
- **Agents are users too.** API keys carry a role (viewer / editor / admin),
  every mutation is audited, destructive tools ask for confirmation.
- **Your site never sees an error.** Hits over the monthly budget are counted
  and dropped with a 202; only creating new projects is blocked.
- **Self-host friendly.** Plain Docker, Postgres as the single store (raw
  events, aggregated on the fly), optional GeoLite2 file, no billing provider.

## Architecture

```
Caddy (reverse proxy)
 ├─ web   Qwik City (Bun)  landing + /info + /blog + dashboard + /m.js
 ├─ api   Flask            auth, projects, collect + pixel, stats, keys, audit, billing webhooks
 └─ mcp   Node (MCP)       AI-agent access: tools over the API, RBAC, confirmations, audit
      Postgres (events + everything else) · Redis (rate limits) · GeoLite2 (optional)
```

```
dbcore/               shared Python core (models, events, stats, plans, rbac, audit, usage)
services/api/         Flask REST API
apps/web/             Qwik City frontend (Bun): marketing, dashboard, serves the tracker
packages/tracker/     the tracker script (TypeScript, zero deps) → apps/web/public/m.js
packages/mcp-server/  MCP server (npm: oops-errors-mcp) — stdio + Streamable HTTP
packages/shared/      plan_limits.json, api_key_roles.json, feature_flags.json (single source of truth)
deploy/               docker-compose, Caddyfile, production runbook
db/                   Alembic migrations
e2e/                  Playwright end-to-end suite
```

The interface contract is [`CONTRACT.md`](CONTRACT.md); the plan is
[`PROJECT_PLAN.md`](PROJECT_PLAN.md).

## Quick start (Docker)

```bash
cp .env.example .env        # then edit secrets (JWT_SECRET_KEY, IP_HASH_SECRET, ...)
make geoip                  # optional: put a GeoLite2-City.mmdb in deploy/geoip for locations
make up                     # build + start everything; creates the schema
# open http://localhost:8084
```

### Self-host (no billing)

```bash
make up-selfhost            # BILLING_ENABLED=false; paywalls hidden, limits unlimited
```

## Counting visits to your app

Create a project in the dashboard and copy its public key (`oops_pub_…`). The
key is public by design: it can only *send* hits, never read anything.

### 1. The tracker (one tag)

```html
<script defer src="https://metrics.3m4.net/m.js" data-key="oops_pub_…"></script>
```

Counts every page view and SPA route change. Attributes: `data-spa`,
`data-hash`, `data-dnt`, `data-local`, `data-api`. Custom events:

```js
oops.track("signup", { plan: "pro" });
```
```html
<button data-oops-event="cta_click" data-oops-props='{"where":"hero"}'>Start</button>
```

### 2. The pixel (no JavaScript)

```html
<img src="https://oops.3m4.net/api/collect/pixel.gif?k=oops_pub_…&u=/newsletter/october" alt="" width="1" height="1">
```

### 3. The collect API (backends, CLIs, cron)

```bash
curl -X POST https://oops.3m4.net/api/collect \
  -H "X-Project-Key: oops_pub_…" -H "Content-Type: application/json" \
  -d '{"n":"purchase","u":"https://myapp.example.com/checkout","p":{"amount":42},"s":"api"}'
# HTTP 202 {"ok":true}
```

Fields: `n` (event name, default `pageview`), `u` (URL or path), `r`
(referrer), `t` (title), `w`/`h` (screen), `l` (language), `p` (props ≤ 2 KB),
`s` (`script` | `pixel` | `api`). JSON, form-encoded and `text/plain` bodies
are all accepted.

## Reading the numbers

```bash
curl "https://oops.3m4.net/api/projects/$PROJECT/stats?period=7d&country=ES" -H "X-API-Key: oops_live_…"
```

One call returns totals, the previous period, a time series, the top values of
every dimension and the live counter. `…/stats/breakdown?by=path` pages through
one dimension; `…/events` lists raw hits; `…/live` is the last five minutes.

## AI agents (MCP)

```bash
# local, from npm
claude mcp add oops --scope user --env OOPS_API_KEY=oops_live_… -- npx -y oops-errors-mcp
# remote, nothing to install
claude mcp add --transport http oops https://oops.3m4.net/mcp --header "Authorization: Bearer oops_live_…"
```

Claude Desktop / Cursor (JSON config):

```json
{ "mcpServers": { "oops": { "command": "npx", "args": ["-y", "oops-errors-mcp"], "env": { "OOPS_API_KEY": "oops_live_…" } } } }
```

Then: *"how did the docs do this week?"*, *"which countries visit the pricing
page?"*, *"write the weekly report for Kinegram"*. See
[`packages/mcp-server`](packages/mcp-server/) for the tool/role table.

## Screenshots

_Coming with the first release: overview, events log, settings._

## Common tasks

| Command | Does |
|---|---|
| `make up` / `make down` | start / stop the full stack |
| `make up-selfhost` | start without billing |
| `make logs` | tail all logs |
| `make migrate` | create tables + apply Alembic migrations |
| `make prune` | delete events older than each plan's retention window |
| `make tracker` | rebuild the tracker bundle into `apps/web/public` |
| `make geoip` | copy the shortener's local GeoLite2 database (dev) |
| `make smoke` | curl health, tracker headers and a collect → stats round-trip |
| `make e2e` | run the Playwright suite against the running stack |

## Languages and theme

Same language picker (34 country locales) and light/dark theme as the other
3m4 apps; the choice is shared across them through `localStorage`.

## License

MIT — see [`LICENSE`](LICENSE).
