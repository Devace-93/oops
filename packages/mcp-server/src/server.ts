/**
 * The oops MCP server: tools, resources and prompts over the oops
 * management API.
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
import { TOOL_SCOPES, hasAllScopes, type ToolName } from "./rbac.js";
import type { BreakdownRow, KeyInfo, Project, Scope, Stats, Summary, Totals } from "./types.js";
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
// Shared schema fragments
// --------------------------------------------------------------------------- //
const DIMENSIONS = [
  "path", "hostname", "referrer", "country", "region", "city", "device", "browser", "os", "lang",
  "utm_source", "utm_medium", "utm_campaign", "name", "ip",
] as const;
const PERIODS = ["today", "yesterday", "7d", "30d", "90d", "12mo"] as const;
const INTERVALS = ["hour", "day", "month"] as const;
const PROJECT_KEY_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const projectId = z.uuid().describe("The project's id (UUID), as returned by list_projects or create_project.");
const dimensionEnum = z.enum(DIMENSIONS).describe("path | hostname | referrer | country | region | city | device | browser | os | lang | utm_source | utm_medium | utm_campaign | name | ip (ip only has values when the project stores addresses).");
const confirmFlag = z
  .boolean()
  .default(false)
  .describe("Set to true only after the user explicitly confirmed this specific destructive action.");

const rangeInput = {
  period: z.enum(PERIODS).optional().describe("Preset range in the project's time zone (default 30d). Ignored when from/to are given."),
  from: z.string().regex(DATE_RE).optional().describe("Start date YYYY-MM-DD (inclusive, local to tz)."),
  to: z.string().regex(DATE_RE).optional().describe("End date YYYY-MM-DD (inclusive, local to tz)."),
  tz: z.string().max(64).optional().describe("IANA time zone for day buckets; defaults to the project's."),
  filters: z
    .partialRecord(z.enum(DIMENSIONS), z.string().max(2048))
    .optional()
    .describe('Scope everything to these dimension values, e.g. {"country": "ES", "device": "mobile"}. Use "(direct)" for referrer-less hits.'),
};

// Output schemas. `looseObject` = additionalProperties allowed (see header).
const totalsObject = z.looseObject({ pageviews: z.number(), visitors: z.number(), events: z.number() });
const countsObject = z.looseObject({
  pageviews_30d: z.number(),
  visitors_30d: z.number(),
  pageviews_today: z.number(),
  last_event_at: z.string().nullable(),
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
  collect_enabled: z.boolean(),
  exclude_bots: z.boolean(),
  store_ip: z.boolean().optional(),
  counts: countsObject.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
const rangeObject = z.looseObject({ from: z.string(), to: z.string(), tz: z.string(), interval: z.string(), days: z.number() });
const rowObject = z.looseObject({ value: z.string(), pageviews: z.number(), visitors: z.number(), events: z.number() });
const pointObject = z.looseObject({ bucket: z.string(), pageviews: z.number(), visitors: z.number(), events: z.number() });
const liveObject = z.looseObject({
  window_minutes: z.number(),
  visitors: z.number(),
  pageviews: z.number(),
  pages: z.array(z.looseObject({ path: z.string(), visitors: z.number(), pageviews: z.number() })),
});
const statsObject = z.looseObject({
  project_id: z.string(),
  range: rangeObject,
  filters: z.record(z.string(), z.string()),
  totals: totalsObject,
  previous: totalsObject,
  series: z.array(pointObject),
  breakdowns: z.record(z.string(), z.array(rowObject)),
  live: liveObject,
});
const breakdownObject = z.looseObject({
  project_id: z.string(),
  range: rangeObject,
  by: z.string(),
  items: z.array(rowObject),
  page: z.number(),
  per_page: z.number(),
  total: z.number(),
});
const eventObject = z.looseObject({
  id: z.number(),
  ts: z.string(),
  kind: z.string(),
  name: z.string().nullable(),
  path: z.string(),
  title: z.string().nullable(),
  referrer_host: z.string().nullable(),
  country: z.string().nullable(),
  city: z.string().nullable(),
  device: z.string().nullable(),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  visitor: z.string(),
  ip: z.string().nullable().optional(),
  source: z.string(),
  props: z.record(z.string(), z.unknown()),
});
const summaryObject = z.looseObject({
  project_id: z.string(),
  timezone: z.string(),
  today: totalsObject,
  yesterday: totalsObject,
  last_7_days: totalsObject,
  last_30_days: totalsObject,
  live_visitors: z.number(),
  last_event_at: z.string().nullable(),
  all_time_pageviews: z.number(),
});
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
  actor_id: z.string().nullable(),
  actor_label: z.string().nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: z.string(),
  meta: z.record(z.string(), z.unknown()),
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

function truncate(s: string, n: number): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? one.slice(0, n - 1) + "…" : one;
}

function pct(cur: number, prev: number): string {
  if (!prev) return cur ? "new" : "±0%";
  const d = Math.round(((cur - prev) / prev) * 1000) / 10;
  return `${d > 0 ? "+" : ""}${d}%`;
}

function describeTotals(t: Totals, prev?: Totals): string {
  const base = `${t.pageviews} page views, ${t.visitors} visitors, ${t.events} custom events`;
  if (!prev) return base;
  return `${base} (vs previous period: ${pct(t.pageviews, prev.pageviews)} views, ${pct(t.visitors, prev.visitors)} visitors)`;
}

function describeProject(p: Project): string {
  const c = p.counts
    ? `, 30d: ${p.counts.pageviews_30d} views / ${p.counts.visitors_30d} visitors, today: ${p.counts.pageviews_today} views`
    : "";
  const state = p.collect_enabled ? "" : ", tracking PAUSED";
  return `${p.name} (key=${p.key}, id=${p.id}, tz=${p.timezone}${c}${state})`;
}

function describeRows(rows: BreakdownRow[], metric: keyof Totals = "visitors", n = 8): string {
  return rows
    .slice(0, n)
    .map((r) => `${truncate(r.value, 60)} ${r[metric]}`)
    .join(", ") || "none";
}

function describeStats(s: Stats): string {
  const b = s.breakdowns;
  const lines = [
    `${s.range.from} → ${s.range.to} (${s.range.tz}, ${s.range.interval} buckets${Object.keys(s.filters).length ? `, filters ${JSON.stringify(s.filters)}` : ""})`,
    `Totals: ${describeTotals(s.totals, s.previous)}.`,
    `Live now: ${s.live.visitors} visitor(s).`,
    `Top pages (views): ${describeRows(b.path ?? [], "pageviews")}.`,
    `Referrers (visitors): ${describeRows(b.referrer ?? [])}.`,
    `Countries: ${describeRows(b.country ?? [])}.`,
    `Devices: ${describeRows(b.device ?? [])}. Browsers: ${describeRows(b.browser ?? [], "visitors", 5)}. OS: ${describeRows(b.os ?? [], "visitors", 5)}.`,
    `Custom events: ${describeRows(b.name ?? [], "events")}.`,
  ];
  return lines.join("\n");
}

function describeSummary(s: Summary): string {
  const t = (x: Totals) => `${x.pageviews} views / ${x.visitors} visitors`;
  return `Today ${t(s.today)} · yesterday ${t(s.yesterday)} · last 7 days ${t(s.last_7_days)} · last 30 days ${t(s.last_30_days)} · live ${s.live_visitors} · all-time ${s.all_time_pageviews} views · last hit ${s.last_event_at ?? "never"} (tz ${s.timezone}).`;
}

export function buildInstructions(info: KeyInfo): string {
  return [
    `oops is a privacy-friendly web-analytics service. You are acting for account "${info.account.name}" (plan: ${info.account.plan}).`,
    `This API key has role "${info.key.role}" with scopes: ${info.scopes.join(", ")}. Only tools allowed by those scopes are listed; if a user asks for something outside them, say the key lacks that permission instead of guessing.`,
    "Model: an account has projects (one per tracked site or app); a project receives hits (page views and custom events) through a public key (oops_pub_...) that ships in a script tag, a pixel or an API call. You read aggregated numbers with get_stats (totals, previous period, time series, top-8 breakdowns, live visitors), drill into one dimension with get_breakdown, inspect raw rows with list_events and check the last five minutes with get_live.",
    "Ranges are local dates in the project's time zone: period=today|yesterday|7d|30d|90d|12mo or from/to. Any dimension (country, device, path, referrer, browser, os, lang, utm_*, name) can be passed as a filter. Visitors are counted with a daily cookie-less hash, so multi-day visitor totals are daily uniques summed.",
    "Start with list_projects to find a project id, then project_summary for a quick picture or get_stats for a full one. Deleting a project or purging its events is irreversible: those tools require explicit user confirmation.",
  ].join("\n");
}

export function createOopsServer(opts: OopsServerOptions): McpServer {
  const { client, keyInfo, audit } = opts;
  const transport = opts.transport ?? "unknown";
  const allowElicitation = opts.allowElicitation ?? true;
  const scopes = new Set<Scope>(keyInfo.scopes);
  const actor = { account: keyInfo.account.id, prefix: keyInfo.key.prefix, role: keyInfo.key.role };

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
          return failure("insufficient_scope", `This key (role ${keyInfo.key.role}) lacks ${requiredLabel}.`, {
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

  // ------------------------------------------------------------------------- //
  // Projects
  // ------------------------------------------------------------------------- //
  tool(
    "list_projects",
    {
      title: "List projects",
      description:
        "List the account's projects, newest first, each with its 30-day page views and visitors, today's page views and the time of the last hit. Use q to search by name, key or URL. Start here to find a project id for the other tools.",
      inputSchema: {
        q: z.string().optional().describe("Case-insensitive search in project name, key and URL."),
      },
      outputSchema: z.looseObject({ items: z.array(projectObject), total: z.number() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const page = await client.listProjects(args);
      const lines = page.items.map(describeProject);
      return structured({ ...page }, `${page.total} project(s).\n${lines.join("\n")}`);
    },
  );

  tool(
    "get_project",
    {
      title: "Get project",
      description:
        "Fetch one project by id: public key (for the script tag / pixel / collect API), time zone, allowed hostnames, tracking switches and counts.",
      inputSchema: { project_id: projectId },
      outputSchema: projectObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id }) => {
      const p = await client.getProject(project_id);
      return structured(
        { ...p },
        `${describeProject(p)}\nPublic key: ${p.public_key}\nAllowed hostnames: ${p.allowed_origins.join(", ") || "any"} · bots excluded: ${p.exclude_bots} · raw IPs stored: ${p.store_ip ?? false}`,
      );
    },
  );

  tool(
    "create_project",
    {
      title: "Create project",
      description:
        "Create a project (one per tracked site or app). Returns the project's public key (oops_pub_...) to put in the script tag, pixel or collect calls. Errors: limit_reached (which=projects) when the plan's project quota is used up, key_taken when the key already exists in this account.",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Human-friendly project name, e.g. the site's name."),
        key: z
          .string()
          .regex(PROJECT_KEY_RE)
          .optional()
          .describe("Slug, unique per account (^[a-z0-9][a-z0-9-]{0,62}$). Defaults to a slug of the name."),
        description: z.string().max(1000).optional(),
        url: z.string().url().max(2048).optional().describe("The site's public URL."),
        timezone: z.string().max(64).optional().describe("IANA time zone used to bucket days (default UTC)."),
        allowed_origins: z.array(z.string().max(253)).max(20).optional().describe("Hostnames allowed to send hits (example.com, *.example.com). Empty = any."),
        store_ip: z.boolean().optional().describe("Keep the raw visitor IP on each hit (default false: only a daily hash + derived location)."),
      },
      outputSchema: projectObject,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => {
      const p = await client.createProject(args);
      return structured(
        { ...p },
        `Created project ${describeProject(p)}.\nPublic key: ${p.public_key}\nSnippet: <script defer src="https://metrics.3m4.net/m.js" data-key="${p.public_key}"></script>`,
      );
    },
  );

  tool(
    "update_project",
    {
      title: "Update project",
      description:
        "Change a project's name, description, URL, time zone, allowed hostnames or tracking switches (collect_enabled pauses tracking, exclude_bots drops crawlers, store_ip keeps raw addresses). Only the fields you pass are changed; the key cannot change. Errors: invalid_timezone, invalid_origins.",
      inputSchema: {
        project_id: projectId,
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(1000).optional(),
        url: z.string().url().max(2048).optional(),
        timezone: z.string().max(64).optional(),
        allowed_origins: z.array(z.string().max(253)).max(20).optional(),
        collect_enabled: z.boolean().optional().describe("false pauses tracking without touching the snippet."),
        exclude_bots: z.boolean().optional(),
        store_ip: z.boolean().optional().describe("true keeps the raw visitor IP on each hit; it then appears in list_events and as the ip dimension."),
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
    "rotate_project_key",
    {
      title: "Rotate project public key",
      description:
        "Issue a new public key (oops_pub_...) for a project. The OLD KEY STOPS WORKING IMMEDIATELY: every snippet and pixel must be updated, so only do this when the user asks to rotate the key (e.g. abuse), and show them the new key.",
      inputSchema: { project_id: projectId },
      outputSchema: z.looseObject({ public_key: z.string(), public_key_prefix: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    },
    async ({ project_id }) => {
      const k = await client.rotateProjectKey(project_id);
      return structured({ ...k }, `Rotated. New public key: ${k.public_key}. The previous key is now invalid; update the snippet.`);
    },
  );

  tool(
    "delete_project",
    {
      title: "Delete project",
      description:
        "Permanently delete a project with ALL its events. IRREVERSIBLE: its snippet stops working. The user must confirm: when the client supports it you will be prompted; otherwise ask the user explicitly and call again with confirm=true.",
      inputSchema: { project_id: projectId, confirm: confirmFlag },
      outputSchema: z.looseObject({ deleted: z.boolean(), id: z.string(), key: z.string(), name: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ project_id, confirm }) => {
      const p = await client.getProject(project_id);
      const n = p.counts?.pageviews_30d ?? "its";
      const refusal = await confirmOrRefuse(
        confirm,
        `Delete project "${p.name}" (${p.key}) with ${n} page view(s) in the last 30 days and all its history?`,
        "delete_project",
        { deleted: false, id: p.id, key: p.key, name: p.name },
      );
      if (refusal) return refusal;
      await client.deleteProject(project_id);
      return structured({ deleted: true, id: p.id, key: p.key, name: p.name }, `Deleted project "${p.name}" (${p.key}).`);
    },
  );

  tool(
    "purge_events",
    {
      title: "Purge events",
      description:
        "Delete a project's stored events, all of them or only those before a date (before=YYYY-MM-DD). The project and its key survive. IRREVERSIBLE. The user must confirm: when the client supports it you will be prompted; otherwise ask the user explicitly and call again with confirm=true.",
      inputSchema: { project_id: projectId, before: z.string().regex(DATE_RE).optional(), confirm: confirmFlag },
      outputSchema: z.looseObject({ deleted: z.number(), before: z.string().nullable(), project_id: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ project_id, before, confirm }) => {
      const p = await client.getProject(project_id);
      const refusal = await confirmOrRefuse(
        confirm,
        `Purge ${before ? `events before ${before}` : "ALL events"} of project "${p.name}" (${p.key})?`,
        "purge_events",
        { deleted: 0, before: before ?? null, project_id: p.id },
      );
      if (refusal) return refusal;
      const r = await client.purgeEvents(project_id, before);
      return structured({ ...r, project_id: p.id }, `Deleted ${r.deleted} event(s) of "${p.name}"${before ? ` before ${before}` : ""}.`);
    },
  );

  // ------------------------------------------------------------------------- //
  // Stats
  // ------------------------------------------------------------------------- //
  tool(
    "project_summary",
    {
      title: "Project summary",
      description:
        "Headline numbers for one project: page views and visitors today, yesterday, last 7 and last 30 days, live visitors, all-time page views and the time of the last hit. The cheapest way to answer \"how is the site doing?\".",
      inputSchema: { project_id: projectId },
      outputSchema: summaryObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id }) => {
      const s = await client.summary(project_id);
      return structured({ ...s }, describeSummary(s));
    },
  );

  tool(
    "get_stats",
    {
      title: "Get stats",
      description:
        "Everything about a project over a range in one call: totals, the previous period (for deltas), a time series (hour / day / month buckets in the project's time zone), the top values of every dimension (pages, referrers, countries, regions, cities, devices, browsers, OS, languages, UTM tags, custom events) and live visitors. Pass filters to scope all of it, e.g. filters={\"country\":\"ES\"}.",
      inputSchema: {
        project_id: projectId,
        ...rangeInput,
        interval: z.enum(INTERVALS).optional().describe("Bucket size for the series (auto: hour ≤ 2 days, month > 120 days)."),
        limit: z.number().int().min(1).max(50).default(8).describe("Rows per breakdown."),
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
    "get_breakdown",
    {
      title: "Get breakdown",
      description:
        "All values of ONE dimension over a range, paginated and sorted by visitors (custom events by count): e.g. by=path for every page, by=country for every country, by=name for every custom event. Same range and filters as get_stats.",
      inputSchema: {
        project_id: projectId,
        by: dimensionEnum,
        ...rangeInput,
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(50),
      },
      outputSchema: breakdownObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, by, page, per_page, ...params }) => {
      const b = await client.breakdown(project_id, by, params, page, per_page);
      const metric = by === "name" ? "events" : "visitors";
      const lines = b.items.map((r) => `${truncate(r.value, 80)} — ${r.pageviews} views, ${r.visitors} visitors${r.events ? `, ${r.events} events` : ""}`);
      return structured({ ...b }, `${b.total} ${by} value(s) (${b.range.from} → ${b.range.to}); page ${b.page}, sorted by ${metric}.\n${lines.join("\n") || "(none)"}`);
    },
  );

  tool(
    "list_events",
    {
      title: "List events",
      description:
        "Raw hits, newest first: time, kind (pageview | event), name, path, referrer, country / city, device / browser / OS, a short daily visitor id and custom props. Filter with kind, q (substring of path, title or event name) and the same range / dimension filters as get_stats. Use it to inspect custom-event props or to see what a visitor did within a day.",
      inputSchema: {
        project_id: projectId,
        ...rangeInput,
        kind: z.enum(["pageview", "event"]).optional(),
        q: z.string().max(200).optional(),
        page: z.number().int().min(1).default(1),
        per_page: z.number().int().min(1).max(200).default(50),
      },
      outputSchema: z.looseObject({ items: z.array(eventObject), page: z.number(), per_page: z.number(), total: z.number() }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id, ...params }) => {
      const page = await client.events(project_id, params);
      const lines = page.items.map(
        (e) =>
          `${e.ts} ${e.kind === "event" ? `⚡ ${e.name}` : "view"} ${e.path}${e.referrer_host ? ` ← ${e.referrer_host}` : ""}${e.country ? ` ${e.country}${e.city ? `/${e.city}` : ""}` : ""} ${[e.device, e.browser, e.os].filter(Boolean).join("/")} v=${e.visitor}${e.ip ? ` ip=${e.ip}` : ""}${Object.keys(e.props ?? {}).length ? ` ${JSON.stringify(e.props)}` : ""}`,
      );
      return structured({ ...page }, `${page.total} event(s) total; showing page ${page.page} (${page.items.length}).\n${lines.join("\n") || "(none)"}`);
    },
  );

  tool(
    "get_live",
    {
      title: "Live visitors",
      description: "Visitors and page views in the last five minutes, and the pages they are on.",
      inputSchema: { project_id: projectId },
      outputSchema: liveObject,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ project_id }) => {
      const l = await client.live(project_id);
      return structured(
        { ...l },
        `${l.visitors} visitor(s) and ${l.pageviews} page view(s) in the last ${l.window_minutes} minutes.${l.pages.length ? `\nPages: ${l.pages.map((p) => `${p.path} (${p.visitors})`).join(", ")}` : ""}`,
      );
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
        "This month's received events (page views + custom events, including the ones dropped past the budget), and project / API key counts against the plan's limits (-1 = unlimited). Call this when a tool returns limit_reached or when the dashboard reports dropped events.",
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
        "Most recent audit events for the account (who did what, when, and whether it was allowed). Actions look like project.create, project.update, project.rotate_key, project.delete, events.purge, apikey.create, auth.denied.",
      inputSchema: {
        limit: z.number().int().min(1).max(200).default(50),
        action: z.string().optional().describe("Filter by action, e.g. project.update, events.purge, auth.denied."),
      },
      outputSchema: z.looseObject({ items: z.array(auditEventObject) }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args) => {
      const { items } = await client.auditLog(args);
      const lines = items.map(
        (e) =>
          `${e.ts} ${e.outcome.padEnd(6)} ${e.action} by ${e.actor_type}${e.actor_label ? `:${e.actor_label}` : ""}${e.target_id ? ` → ${e.target_type}:${e.target_id}` : ""}`,
      );
      return structured({ items }, lines.join("\n") || "No audit events.");
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
        description: "Every project of the account with its 30-day counts and last hit.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(await client.listProjects(), null, 2) }],
      }),
    );
  }

  if (scopes.has("stats:read")) {
    server.registerResource(
      "project-summary",
      new ResourceTemplate("oops://projects/{id}/summary", { list: undefined }),
      {
        title: "Project summary",
        description: "Today / yesterday / 7d / 30d page views and visitors for one project (by project id).",
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
  if (scopes.has("stats:read")) {
    server.registerPrompt(
      "weekly_report",
      {
        title: "Weekly traffic report",
        description: "Summarise the last 7 days of a project against the week before: trend, top pages, where visitors come from, what changed, and what to look into.",
        argsSchema: {
          project_id: z.string().describe("Project id (UUID)."),
        },
      },
      ({ project_id }) => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Call get_stats with project_id="${project_id}", period="7d" and limit=10, then get_breakdown with by="name" for the same range if the custom-events breakdown is non-empty. Write a short weekly report:
1. Headline: page views and visitors this week vs the previous week (use the previous totals in the response), in one sentence.
2. The daily shape: which days peaked or dipped, using the series.
3. Where visitors came from: top referrers and UTM sources, and top countries.
4. What they looked at: top pages, and any custom events worth mentioning (with counts).
5. Devices and browsers in one line.
6. Two or three things worth investigating next (a page that lost traffic, a new referrer, a country that appeared).
Keep it under 250 words, plain language, numbers rounded. Do not call any tool that changes data.`,
            },
          },
        ],
      }),
    );
  }

  return server;
}
