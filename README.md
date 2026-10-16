# oops

**Open-source error tracking for your apps, your scripts and your AI agents.**
Register a project per app, drop one script tag into it (or one HTTP call
into your backend), and every exception shows up grouped into an issue with
its stack trace, breadcrumbs, affected users, release and environment — live.
Resolve or ignore from the dashboard, through a role-scoped REST API, or let
an agent triage it through the MCP server. MIT.

> Built by Enrique Magallon Alvarez. Hosted edition runs at `oops.3m4.net`
> (free during early access); the core is free to self-host.

---

## Why oops

- **One tag, any stack.** A zero-dependency browser SDK under 4 KB (`/o.js`)
  that catches `window.onerror`, unhandled promise rejections and (optionally)
  `console.error`, keeps a trail of clicks, route changes and failed requests
  as breadcrumbs, and exposes `oops.capture()` for errors you handle yourself.
  Works in Qwik, Astro, React, jQuery pages and Phaser games alike.
- **Or no JavaScript at all.** An ingest API for backends, CLIs, cron jobs
  and agents: one `POST` with the project key, any language.
- **Grouped, not flooded.** Events are fingerprinted (error type + normalised
  message + the frame that threw) into issues with a per-project `#number`,
  event and user counts, first / last seen, environments and releases.
  Resolved issues reopen by themselves when the error comes back.
- **Privacy by default.** No raw user agents, no raw IPs unless a project
  opts in, query strings dropped from URLs, secret-looking keys scrubbed to
  `[Filtered]` in tags, extra, breadcrumbs and user objects.
- **Agents are users too.** API keys carry a role (viewer / editor / admin),
  every mutation is audited, destructive tools ask for confirmation, and an
  agent can report its own failures into a project.
- **Your app never gets a second error.** Events over the monthly budget, from
  a paused project or an unknown origin are acknowledged with a 202 and
  dropped; only creating new projects is blocked.
- **Self-host friendly.** Plain Docker, Postgres as the single store, Redis
  for rate limits, no billing provider, no geo database.

## Architecture

```
Caddy (reverse proxy)
 ├─ web   Qwik City (Bun)  landing + /info + /blog + dashboard + /o.js
 ├─ api   Flask            auth, projects, ingest + grouping, issues, stats, keys, audit, billing webhooks
 └─ mcp   Node (MCP)       AI-agent access: tools over the API, RBAC, confirmations, audit
      Postgres (events, issues and everything else) · Redis (rate limits)
```

```
dbcore/               shared Python core (models, ingest, fingerprinting, stats, plans, rbac, audit, usage)
services/api/         Flask REST API
apps/web/             Qwik City frontend (Bun): marketing, dashboard, serves the SDK
packages/sdk/         the browser SDK (TypeScript, zero deps) → apps/web/public/o.js
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
make up                     # build + start everything; creates the schema
# open http://localhost:8084
```

### Self-host (no billing)

```bash
make up-selfhost            # BILLING_ENABLED=false; paywalls hidden, limits unlimited
```

## Reporting errors from your app

Create a project in the dashboard and copy its public key (`oops_pub_…`). The
key is public by design: it can only *send* events, never read anything, and
you can rotate it at any time.

### 1. The browser SDK (one tag)

```html
<script defer src="https://oops.3m4.net/o.js"
        data-key="oops_pub_…" data-env="production" data-release="1.4.2"></script>
```

Uncaught errors and unhandled rejections are reported automatically, with the
last 30 breadcrumbs (clicks, route changes, failed `fetch` / XHR). Attributes:
`data-env`, `data-release`, `data-console` (also capture `console.error`),
`data-sample`, `data-local`, `data-api`, `data-user`. Errors you catch
yourself, and who they happened to:

```js
try {
  await checkout(cart);
} catch (err) {
  oops.capture(err, { level: "error", tags: { page: "checkout" }, extra: { cart: cart.size } });
}

oops.setUser({ id: "u_42", email: "ada@example.com" });   // affected-user counts; null to clear
oops.setTag("plan", "pro");
oops.breadcrumb({ category: "payment", message: "3DS challenge shown" });
oops.message("Cart restored from local storage", "info");
```

### 2. Server-side (backends, CLIs, cron, agents)

Post one event to the ingest API with the project key. Give at least `type`
or `message`; `stack` is parsed server-side (V8, Firefox / Safari and Python
traceback formats). Always answers **202**: `{ok:true, event_id, issue_id,
issue_number}` or `{ok:false, reason}` (`paused` | `origin` | `limit`).

```bash
curl -X POST https://oops.3m4.net/api/ingest \
  -H "X-Project-Key: oops_pub_…" -H "Content-Type: application/json" \
  -d '{"type":"TimeoutError","message":"upstream took 30s","level":"error",
       "platform":"shell","release":"2026.10.16","tags":{"job":"nightly-sync"}}'
```

