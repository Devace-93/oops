/**
 * The oops MCP server: tools, resources and prompts over the oops management
 * API (plus the ingest endpoint for `report_error`).
 *
 * Design notes (the parts worth reading before changing anything):
 *
 * - **RBAC, three layers.** The key's scopes (from `GET /apikeys/me`) decide
 *   which tools are *registered* (hidden tools are never listed), each handler
 *   re-checks its scopes at call time, and the REST API enforces the same
 *   scopes independently. See `rbac.ts`.
 * - **Human approval for destructive actions.** `delete_project` and
 *   `purge_events` ask the user through MCP *elicitation* when the client
 *   supports it (Claude Code, the Inspector). Otherwise they refuse until the
 *   model passes `confirm: true`, which forces the model to ask the user first.
 * - **Structured outputs.** Every tool declares an `outputSchema` and returns
 *   `structuredContent`, so hosts can validate and chain results without
 *   parsing prose. Objects that mirror API responses are *loose* (extra fields
 *   allowed) so an additive API change never breaks client-side validation.
 *   The text content is a compact, human/agent-readable summary.
 * - **Errors are results, not exceptions.** API errors come back as
 *   `isError: true` with the stable error code, so the model can recover
 *   (e.g. `limit_reached` → tell the user to upgrade) instead of crashing.
 * - **Everything is audited**, locally (`audit.ts`) and server-side.
 */
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { compactArgs, type AuditEntry, type AuditOutcome, type AuditSink } from "./audit.js";
import { OopsApiError, type OopsClient } from "./client.js";
import { InvalidIssueRef, formatIssueRef, parseIssueRef } from "./issue.js";
import { TOOL_SCOPES, hasAllScopes, type ToolName } from "./rbac.js";
import type { BreakdownRow, Event, Issue, KeyInfo, Project, Scope, Stats, StatsTotals } from "./types.js";
import { VERSION } from "./version.js";

export interface OopsServerOptions {
  client: OopsClient;
  keyInfo: KeyInfo;
  audit: AuditSink;
  /** Label written to the audit log: "stdio" | "http". */
  transport?: string;
  /**
   * Whether destructive tools may ask the user via elicitation. Only safe on
   * a transport with a persistent back-channel (stdio). Default: true.
   */
  allowElicitation?: boolean;
}

// --------------------------------------------------------------------------- //
// Shared schema fragments (CONTRACT.md → REST API / Objects)
// --------------------------------------------------------------------------- //
const LEVELS = ["fatal", "error", "warning", "info"] as const;
const STATUSES = ["open", "resolved", "ignored"] as const;
const STATUS_FILTERS = ["open", "resolved", "ignored", "all"] as const;
const ISSUE_PERIODS = ["24h", "7d", "30d", "90d", "all"] as const;
const ISSUE_SORTS = ["last_seen", "first_seen", "events", "users"] as const;
const STATS_PERIODS = ["today", "yesterday", "24h", "7d", "30d", "90d", "12mo"] as const;
const INTERVALS = ["hour", "day", "month"] as const;
const PROJECT_KEY_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const projectId = z.uuid().describe("The project's id (UUID), as returned by list_projects or create_project.");
const issueRef = z
  .union([z.string().min(1).max(64), z.number().int().min(1)])
  .describe('The issue: its uuid, its per-project number (12) or "#12".');
const levelEnum = z.enum(LEVELS).describe("fatal | error | warning | info");
const statusEnum = z.enum(STATUSES).describe("open | resolved | ignored. resolved = fixed (reopens automatically if the error comes back); ignored = known noise, stays ignored; open = reopen.");
const confirmFlag = z
  .boolean()
  .default(false)
  .describe("Set to true only after the user explicitly confirmed this specific destructive action.");
const pageInput = z.number().int().min(1).default(1).describe("Page number (1-based).");
const perPageInput = z.number().int().min(1).max(100).default(25).describe("Rows per page (max 100).");

const eventFilters = {
  level: levelEnum.optional().describe("Only this level."),
  environment: z.string().max(40).optional().describe("Only this environment, e.g. production."),
  release: z.string().max(100).optional().describe("Only this release, e.g. 1.4.2 or a git sha."),
};

