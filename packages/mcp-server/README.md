# oops-errors-mcp

[Model Context Protocol](https://modelcontextprotocol.io) server for
[oops](https://oops.3m4.net), the privacy-friendly web-analytics service.
Lets an AI agent (Claude Code, Claude Desktop, Cursor, the MCP Inspector, your
own app) read page views, visitors, pages, referrers, countries, devices and
custom events per project, inspect raw hits, and manage projects — with
**role-based tool access**, a **human approval step** for destructive actions,
and an **audit trail**.

```
npx oops-errors-mcp                     # stdio (local hosts)
https://oops.3m4.net/mcp         # Streamable HTTP (remote hosts)
```

## Quick start

1. Create an API key in the dashboard (`/dashboard/settings`) and pick a role.
2. Register the server with your host.

**Claude Code**

```bash
claude mcp add oops --scope user \
  --env OOPS_API_KEY=oops_live_… \
  -- npx -y oops-errors-mcp
```

**Cursor / Claude Desktop / any JSON config**

```json
{
  "mcpServers": {
    "oops": {
      "command": "npx",
      "args": ["-y", "oops-errors-mcp"],
      "env": { "OOPS_API_KEY": "oops_live_…" }
    }
  }
}
```

**Remote (Streamable HTTP)** — no install, the key travels as a Bearer token:

```bash
claude mcp add --transport http oops https://oops.3m4.net/mcp \
  --header "Authorization: Bearer oops_live_…"
```

Then ask: *"how is Kinegram doing this week?"*, *"which countries visit the
pricing page most?"*, *"what did the newsletter campaign bring?"*, *"list the
signup events from mobile"*, *"write the weekly report"*.

## Configuration

| Variable            | Default                       | Meaning |
|---------------------|-------------------------------|---------|
| `OOPS_API_KEY`   | —                             | Required for stdio. The oops management API key (`oops_live_…`). |
| `OOPS_API_URL`   | `https://oops.3m4.net/api` | API base URL. Self-hosters point this at their instance. |
| `OOPS_AUDIT_LOG` | `stderr`                      | `stderr`, `none`, or a file path (JSON lines). |
| `OOPS_MCP_PORT`  | `3333`                        | HTTP entrypoint only. |

Project public keys (`oops_pub_…`) are **not** accepted: they can only call
the collect API and carry no role.

## Roles and tools (RBAC)

Each API key has a role. The server asks the API for the key's scopes once
(`GET /apikeys/me`) and **only registers the tools those scopes allow**, so a
read-only key never even lists `purge_events`. Every call is re-checked at
call time, and the API enforces the same scopes independently — three layers,
and a bug in the server can hide access but never grant it.

| Tool                 | Scope             | viewer | editor | admin | Notes |
|----------------------|-------------------|:------:|:------:|:-----:|-------|
| `list_projects`      | `projects:read`   | ✓ | ✓ | ✓ | search with `q`; 30-day counts, last hit |
| `get_project`        | `projects:read`   | ✓ | ✓ | ✓ | public key, time zone, allowed hostnames, switches |
| `project_summary`    | `stats:read`      | ✓ | ✓ | ✓ | today / yesterday / 7d / 30d, live, all-time |
| `get_stats`          | `stats:read`      | ✓ | ✓ | ✓ | totals, previous period, series, every breakdown, live; `filters` |
| `get_breakdown`      | `stats:read`      | ✓ | ✓ | ✓ | one dimension, paginated |
| `list_events`        | `stats:read`      | ✓ | ✓ | ✓ | raw hits with props; `kind`, `q` |
| `get_live`           | `stats:read`      | ✓ | ✓ | ✓ | last 5 minutes |
| `get_usage`          | `usage:read`      | ✓ | ✓ | ✓ | events / dropped / counts vs. plan limits |
| `create_project`     | `projects:write`  |   | ✓ | ✓ | returns the public key + snippet |
| `update_project`     | `projects:write`  |   | ✓ | ✓ | pause tracking, bots, store raw IPs, time zone, allowed hostnames… |
| `rotate_project_key` | `projects:write`  |   | ✓ | ✓ | old key stops working immediately |
| `delete_project`     | `projects:delete` |   |   | ✓ | **confirmation required** |
| `purge_events`       | `events:delete`   |   |   | ✓ | **confirmation required**; optional `before` date |
| `get_audit_log`      | `audit:read`      |   |   | ✓ | |

Roles are defined once in
[`packages/shared/api_key_roles.json`](../shared/api_key_roles.json) and
shared by the API, the dashboard and this server.

Also exposed: resources `oops://projects` and `oops://projects/{id}/summary`,
and the `weekly_report` prompt (last 7 days vs the week before: trend, daily
shape, sources, pages, devices, things to look into — read-only).

## Human approval for destructive actions

`delete_project` and `purge_events` are irreversible, so they never run on the
model's say-so alone:

- On hosts that support MCP **elicitation** (Claude Code, Inspector) the user
  gets a native confirmation dialog showing exactly what will be deleted.
- On hosts that don't (and always over HTTP, which is stateless), the tool
  refuses with `confirmation_required` until the model calls it again with
  `confirm: true` — which it can only honestly do after asking the user.

`rotate_project_key` is not gated but is marked destructive: every snippet
using the previous key stops working the moment it runs. Prefer
`update_project` with `collect_enabled: false` over deleting a project.

## Audit trail

Two complementary logs:

- **Server-side** (`audit_events` table, `GET /account/audit`, tool
  `get_audit_log`): every mutation and every authorization denial, written in
  the same transaction as the change.
- **Agent-side** (`OOPS_AUDIT_LOG`, JSON lines): every tool call the agent
  attempted, including ones refused locally that never reached the API, with
  duration, outcome (`ok|denied|error|cancelled|pending`) and compacted args.

## Design notes

- **Structured outputs.** Every tool declares an `outputSchema` and returns
  `structuredContent`; hosts can validate and chain results without parsing
  prose. Objects mirroring API responses allow extra fields, so an additive
  API change never breaks client-side validation.
- **Errors are results.** API errors come back as `isError` with the stable
  code (`limit_reached` + `which`, `key_taken`, `invalid_timezone`,
  `invalid_origins`, `insufficient_scope`, `not_found`…) so the model can
  recover instead of crashing.
- **stdio hygiene.** stdout is the protocol channel; all logging goes to stderr.
- **Stateless HTTP.** Each request builds a server bound to the caller's key;
  tenants can never share state. The `/apikeys/me` lookup is cached 60 s per key.

## Development

```bash
bun install
bun test            # in-memory MCP client ↔ server against a fake API
bun run build
OOPS_API_KEY=… OOPS_API_URL=http://localhost:8084/api bun run inspect   # MCP Inspector
OOPS_API_KEY=… OOPS_API_URL=http://localhost:8084/api bun run dev:http  # http://localhost:3333/mcp
```

The Docker image (`packages/mcp-server/Dockerfile`) runs the HTTP flavour and
is wired into `deploy/docker-compose.yml` as the `mcp` service, exposed by
Caddy at `/mcp`.

## License

MIT © Enrique Magallon Alvarez