```python
import requests, sys, traceback

def report(exc, **extra):
    requests.post(
        "https://oops.3m4.net/api/ingest",
        headers={"X-Project-Key": "oops_pub_…"},
        json={
            "type": type(exc).__name__,
            "message": str(exc),
            "stack": "".join(traceback.format_exception(exc)),
            "platform": "python",
            "release": "1.4.2",
            "environment": "production",
            "extra": extra,
        },
        timeout=3,
    )

try:
    run_job()
except Exception as exc:
    report(exc, job="nightly-sync")
    sys.exit(1)
```

```js
process.on("uncaughtException", (err) => {
  fetch("https://oops.3m4.net/api/ingest", {
    method: "POST",
    headers: { "X-Project-Key": "oops_pub_…", "Content-Type": "application/json" },
    body: JSON.stringify({
      type: err.name, message: err.message, stack: err.stack,
      platform: "node", release: process.env.RELEASE, environment: process.env.NODE_ENV,
    }),
    keepalive: true,
  }).finally(() => process.exit(1));
});
```

Fields: `type`, `message`, `level` (`fatal` | `error` | `warning` | `info`),
`stack` or `frames` (top of the stack first), `url`, `release`,
`environment`, `platform`, `user` (`id`, `email`, `name`), `tags`, `extra`,
`breadcrumbs`, `fingerprint` (explicit grouping key), `ts`. JSON,
form-encoded and `text/plain` bodies are all accepted; the key can also travel
in the body as `k`.

### 3. Batch

```bash
curl -X POST https://oops.3m4.net/api/ingest/batch \
  -H "X-Project-Key: oops_pub_…" -H "Content-Type: application/json" \
  -d '{"events":[{"type":"ValueError","message":"bad input"},{"message":"retrying","level":"warning"}]}'
# 202 {"ok":true,"results":[{...},{...}]}
```

Up to 20 events per batch, 64 KB per request.

## Triage

```bash
# open issues of the last 7 days, the ones hurting most users first
curl "https://oops.3m4.net/api/projects/$PROJECT/issues?period=7d&sort=users" -H "X-API-Key: oops_live_…"

# one issue by number, with its latest event (frames, breadcrumbs, tags)
curl "https://oops.3m4.net/api/projects/$PROJECT/issues/12" -H "X-API-Key: oops_live_…"

# resolve it (it reopens as "regressed" if the error comes back); ignored | open also work
curl -X PATCH "https://oops.3m4.net/api/projects/$PROJECT/issues/12" \
  -H "X-API-Key: oops_live_…" -H "Content-Type: application/json" -d '{"status":"resolved"}'

# the numbers: totals vs previous period, series, breakdowns by level / environment / release / browser / os / device / type
curl "https://oops.3m4.net/api/projects/$PROJECT/stats?period=7d&environment=production" -H "X-API-Key: oops_live_…"
```

`…/issues/bulk` sets one status on up to 100 issues, `…/issues/12/events`
pages through the occurrences, `…/events` searches raw events, `…/live` is
the last few minutes. See [`CONTRACT.md`](CONTRACT.md) for every endpoint.

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

Then: *"what is breaking in checkout today?"*, *"show me issue #12 and its
stack"*, *"which errors affect the most users since release 1.4.2?"*,
*"resolve everything from the old release"*, *"triage the API project"*, or
*"report this failure to the agents project"* (`report_error` posts the
agent's own exception into a project it can see). The `triage` prompt
summarises new vs regressed issues and proposes what to fix, resolve or
ignore. See [`packages/mcp-server`](packages/mcp-server/) for the tool/role
table.

## How events are grouped

An event joins the issue with the same **fingerprint**: the client-provided
`fingerprint` array when present, otherwise `type` + the normalised message +
the top in-app frame (file without query string + function). Normalisation
replaces numbers, hex blobs, UUIDs and quoted strings with placeholders, so
`User 42 not found` and `User 43 not found` are one issue. A resolved issue
that receives a new event reopens and is flagged as regressed; an ignored one
stays ignored but keeps counting.

## Privacy

Raw IPs are hashed with a daily salt (a project can opt in to keep them with
`store_ip`); the user agent is reduced to browser / OS / device and discarded;
URLs lose their query string and fragment; anything that looks like a
password, token, cookie, API key or card number inside tags, extra,
breadcrumbs, user or the message is replaced by `[Filtered]`. The `user`
object you send (`id`, `email`, `name`) is stored as sent: it is your own
identifier for your own user. Events are kept for the plan's retention window
and pruned nightly.

## Screenshots

_Coming with the first release: issues inbox, issue page, settings._

## Common tasks

| Command | Does |
|---|---|
| `make up` / `make down` | start / stop the full stack |
| `make up-selfhost` | start without billing |
| `make logs` | tail all logs |
| `make migrate` | create tables + apply Alembic migrations |
| `make prune` | delete events older than each plan's retention window |
| `make sdk` | rebuild the browser SDK into `apps/web/public` (`o.js` + `o/v1.js`) |
| `make smoke` | curl health, SDK headers and an ingest → issues round-trip |
| `make e2e` | run the Playwright suite against the running stack |

## Languages and theme

Same language picker (34 country locales) and light/dark theme as the other
3m4 apps; the choice is shared across them through `localStorage`.

## License

MIT — see [`LICENSE`](LICENSE).