// Output schemas. `looseObject` = additionalProperties allowed (see header).
const countsObject = z.looseObject({
  open_issues: z.number(),
  events_24h: z.number(),
  events_30d: z.number(),
  users_30d: z.number(),
  last_event_at: z.string().nullable().optional(),
});
const projectObject = z.looseObject({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  public_key: z.string().optional(),
  public_key_prefix: z.string(),
  timezone: z.string(),
  allowed_origins: z.array(z.string()),
  ingest_enabled: z.boolean(),
  store_ip: z.boolean().optional(),
  counts: countsObject.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const frameObject = z.looseObject({
  filename: z.string().nullable().optional(),
  function: z.string().nullable().optional(),
  lineno: z.number().nullable().optional(),
  colno: z.number().nullable().optional(),
  in_app: z.boolean(),
});
const breadcrumbObject = z.looseObject({
  ts: z.string().nullable().optional(),
  category: z.string(),
  message: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  data: z.record(z.string(), z.unknown()).nullable().optional(),
});
const userObject = z.looseObject({
  id: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
});
const eventObject = z.looseObject({
  id: z.string(),
  project_id: z.string(),
  issue_id: z.string(),
  issue_number: z.number(),
  ts: z.string(),
  level: z.string(),
  type: z.string().nullable().optional(),
  message: z.string(),
  frames: z.array(frameObject),
  stack_raw: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  path: z.string().nullable().optional(),
  hostname: z.string().nullable().optional(),
  release: z.string().nullable().optional(),
  environment: z.string(),
  platform: z.string().nullable().optional(),
  sdk: z.string().nullable().optional(),
  user: userObject.nullable().optional(),
  user_hash: z.string(),
  browser: z.string().nullable().optional(),
  os: z.string().nullable().optional(),
  device: z.string().nullable().optional(),
  ip: z.string().nullable().optional(),
  tags: z.record(z.string(), z.string()),
  extra: z.record(z.string(), z.unknown()),
  breadcrumbs: z.array(breadcrumbObject),
  source: z.string(),
});
const issueObject = z.looseObject({
  id: z.string(),
  project_id: z.string(),
  number: z.number(),
  fingerprint: z.string(),
  title: z.string(),
  culprit: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  level: z.string(),
  status: z.string(),
  first_seen: z.string(),
  last_seen: z.string(),
  resolved_at: z.string().nullable().optional(),
  regressed_at: z.string().nullable().optional(),
  event_count: z.number(),
  user_count: z.number(),
  environments: z.array(z.string()),
  releases: z.array(z.string()),
  latest_event_id: z.string().nullable().optional(),
  latest_event: eventObject.nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const pageOf = <T extends z.ZodType>(item: T) =>
  z.looseObject({ items: z.array(item), page: z.number(), per_page: z.number(), total: z.number() });
const totalsObject = z.looseObject({ events: z.number(), users: z.number(), issues_new: z.number(), issues_open: z.number().optional() });
const rowObject = z.looseObject({ value: z.string(), events: z.number(), users: z.number() });
const statsObject = z.looseObject({
  range: z.looseObject({ from: z.string(), to: z.string(), tz: z.string(), interval: z.string() }),
  totals: totalsObject,
  previous: totalsObject,
  series: z.array(z.looseObject({ ts: z.string(), events: z.number(), users: z.number() })),
  breakdowns: z.record(z.string(), z.array(rowObject)),
});
const liveObject = z.looseObject({ events: z.number(), window_min: z.number() });
const usageObject = z.looseObject({
  period_start: z.string(),
  period_end: z.string(),
  events: z.number(),
  events_dropped: z.number(),
  counts: z.looseObject({ projects: z.number(), api_keys: z.number() }),
  limits: z.record(z.string(), z.unknown()),
});
const auditEventObject = z.looseObject({
  id: z.string(),
  ts: z.string(),
  actor_type: z.string(),
  actor_id: z.string().nullable().optional(),
  actor_label: z.string().nullable().optional(),
  action: z.string(),
  target_type: z.string().nullable().optional(),
  target_id: z.string().nullable().optional(),
  outcome: z.string(),
  meta: z.record(z.string(), z.unknown()),
});
const ingestResultObject = z.looseObject({
  ok: z.boolean(),
  event_id: z.string().optional(),
  issue_id: z.string().optional(),
  issue_number: z.number().optional(),
  reason: z.string().optional(),
  project_id: z.string(),
});

/** A handler may return a plain result, or wrap it to record a non-"ok" audit outcome. */
type Wrapped = { result: CallToolResult; outcome: AuditOutcome };
type Handled = CallToolResult | Wrapped;

function isWrapped(out: Handled): out is Wrapped {
  return (
    typeof (out as Wrapped).outcome === "string" &&
    typeof (out as Wrapped).result === "object" &&
    !("content" in out)
  );
}

function structured(value: Record<string, unknown>, summary?: string): CallToolResult {
  return {
    content: [{ type: "text", text: summary ?? JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

function failure(code: string, message: string, extra: Record<string, unknown> = {}): CallToolResult {
  const detail = Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  return {
    content: [{ type: "text", text: `Error (${code}): ${message}${detail}` }],
    isError: true,
  };
}

// --------------------------------------------------------------------------- //
// Text summaries (what the model reads; the JSON travels in structuredContent)
// --------------------------------------------------------------------------- //
function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

function pct(cur: number, prev: number): string {
  if (!prev) return cur ? "new" : "±0%";
  const d = Math.round(((cur - prev) / prev) * 1000) / 10;
  return `${d > 0 ? "+" : ""}${d}%`;
}

function describeProject(p: Project): string {
  const c = p.counts
    ? `, ${p.counts.open_issues} open issue(s), ${p.counts.events_24h} events/24h, ${p.counts.events_30d} events / ${p.counts.users_30d} users in 30d, last event ${p.counts.last_event_at ?? "never"}`
    : "";
  const state = p.ingest_enabled ? "" : ", ingest PAUSED";
  return `${p.name} (key=${p.key}, id=${p.id}, tz=${p.timezone}${c}${state})`;
}

function describeIssue(i: Issue): string {
  const flags = [i.regressed_at && i.status === "open" ? "REGRESSED" : "", i.resolved_at && i.status === "resolved" ? `resolved ${i.resolved_at}` : ""]
    .filter(Boolean)
    .join(", ");
  const rel = i.releases.length ? ` · releases ${i.releases.slice(-3).join(", ")}` : "";
  const env = i.environments.length ? ` · env ${i.environments.join(", ")}` : "";
  return (
    `#${i.number} [${i.status}] ${i.level} ${truncate(i.title, 120)}${i.culprit ? ` — ${truncate(i.culprit, 80)}` : ""}` +
    ` · ${i.event_count} event(s) / ${i.user_count} user(s) · first ${i.first_seen} · last ${i.last_seen}${env}${rel}${flags ? ` · ${flags}` : ""}` +
    ` · id=${i.id}`
  );
}

function topFrame(e: Event): string {
  const f = e.frames?.[0];
  if (!f) return "";
  const loc = [f.filename, f.lineno != null ? `:${f.lineno}` : "", f.colno != null ? `:${f.colno}` : ""].join("");
  return ` @ ${f.function ?? "?"} (${loc || "?"})`;
}

function describeEvent(e: Event, verbose = false): string {
  const where = e.path ?? e.url ?? "";
  const ua = [e.browser, e.os, e.device].filter(Boolean).join("/");
  const user = e.user?.id ? ` user=${e.user.id}` : "";
  const head =
    `${e.ts} ${e.level} ${e.type ? `${e.type}: ` : ""}${truncate(e.message, 160)} (issue #${e.issue_number}, event ${e.id})` +
    `${where ? ` at ${where}` : ""}${topFrame(e)} · ${e.environment}${e.release ? ` ${e.release}` : ""}${ua ? ` · ${ua}` : ""}${user}${e.platform ? ` · ${e.platform}` : ""}${e.ip ? ` ip=${e.ip}` : ""}`;
  if (!verbose) return head;
  const lines = [head];
  if (e.frames?.length) {
    lines.push("Stack (top first):");
    for (const f of e.frames.slice(0, 15)) {
      lines.push(`  ${f.in_app ? "*" : " "} ${f.function ?? "?"} ${f.filename ?? "?"}${f.lineno != null ? `:${f.lineno}` : ""}${f.colno != null ? `:${f.colno}` : ""}`);
    }
    if (e.frames.length > 15) lines.push(`  … ${e.frames.length - 15} more frame(s)`);
  } else if (e.stack_raw) {
    lines.push("Stack (raw):", truncate(e.stack_raw, 1500));
  }
  if (Object.keys(e.tags ?? {}).length) lines.push(`Tags: ${JSON.stringify(e.tags)}`);
  if (Object.keys(e.extra ?? {}).length) lines.push(`Extra: ${truncate(JSON.stringify(e.extra), 800)}`);
  if (e.breadcrumbs?.length) {
    lines.push(`Breadcrumbs (last ${Math.min(e.breadcrumbs.length, 10)}):`);
    for (const b of e.breadcrumbs.slice(-10)) lines.push(`  ${b.ts ?? ""} ${b.category}${b.message ? ` ${truncate(b.message, 100)}` : ""}`);
  }
  if (e.user && (e.user.email || e.user.name)) lines.push(`User: ${[e.user.id, e.user.email, e.user.name].filter(Boolean).join(" ")}`);
  return lines.join("\n");
}

function describeTotals(t: StatsTotals, prev?: StatsTotals): string {
  const base = `${t.events} events, ${t.users} affected users, ${t.issues_new} new issue(s)${t.issues_open != null ? `, ${t.issues_open} open` : ""}`;
  if (!prev) return base;
  return `${base} (vs previous period: ${pct(t.events, prev.events)} events, ${pct(t.users, prev.users)} users, ${pct(t.issues_new, prev.issues_new)} new issues)`;
}

function describeRows(rows: BreakdownRow[], n = 6): string {
  return rows.slice(0, n).map((r) => `${truncate(r.value, 60)} ${r.events}`).join(", ") || "none";
}

function describeStats(s: Stats): string {
  const b = s.breakdowns;
  const peak = s.series.reduce<{ ts: string; events: number } | null>((acc, p) => (!acc || p.events > acc.events ? p : acc), null);
  return [
    `${s.range.from} → ${s.range.to} (${s.range.tz}, ${s.range.interval} buckets)`,
    `Totals: ${describeTotals(s.totals, s.previous)}.`,
    peak ? `Peak bucket: ${peak.ts} with ${peak.events} events (${s.series.length} buckets).` : "No events in range.",
    `By level (events): ${describeRows(b.level ?? [])}.`,
    `By environment: ${describeRows(b.environment ?? [])}. By release: ${describeRows(b.release ?? [])}.`,
    `Top error types: ${describeRows(b.type ?? [], 8)}.`,
    `Browsers: ${describeRows(b.browser ?? [], 5)}. OS: ${describeRows(b.os ?? [], 5)}. Devices: ${describeRows(b.device ?? [], 4)}.`,
  ].join("\n");
}

export function buildInstructions(info: KeyInfo): string {
  return [
    `oops is an error-tracking service. You are acting for account "${info.account.name}" (plan: ${info.account.plan}).`,
    `This API key has role "${info.role}" with scopes: ${info.scopes.join(", ")}. Only tools allowed by those scopes are listed; if a user asks for something outside them, say the key lacks that permission instead of guessing.`,
    "Model: an account has projects (one per app, site or service). A project receives error events through its public key (oops_pub_...), from the browser SDK (/o.js) or the ingest API. The server groups events into issues by fingerprint (type + normalised message + top in-app frame, or a client-provided fingerprint). An issue has a per-project number (#12), a status (open | resolved | ignored), event_count, user_count (distinct affected users), first_seen / last_seen, environments and releases. A resolved issue that gets a new event reopens with regressed_at set; an ignored one stays ignored.",
    "Start with list_projects to find a project id. Triage with list_issues (filters: status, level, environment, release, q, period, sort), read one with get_issue (uuid or #number; includes the latest event with its stack), see occurrences with list_issue_events, inspect one event with get_event, and search raw events with search_events. get_stats gives totals vs the previous period, a time series and breakdowns by level / environment / release / browser / os / device / type; get_live counts the last few minutes.",
    "Change state with update_issue (status: resolved to mark fixed, ignored for known noise, open to reopen) or bulk_update_issues. report_error posts an event into a project you can see, so you can report your own failures. Deleting a project or purging its events is irreversible: those tools require explicit user confirmation.",
  ].join("\n");
}

export function createOopsServer(opts: OopsServerOptions): McpServer {
  const { client, keyInfo, audit } = opts;
  const transport = opts.transport ?? "unknown";
  const allowElicitation = opts.allowElicitation ?? true;
  const scopes = new Set<Scope>(keyInfo.scopes);
  const actor = { account: keyInfo.account.id, prefix: keyInfo.prefix, role: keyInfo.role };

  const server = new McpServer(
    { name: "oops", version: VERSION },
    { instructions: buildInstructions(keyInfo) },
  );

  const log = (
    tool: ToolName,
    outcome: AuditOutcome,
    started: number,
    args?: unknown,
    extra: Partial<Pick<AuditEntry, "error" | "meta">> = {},
  ) =>
    audit.write({
      ts: new Date().toISOString(),
      event: "tool.call",
      transport,
      actor,
      tool,
      outcome,
      duration_ms: Date.now() - started,
      args: compactArgs(args),
      ...extra,
    });

  /**
   * Register a tool only if the key's scopes allow it, wrapping the handler
   * with the call-time scope re-check, error mapping and audit logging.
   */
  function tool<In extends z.ZodRawShape, Out extends z.ZodObject>(
    name: ToolName,
    config: {
      title: string;
      description: string;
      inputSchema: In;
      outputSchema: Out;
      annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
    },
    handler: (
      args: z.infer<z.ZodObject<In>>,
      extra: Parameters<Parameters<McpServer["registerTool"]>[2]>[1],
    ) => Promise<Handled>,
  ): void {
    const required = TOOL_SCOPES[name];
    if (!hasAllScopes(scopes, required)) return; // layer 1: never listed
    const requiredLabel = required.join(" + ");

    server.registerTool(
      name,
      {
        title: config.title,
        description: `${config.description} (requires scope ${requiredLabel})`,
        inputSchema: config.inputSchema,
        outputSchema: config.outputSchema,
        annotations: { title: config.title, ...config.annotations },
      },
      (async (args: z.infer<z.ZodObject<In>>, extra: Parameters<typeof handler>[1]) => {
        const started = Date.now();
        if (!hasAllScopes(scopes, required)) {
          // layer 2: refused even if somehow invoked
          log(name, "denied", started, args, { error: { code: "insufficient_scope", message: requiredLabel } });
          return failure("insufficient_scope", `This key (role ${keyInfo.role}) lacks ${requiredLabel}.`, {
            required_scope: requiredLabel,
          });
        }
        try {
          const out = await handler(args, extra);
          if (isWrapped(out)) {
            log(name, out.outcome, started, args);
            return out.result;
          }
          log(name, "ok", started, args);
          return out;
        } catch (err) {
          if (err instanceof OopsApiError) {
            // layer 3 (the API said no) or any other API-level failure
            log(name, err.code === "insufficient_scope" ? "denied" : "error", started, args, {
              error: { code: err.code, message: err.message },
            });
            return failure(err.code, err.message, { status: err.status, ...err.extra });
          }
          if (err instanceof InvalidIssueRef) {
            log(name, "error", started, args, { error: { code: "invalid_issue_ref", message: err.message } });
            return failure("invalid_issue_ref", err.message);
          }
          const message = err instanceof Error ? err.message : String(err);
          log(name, "error", started, args, { error: { code: "internal_error", message } });
          return failure("internal_error", message);
        }
      }) as never,
    );
  }

  /**
   * Shared confirmation flow for destructive tools: elicit when possible,
   * otherwise require `confirm: true`. Returns null when approved.
   */
  async function confirmOrRefuse(
    confirm: boolean,
    what: string,
    toolName: ToolName,
    cancelled: Record<string, unknown>,
  ): Promise<Wrapped | null> {
    if (confirm) return null;
    const canAsk = allowElicitation && Boolean(server.server.getClientCapabilities()?.elicitation);
    if (canAsk) {
      const answer = await server.server.elicitInput({
        mode: "form",
        message: `${what} This cannot be undone.`,
        requestedSchema: {
          type: "object",
          properties: { confirm: { type: "boolean", title: "Yes, do it", default: false } },
          required: ["confirm"],
        },
      });
      if (answer.action === "accept" && answer.content?.confirm === true) return null;
      return {
        outcome: "cancelled",
        result: structured(cancelled, "Cancelled by the user. Nothing was changed."),
      };
    }
    return {
      outcome: "pending",
      result: failure(
        "confirmation_required",
        `${what} This is irreversible. Ask the user to confirm, then call ${toolName} again with confirm=true.`,
      ),
    };
  }

  const pageSummary = (label: string, p: { total: number; page: number; items: unknown[]; per_page: number }) =>
    `${p.total} ${label} total; page ${p.page} (${p.items.length} of ${p.per_page} per page).`;

  // ------------------------------------------------------------------------- //
  // Projects
  // ------------------------------------------------------------------------- //
  tool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List the account's projects, newest first, each with its open-issue count, events in the last 24 h, events and affected users in the last 30 days and the time of the last event. Start here to find a project id for the other tools; pass q to narrow by name, key or URL (filtered client-side).",
      inputSchema: {
        q: z.string().max(100).optional().describe("Case-insensitive substring of the project name, key or URL."),
      },
      outputSchema: z.looseObject({ items: z.array(projectObject), total: z.number() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ q }) => {
      const { items: all } = await client.listProjects();
      const needle = q?.trim().toLowerCase();
      const items = needle
        ? all.filter((p) => [p.name, p.key, p.url ?? ""].some((s) => s.toLowerCase().includes(needle)))
        : all;
      return structured({ items, total: items.length }, `${items.length} project(s).\n${items.map(describeProject).join("\n") || "(none)"}`);
    },
  );

  tool(
    "get_project",
    {
      title: "Get project",
      description:
        "Fetch one project by id: its public key (for the SDK tag and the ingest API), time zone, allowed origins, ingest / store_ip switches and counts (open issues, events 24h / 30d, users 30d, last event).",
      inputSchema: { project_id: projectId },
      outputSchema: projectObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id }) => {
      const p = await client.getProject(project_id);
      return structured(
        { ...p },
        `${describeProject(p)}\nPublic key: ${p.public_key}\nAllowed origins: ${p.allowed_origins.join(", ") || "any"} · ingest enabled: ${p.ingest_enabled} · raw IPs stored: ${p.store_ip ?? false}`,
      );
    },
  );

  tool(
    "create_project",
    {
      title: "Create project",
      description:
        "Create a project (one per app, site or service). Returns the project's public key (oops_pub_...) to put in the SDK tag or the X-Project-Key header of ingest calls. Errors: limit_reached (which=projects) when the plan's project quota is used up, key_taken when the key already exists in this account.",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Human-friendly project name, e.g. the app's name."),
        key: z
          .string()
          .regex(PROJECT_KEY_RE)
          .optional()
          .describe("Slug, unique per account (^[a-z0-9][a-z0-9-]{0,62}$). Defaults to a slug of the name."),
        description: z.string().max(1000).optional(),
        url: z.url().max(2048).optional().describe("The app's public URL."),
        timezone: z.string().max(64).optional().describe("IANA time zone used to bucket days (default UTC)."),
        allowed_origins: z
          .array(z.string().max(253))
          .max(20)
          .optional()
          .describe("Hostnames allowed to report events from the browser (example.com, *.example.com). Empty = any."),
      },
      outputSchema: projectObject,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const p = await client.createProject(args);
      return structured(
        { ...p },
        `Created project ${describeProject(p)}.\nPublic key: ${p.public_key}\nSDK tag: <script defer src="https://oops.3m4.net/o.js" data-key="${p.public_key}"></script>\nIngest: POST /api/ingest with header X-Project-Key: ${p.public_key}`,
      );
    },
  );

  tool(
    "update_project",
    {
      title: "Update project",
      description:
        "Change a project's name, description, URL, time zone, allowed origins or switches (ingest_enabled=false pauses intake without touching the snippet, store_ip keeps raw client IPs on events). Only the fields you pass are changed; the key cannot change. Errors: invalid_timezone, invalid_origins.",
      inputSchema: {
        project_id: projectId,
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        url: z.url().max(2048).optional(),
        timezone: z.string().max(64).optional(),
        allowed_origins: z.array(z.string().max(253)).max(20).optional(),
        ingest_enabled: z.boolean().optional().describe("false pauses ingest: events are acknowledged (202) but dropped with reason=paused."),
        store_ip: z.boolean().optional().describe("true keeps the raw client IP on each event (default false: only a daily hash)."),
      },
      outputSchema: projectObject,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ project_id, ...patch }) => {
      const p = await client.updateProject(project_id, patch);
      return structured({ ...p }, `Updated project ${describeProject(p)}.`);
    },
  );

  tool(
    "rotate_public_key",
    {
      title: "Rotate project public key",
      description:
        "Issue a new public key (oops_pub_...) for a project. The OLD KEY STOPS WORKING IMMEDIATELY: every SDK tag and server-side reporter must be updated, so only do this when the user asks to rotate the key (e.g. abuse), and show them the new key.",
      inputSchema: { project_id: projectId },
      outputSchema: projectObject,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ project_id }) => {
      const p = await client.rotatePublicKey(project_id);
      return structured({ ...p }, `Rotated. New public key for "${p.name}": ${p.public_key}. The previous key is now invalid; update the SDK tag and any X-Project-Key header.`);
    },
  );

  tool(
    "delete_project",
    {
      title: "Delete project",
      description:
        "Permanently delete a project with ALL its issues and events. IRREVERSIBLE: its public key stops working. The user must confirm: when the client supports it you will be prompted; otherwise ask the user explicitly and call again with confirm=true. Prefer update_project with ingest_enabled=false to pause instead.",
      inputSchema: { project_id: projectId, confirm: confirmFlag },
      outputSchema: z.looseObject({ deleted: z.boolean(), id: z.string(), key: z.string(), name: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ project_id, confirm }) => {
      const p = await client.getProject(project_id);
      const n = p.counts ? `${p.counts.open_issues} open issue(s) and ${p.counts.events_30d} event(s) in the last 30 days` : "all its issues and events";
      const refusal = await confirmOrRefuse(
        confirm,
        `Delete project "${p.name}" (${p.key}) with ${n} and all its history?`,
        "delete_project",
        { deleted: false, id: p.id, key: p.key, name: p.name },
      );
      if (refusal) return refusal;
      await client.deleteProject(project_id);
      return structured({ deleted: true, id: p.id, key: p.key, name: p.name }, `Deleted project "${p.name}" (${p.key}).`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Issues and events
  // ------------------------------------------------------------------------- //
  tool(
    "list_issues",
    {
      title: "List issues",
      description:
        "Paged list of a project's issues (grouped errors), each with #number, status, level, title, culprit, event and affected-user counts, first / last seen, environments, releases and whether it regressed. Default: open issues seen in the last 30 days, most recent first. Filter by status (open | resolved | ignored | all), level, environment, release, q (substring of title / culprit / type) and period (by last_seen); sort by last_seen, first_seen, events or users. Use sort=users to find what hurts most people.",
      inputSchema: {
        project_id: projectId,
        status: z.enum(STATUS_FILTERS).optional().describe("open (default) | resolved | ignored | all"),
        ...eventFilters,
        q: z.string().max(200).optional().describe("Case-insensitive substring of the issue title, culprit or type."),
        period: z.enum(ISSUE_PERIODS).optional().describe("Issues whose last_seen falls in: 24h | 7d | 30d (default) | 90d | all"),
        sort: z.enum(ISSUE_SORTS).optional().describe("last_seen (default) | first_seen | events | users"),
        page: pageInput,
        per_page: perPageInput,
      },
      outputSchema: pageOf(issueObject),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, ...params }) => {
      const page = await client.listIssues(project_id, params);
      return structured({ ...page }, `${pageSummary("issue(s)", page)}\n${page.items.map(describeIssue).join("\n") || "(none)"}`);
    },
  );

  tool(
    "get_issue",
    {
      title: "Get issue",
      description:
        "One issue in full, by uuid or #number, including its latest event (message, stack frames top-first, URL, release, environment, browser / OS, tags, extra, breadcrumbs, user). The first call to make when the user names an issue (\"#12\", \"issue 12\").",
      inputSchema: { project_id: projectId, issue: issueRef },
      outputSchema: issueObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, issue }) => {
      const ref = parseIssueRef(issue);
      const i = await client.getIssue(project_id, ref);
      const latest = i.latest_event ? `\nLatest event:\n${describeEvent(i.latest_event, true)}` : "";
      return structured({ ...i }, `${describeIssue(i)}${latest}`);
    },
  );

  tool(
    "list_issue_events",
    {
      title: "List issue events",
      description:
        "The occurrences of one issue (uuid or #number), newest first, paged: time, level, message, URL, release, environment, browser / OS / device, user and top frame. Use it to see when an error started, which releases and users it hit, or to pick an event id for get_event.",
      inputSchema: { project_id: projectId, issue: issueRef, page: pageInput, per_page: perPageInput },
      outputSchema: pageOf(eventObject),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, issue, page, per_page }) => {
      const ref = parseIssueRef(issue);
      const result = await client.listIssueEvents(project_id, ref, { page, per_page });
      return structured(
        { ...result },
        `Issue ${formatIssueRef(ref)}: ${pageSummary("event(s)", result)}\n${result.items.map((e) => describeEvent(e)).join("\n") || "(none)"}`,
      );
    },
  );

  tool(
    "get_event",
    {
      title: "Get event",
      description:
        "One error event in full by id: type, message, stack frames (top first, in-app frames marked), raw stack when frames could not be parsed, URL / path, release, environment, platform, sdk, browser / OS / device, user, tags, extra, breadcrumbs (what happened before the error) and source (sdk | api).",
      inputSchema: {
        project_id: projectId,
        event_id: z.string().min(1).max(32).describe("The event id (a numeric string), from list_issue_events, search_events or get_issue.latest_event_id."),
      },
      outputSchema: eventObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, event_id }) => {
      const e = await client.getEvent(project_id, event_id);
      return structured({ ...e }, describeEvent(e, true));
    },
  );

  tool(
    "search_events",
    {
      title: "Search events",
      description:
        "Raw error events across a project, newest first, paged. Filter by level, environment, release, q (substring of the message), issue (uuid or #number) and period. Use it to find a specific message, to see everything a release produced, or to inspect what else happened around an error.",
      inputSchema: {
        project_id: projectId,
        ...eventFilters,
        q: z.string().max(200).optional().describe("Case-insensitive substring of the event message."),
        issue: issueRef.optional().describe('Restrict to one issue: uuid, number or "#12".'),
        period: z.enum(ISSUE_PERIODS).optional().describe("24h | 7d | 30d (default) | 90d | all"),
        page: pageInput,
        per_page: perPageInput,
      },
      outputSchema: pageOf(eventObject),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, issue, ...params }) => {
      const result = await client.listEvents(project_id, { ...params, issue: issue === undefined ? undefined : parseIssueRef(issue) });
      return structured({ ...result }, `${pageSummary("event(s)", result)}\n${result.items.map((e) => describeEvent(e)).join("\n") || "(none)"}`);
    },
  );

  tool(
    "update_issue",
    {
      title: "Update issue status",
      description:
        "Set an issue's status: resolved (fixed; it reopens by itself and is flagged as regressed if the error comes back), ignored (known noise; stays ignored but keeps counting) or open (reopen). Accepts the uuid or #number. Audited as issue.update.",
      inputSchema: { project_id: projectId, issue: issueRef, status: statusEnum },
      outputSchema: issueObject,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ project_id, issue, status }) => {
      const ref = parseIssueRef(issue);
      const i = await client.updateIssue(project_id, ref, status);
      const verb = status === "resolved" ? "Resolved" : status === "ignored" ? "Ignored" : "Reopened";
      return structured({ ...i }, `${verb} issue ${describeIssue(i)}`);
    },
  );

  tool(
    "bulk_update_issues",
    {
      title: "Bulk update issues",
      description:
        "Set the same status on up to 100 issues at once (uuids or #numbers), e.g. resolve everything from an old release or ignore a batch of noisy warnings. Returns how many were updated. Audited as issues.bulk_update.",
      inputSchema: {
        project_id: projectId,
        issues: z.array(issueRef).min(1).max(100).describe("Issue uuids and/or numbers."),
        status: statusEnum,
      },
      outputSchema: z.looseObject({ updated: z.number(), requested: z.number(), status: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ project_id, issues, status }) => {
      const ids = issues.map(parseIssueRef);
      const r = await client.bulkUpdateIssues(project_id, ids, status);
      return structured({ ...r, requested: ids.length, status }, `${r.updated} of ${ids.length} issue(s) set to ${status}.`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Stats
  // ------------------------------------------------------------------------- //
  tool(
    "get_stats",
    {
      title: "Get stats",
      description:
        "A project's error numbers over a range in one call: totals (events, affected users, new issues, open issues), the previous period for deltas, a time series (hour / day / month buckets in the project's time zone) and the top-10 breakdowns by level, environment, release, browser, os, device and error type. Pass period (today | yesterday | 24h | 7d | 30d | 90d | 12mo) or from/to dates, and optional level / environment / release filters. Use it for \"how is the app doing?\", spike detection and release comparisons.",
      inputSchema: {
        project_id: projectId,
        period: z.enum(STATS_PERIODS).optional().describe("Preset range in the project's time zone (default 7d). Ignored when from/to are given."),
        from: z.string().regex(DATE_RE).optional().describe("Start date YYYY-MM-DD (inclusive, project time zone)."),
        to: z.string().regex(DATE_RE).optional().describe("End date YYYY-MM-DD (inclusive, project time zone)."),
        interval: z.enum(INTERVALS).optional().describe("Bucket size for the series (auto by range when omitted)."),
        ...eventFilters,
      },
      outputSchema: statsObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, ...params }) => {
      const s = await client.stats(project_id, params);
      return structured({ ...s }, describeStats(s));
    },
  );

  tool(
    "get_live",
    {
      title: "Live error count",
      description: "How many error events the project received in the last few minutes (the server's live window). Cheap; use it to check whether an incident is still ongoing or a deploy just started failing.",
      inputSchema: { project_id: projectId },
      outputSchema: liveObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id }) => {
      const l = await client.live(project_id);
      return structured({ ...l }, `${l.events} event(s) in the last ${l.window_min} minute(s).`);
    },
  );

  tool(
    "purge_events",
    {
      title: "Purge events",
      description:
        "Delete ALL stored events and issues of a project. The project and its public key survive and keep receiving new events. IRREVERSIBLE. The user must confirm: when the client supports it you will be prompted; otherwise ask the user explicitly and call again with confirm=true.",
      inputSchema: { project_id: projectId, confirm: confirmFlag },
      outputSchema: z.looseObject({ deleted_events: z.number(), deleted_issues: z.number(), project_id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ project_id, confirm }) => {
      const p = await client.getProject(project_id);
      const refusal = await confirmOrRefuse(
        confirm,
        `Purge ALL events and issues of project "${p.name}" (${p.key})?`,
        "purge_events",
        { deleted_events: 0, deleted_issues: 0, project_id: p.id },
      );
      if (refusal) return refusal;
      const r = await client.purgeEvents(project_id);
      return structured({ ...r, project_id: p.id }, `Deleted ${r.deleted_events} event(s) and ${r.deleted_issues} issue(s) of "${p.name}".`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Account
  // ------------------------------------------------------------------------- //
  tool(
    "get_usage",
    {
      title: "Usage and limits",
      description:
        "This month's received error events (including the ones dropped past the budget), and project / API key counts against the plan's limits (-1 = unlimited), plus retention. Call this when a tool returns limit_reached, when report_error comes back with reason=limit, or when the dashboard reports dropped events.",
      inputSchema: {},
      outputSchema: usageObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async () => {
      const u = await client.usage();
      const lim = u.limits;
      const fmt = (n: unknown) => (n === -1 ? "unlimited" : String(n ?? "?"));
      return structured(
        { ...u },
        `Period ${u.period_start} → ${u.period_end}: ${u.events}/${fmt(lim.events_per_month)} events (${u.events_dropped} dropped over budget), ${u.counts.projects}/${fmt(lim.projects)} projects, ${u.counts.api_keys}/${fmt(lim.api_keys)} API keys, retention ${fmt(lim.retention_days)} days.`,
      );
    },
  );

  tool(
    "get_audit_log",
    {
      title: "Audit log",
      description:
        "The account's audit trail, newest first, paged: who did what, when, and whether it was allowed. Actions: project.create|update|delete|rotate_key, issue.update, issues.bulk_update, events.purge, apikey.create|revoke, auth.denied. Filter by action, actor_type (user | api_key), outcome (ok | denied) and since (ISO timestamp).",
      inputSchema: {
        action: z.string().max(60).optional().describe("Exact action, e.g. issue.update, events.purge, auth.denied."),
        actor_type: z.string().max(30).optional().describe("user | api_key"),
        outcome: z.string().max(30).optional().describe("ok | denied"),
        since: z.string().max(40).optional().describe("Only entries at or after this ISO 8601 timestamp."),
        page: pageInput,
        per_page: perPageInput,
      },
      outputSchema: pageOf(auditEventObject),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const result = await client.auditLog(args);
      const lines = result.items.map(
        (e) =>
          `${e.ts} ${e.outcome.padEnd(6)} ${e.action} by ${e.actor_type}${e.actor_label ? `:${e.actor_label}` : ""}${e.target_id ? ` → ${e.target_type}:${e.target_id}` : ""}`,
      );
      return structured({ ...result }, `${pageSummary("audit event(s)", result)}\n${lines.join("\n") || "(none)"}`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Reporting (the agent as an error source)
  // ------------------------------------------------------------------------- //
  tool(
    "report_error",
    {
      title: "Report an error",
      description:
        "Report an error (or a message) into a project you can see, so your own failures show up as issues: it fetches the project's public key and posts one event to the ingest API. Give at least type or message; add stack (raw string, parsed server-side) or frames, url, release, environment (default production), platform (default agent), user, tags, extra, breadcrumbs or an explicit fingerprint to control grouping. Returns the event id and the issue #number it landed in, or ok=false with a drop reason (paused | origin | limit) that is not an error on your side.",
      inputSchema: {
        project_id: projectId,
        type: z.string().max(200).optional().describe("Exception class / error name, e.g. TimeoutError. Required unless message is set."),
        message: z.string().max(4096).optional().describe("Error message. Required unless type is set."),
        level: levelEnum.default("error"),
        stack: z.string().max(16_000).optional().describe("Raw stack string (V8, Firefox/Safari or Python traceback format); parsed server-side when frames is absent."),
        frames: z
          .array(
            z.object({
              filename: z.string().max(1024).optional(),
              function: z.string().max(255).optional(),
              lineno: z.number().int().optional(),
              colno: z.number().int().optional(),
              in_app: z.boolean().default(true),
            }),
          )
          .max(50)
          .optional()
          .describe("Parsed frames, top of the stack first (the frame that threw is frames[0])."),
        url: z.string().max(2048).optional().describe("Where it happened (URL or resource); query string and fragment are dropped on storage."),
        release: z.string().max(100).optional(),
        environment: z.string().max(40).optional().describe("Default production."),
        platform: z.string().max(30).default("agent").describe("The runtime reporting the error: agent (default), python, node, ..."),
        user: z.object({ id: z.string().max(120).optional(), email: z.string().max(255).optional(), name: z.string().max(120).optional() }).optional(),
        tags: z.record(z.string().max(40), z.string().max(200)).optional().describe("Up to 20 short key/value labels, e.g. {\"task\": \"nightly-sync\"}."),
        extra: z.record(z.string(), z.unknown()).optional().describe("Any JSON context (≤ 8 KB). Secret-looking keys are scrubbed server-side."),
        breadcrumbs: z
          .array(z.object({ ts: z.string().optional(), category: z.string().max(40), message: z.string().max(500).optional(), level: z.string().max(10).optional(), data: z.record(z.string(), z.unknown()).optional() }))
          .max(30)
          .optional()
          .describe("What happened before the error, oldest first (last 30 kept)."),
        fingerprint: z.array(z.string().max(100)).max(5).optional().describe("Explicit grouping key; events with the same fingerprint share one issue."),
        ts: z.string().max(40).optional().describe("ISO 8601 time of the error (server time when omitted or skewed > 5 min)."),
      },
      outputSchema: ingestResultObject,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ project_id, ...event }) => {
      if (!event.type && !event.message) return failure("invalid_event", "Give at least one of type or message.");
      const p = await client.getProject(project_id);
      const r = await client.ingest(p.public_key, { ...event, sdk: `oops-errors-mcp/${VERSION}` });
      if (r.ok) {
        return structured(
          { ...r, project_id: p.id },
          `Reported to "${p.name}": issue #${r.issue_number} (id ${r.issue_id}), event ${r.event_id}. Use get_issue with issue=${r.issue_number} to see it.`,
        );
      }
      const why: Record<string, string> = {
        paused: "the project's ingest is paused (update_project ingest_enabled=true to resume)",
        origin: "the project restricts allowed_origins and this origin is not in the list",
        limit: "the account is over its monthly event budget (see get_usage)",
      };
      return structured({ ...r, project_id: p.id }, `Not stored: ${why[r.reason] ?? r.reason}. The event was acknowledged (202) but dropped.`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Resources (read-only context the host can attach without a tool call)
  // ------------------------------------------------------------------------- //
  if (scopes.has("projects:read")) {
    server.registerResource(
      "projects",
      "oops://projects",
      {
        title: "Projects",
        description: "Every project of the account with its open-issue count, recent event counts and last event.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await client.listProjects(), null, 2) }],
      }),
    );

    server.registerResource(
      "project-summary",
      new ResourceTemplate("oops://projects/{id}/summary", { list: undefined }),
      {
        title: "Project summary",
        description: "Open issues, events in the last 24 h and 30 days, affected users in 30 days and the last event time of one project (by project id).",
        mimeType: "application/json",
      },
      async (uri, { id }) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await client.summary(String(id)), null, 2),
          },
        ],
      }),
    );
  }

  // ------------------------------------------------------------------------- //
  // Prompts (reusable workflows the user can pick from the host UI)
  // ------------------------------------------------------------------------- //
  if (scopes.has("issues:read")) {
    server.registerPrompt(
      "triage",
      {
        title: "Triage a project's errors",
        description:
          "Summarise the open issues of a project over a period (new vs regressed, most users affected, by environment and release) and propose what to fix, resolve or ignore first.",
        argsSchema: {
          project: z.string().describe("Project id (UUID), key or name."),
          period: z.string().optional().describe("24h | 7d (default) | 30d | 90d | all"),
        },
      },
      ({ project, period }) => {
        const p = period?.trim() || "7d";
        const statsPeriod = p === "all" ? "90d" : p;
        return {
          messages: [
            {
              role: "user",
              content: {
                type: "text",
                text: `Triage the errors of project "${project}" over the last ${p}.

1. If "${project}" is not a UUID, call list_projects and pick the project whose key or name matches; use its id below.
2. Call list_issues with status="open", period="${p}", sort="users", per_page=50, and again with sort="first_seen" if the first page is full, so you see both the most harmful and the newest issues.
3. Call get_stats with period="${statsPeriod}" for the totals vs the previous period and the breakdowns by environment and release.
4. For the top 3 issues by user_count call get_issue (issue=#number) to read the latest event's stack and breadcrumbs.

Then write a triage report:
- Headline: events, affected users and new issues over the period vs the previous period, in one sentence.
- NEW issues (first_seen inside the period) vs REGRESSED issues (regressed_at set) vs long-running ones, as short lists with #number, title, users and events.
- Which environments and releases are hurting most (from the breakdowns and each issue's environments / releases).
- Recommended order of work: what to FIX first (most users, regressions, fatal level), what looks already fixed and can be RESOLVED (last_seen old, release no longer deployed), and what is noise that can be IGNORED (info / warning level, third-party scripts, extensions), each with the #numbers.
Keep it under 300 words, plain language. Do not change any issue status yourself unless the user asks: propose, then act with update_issue or bulk_update_issues only after they confirm.`,
              },
            },
          ],
        };
      },
    );
  }

  return server;
}
