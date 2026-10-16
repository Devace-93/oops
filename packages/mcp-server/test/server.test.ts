/**
 * End-to-end tests over a real MCP client/server pair (in-memory transport)
 * against a fake oops API. No network, no database.
 */
import { describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema, type CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { MemoryAuditSink } from "../src/audit.js";
import { OopsClient } from "../src/client.js";
import { ALL_TOOLS } from "../src/rbac.js";
import { createOopsServer } from "../src/server.js";
import type { BreakdownRow, Dimension, EventRow, KeyInfo, Project, Role, Scope, Stats, Summary, Totals } from "../src/types.js";

import roles from "../../shared/api_key_roles.json";

const ROLE_SCOPES = Object.fromEntries(
  Object.entries(roles.roles).map(([r, v]) => [r, v.scopes as Scope[]]),
) as Record<Role, Scope[]>;

const keyInfo = (role: Role): KeyInfo => ({
  account: { id: "acc-1", name: "Test", plan: "pro", created_at: "2026-01-01T00:00:00Z" },
  key: { id: "key-1", prefix: "oops_live_test", role },
  scopes: ROLE_SCOPES[role],
});

const NOW = "2026-10-15T00:00:00Z";
const DIMENSIONS: Dimension[] = ["path", "hostname", "referrer", "country", "region", "city", "device", "browser", "os", "lang", "utm_source", "utm_medium", "utm_campaign", "name", "ip"];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = (what: string) => json(404, { error: { code: "not_found", message: `${what} not found.` } });

/** Just enough of the oops REST API to exercise every tool, with scope checks. */
class FakeApi {
  projects = new Map<string, Project>();
  events = new Map<string, EventRow[]>();
  limitReached: null | "projects" = null;
  calls: string[] = [];
  lastQuery: URLSearchParams | null = null;
  private n = 0;

  constructor(public role: Role) {}

  private need(scope: Scope): Response | null {
    return ROLE_SCOPES[this.role].includes(scope)
      ? null
      : json(403, { error: { code: "insufficient_scope", message: `lacks ${scope}`, required_scope: scope, role: this.role } });
  }

  private view(p: Project): Project {
    const rows = this.events.get(p.id) ?? [];
    const pv = rows.filter((e) => e.kind === "pageview").length;
    return { ...p, counts: { pageviews_30d: pv, visitors_30d: new Set(rows.map((e) => e.visitor)).size, pageviews_today: pv, last_event_at: rows[0]?.ts ?? null } };
  }

  /** Test seam: what the collect API would store. */
  hit(projectId: string, input: Partial<EventRow> & { path: string }): EventRow {
    this.n += 1;
    const e: EventRow = {
      id: this.n, ts: NOW, kind: input.name ? "event" : "pageview", name: input.name ?? null, hostname: "site.test", path: input.path, title: null,
      referrer: input.referrer_host ? `https://${input.referrer_host}/` : null, referrer_host: input.referrer_host ?? null,
      utm_source: null, utm_medium: null, utm_campaign: null, country: input.country ?? null, region: null, city: input.city ?? null,
      device: input.device ?? "desktop", browser: input.browser ?? "Chrome", os: input.os ?? "Linux", screen_w: 1440, screen_h: 900, lang: "en-US",
      visitor: input.visitor ?? `v${this.n}`, ip: null, source: "script", props: input.props ?? {},
    };
    this.events.set(projectId, [e, ...(this.events.get(projectId) ?? [])]);
    return e;
  }

  private totals(rows: EventRow[]): Totals {
    return { pageviews: rows.filter((e) => e.kind === "pageview").length, visitors: new Set(rows.map((e) => e.visitor)).size, events: rows.filter((e) => e.kind === "event").length };
  }

  private breakdown(rows: EventRow[], by: Dimension): BreakdownRow[] {
    const groups = new Map<string, EventRow[]>();
    for (const e of rows) {
      let v: string | null;
      if (by === "referrer") v = e.referrer_host ?? "(direct)";
      else if (by === "name") v = e.kind === "event" ? e.name : null;
      else v = (e as unknown as Record<string, string | null>)[by];
      if (!v) continue;
      groups.set(v, [...(groups.get(v) ?? []), e]);
    }
    return [...groups.entries()].map(([value, g]) => ({ value, ...this.totals(g) })).sort((a, b) => b.visitors - a.visitors);
  }

  private filtered(projectId: string, q: URLSearchParams): EventRow[] {
    let rows = this.events.get(projectId) ?? [];
    for (const d of DIMENSIONS) {
      const v = q.get(d);
      if (!v) continue;
      rows = rows.filter((e) => (d === "referrer" ? (e.referrer_host ?? "(direct)") === v : d === "name" ? e.name === v : (e as unknown as Record<string, string | null>)[d] === v));
    }
    return rows;
  }

  fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api/, "");
    this.calls.push(`${method} ${path}`);
    this.lastQuery = url.searchParams;
    const headers = init?.headers as Record<string, string>;
    if (headers["X-API-Key"] !== "oops_live_test") return json(401, { error: { code: "unauthorized", message: "bad key" } });
    const body = init?.body ? JSON.parse(String(init.body)) : {};

    if (path === "/apikeys/me") return json(200, keyInfo(this.role));

    if (path === "/projects" && method === "GET") {
      const items = [...this.projects.values()].map((p) => this.view(p));
      return this.need("projects:read") ?? json(200, { items, total: items.length });
    }
    if (path === "/projects" && method === "POST") {
      const denied = this.need("projects:write");
      if (denied) return denied;
      if (this.limitReached === "projects") return json(402, { error: { code: "limit_reached", message: "Project limit reached.", which: "projects" } });
      const key = body.key ?? String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      if ([...this.projects.values()].some((p) => p.key === key)) return json(409, { error: { code: "key_taken", message: `Key ${key} is taken.` } });
      this.n += 1;
      const p: Project = {
        id: crypto.randomUUID(), key, name: body.name, description: body.description ?? null, url: body.url ?? null,
        public_key: `oops_pub_k${this.n}secret`, public_key_prefix: `oops_pub_k${this.n}`,
        timezone: body.timezone ?? "UTC", allowed_origins: body.allowed_origins ?? [], collect_enabled: true, exclude_bots: true, store_ip: body.store_ip ?? false,
        counts: { pageviews_30d: 0, visitors_30d: 0, pageviews_today: 0, last_event_at: null }, created_at: NOW, updated_at: NOW,
      };
      this.projects.set(p.id, p);
      return json(201, this.view(p));
    }
    const pm = path.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
    if (!pm) {
      if (path === "/account/usage") {
        return this.need("usage:read") ?? json(200, {
          period_start: "2026-10-01", period_end: "2026-11-01", events: 1234, events_dropped: 0,
          counts: { projects: this.projects.size, api_keys: 1 },
          limits: { projects: 20, api_keys: 20, events_per_month: 500000, retention_days: 365 },
        });
      }
      if (path === "/account/audit") {
        return this.need("audit:read") ?? json(200, {
          items: [{
            id: "ev-1", ts: NOW, actor_type: "api_key", actor_id: "key-1", actor_label: "oops_live_test",
            action: "project.update", target_type: "project", target_id: "p-1", outcome: "ok", meta: { fields: ["timezone"] },
          }],
        });
      }
      return notFound(`route ${method} ${path}`);
    }
    const project = this.projects.get(pm[1]!);
    if (!project) return notFound("Project");
    const sub = pm[2] ?? "";

    if (sub === "") {
      if (method === "GET") return this.need("projects:read") ?? json(200, this.view(project));
      if (method === "PATCH") {
        const denied = this.need("projects:write");
        if (denied) return denied;
        if (body.timezone === "Mars/Olympus") return json(400, { error: { code: "invalid_timezone", message: "Bad zone." } });
        Object.assign(project, body);
        return json(200, this.view(project));
      }
      if (method === "DELETE") {
        const denied = this.need("projects:delete");
        if (denied) return denied;
        this.projects.delete(project.id);
        this.events.delete(project.id);
        return new Response(null, { status: 204 });
      }
    }
    if (sub === "rotate-key" && method === "POST") {
      const denied = this.need("projects:write");
      if (denied) return denied;
      this.n += 1;
      project.public_key = `oops_pub_r${this.n}secret`;
      project.public_key_prefix = `oops_pub_r${this.n}`;
      return json(200, { public_key: project.public_key, public_key_prefix: project.public_key_prefix });
    }
    if (sub === "events" && method === "DELETE") {
      const denied = this.need("events:delete");
      if (denied) return denied;
      const n = (this.events.get(project.id) ?? []).length;
      this.events.set(project.id, []);
      return json(200, { deleted: n, before: url.searchParams.get("before") });
    }
    const rows = this.filtered(project.id, url.searchParams);
    const range = { from: "2026-10-09", to: "2026-10-15", tz: project.timezone, interval: "day", days: 7 };
    if (sub === "summary") {
      const denied = this.need("stats:read");
      if (denied) return denied;
      const t = this.totals(rows);
      const s: Summary = { project_id: project.id, timezone: project.timezone, today: t, yesterday: t, last_7_days: t, last_30_days: t, live_visitors: t.visitors, last_event_at: rows[0]?.ts ?? null, all_time_pageviews: t.pageviews };
      return json(200, s);
    }
    if (sub === "stats") {
      const denied = this.need("stats:read");
      if (denied) return denied;
      const s: Stats = {
        project_id: project.id, range: { ...range, interval: (url.searchParams.get("interval") ?? "day") as Stats["range"]["interval"] },
        filters: Object.fromEntries(DIMENSIONS.filter((d) => url.searchParams.get(d)).map((d) => [d, url.searchParams.get(d)!])),
        totals: this.totals(rows), previous: { pageviews: 2, visitors: 1, events: 0 },
        series: [{ bucket: "2026-10-15", ...this.totals(rows) }],
        breakdowns: Object.fromEntries(DIMENSIONS.map((d) => [d, this.breakdown(rows, d)])) as Stats["breakdowns"],
        live: { window_minutes: 5, visitors: this.totals(rows).visitors, pageviews: this.totals(rows).pageviews, pages: [] },
      };
      return json(200, s);
    }
    if (sub === "stats/breakdown") {
      const denied = this.need("stats:read");
      if (denied) return denied;
      const by = (url.searchParams.get("by") ?? "path") as Dimension;
      const items = this.breakdown(rows, by);
      return json(200, { project_id: project.id, range, filters: {}, by, items, page: 1, per_page: 50, total: items.length });
    }
    if (sub === "events") {
      const denied = this.need("stats:read");
      if (denied) return denied;
      let items = rows;
      const kind = url.searchParams.get("kind");
      if (kind) items = items.filter((e) => e.kind === kind);
      const q = url.searchParams.get("q");
      if (q) items = items.filter((e) => e.path.includes(q) || (e.name ?? "").includes(q));
      return json(200, { project_id: project.id, range, filters: {}, items, page: 1, per_page: 50, total: items.length });
    }
    if (sub === "live") {
      const denied = this.need("stats:read");
      if (denied) return denied;
      return json(200, { project_id: project.id, window_minutes: 5, visitors: this.totals(rows).visitors, pageviews: this.totals(rows).pageviews, pages: this.breakdown(rows.filter((e) => e.kind === "pageview"), "path").map((r) => ({ path: r.value, visitors: r.visitors, pageviews: r.pageviews })) });
    }
    return notFound(`route ${method} ${path}`);
  };
}

type Elicit = (message: string) => Promise<{ action: "accept" | "decline" | "cancel"; content?: Record<string, unknown> }>;

async function connect(role: Role, opts: { elicit?: Elicit; apiRole?: Role; api?: FakeApi } = {}) {
  const api = opts.api ?? new FakeApi(opts.apiRole ?? role);
  const client = new OopsClient({ baseUrl: "http://fake/api", apiKey: "oops_live_test", fetch: api.fetch as typeof fetch });
  const audit = new MemoryAuditSink();
  const server = createOopsServer({ client, keyInfo: keyInfo(role), audit, transport: "test" });

  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: opts.elicit ? { elicitation: { form: {} } } : {} });
  if (opts.elicit) mcp.setRequestHandler(ElicitRequestSchema, async (req) => opts.elicit!(req.params.message));

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);

  const call = (name: string, args: Record<string, unknown> = {}) =>
    mcp.callTool({ name, arguments: args }) as Promise<CallToolResult>;
  const toolNames = async () => (await mcp.listTools()).tools.map((t) => t.name).sort();
  const textOf = (r: CallToolResult) => r.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  const project = async (name = "Web app") => (await call("create_project", { name })).structuredContent as Project;
  return { api, mcp, audit, server, call, toolNames, textOf, project };
}

function seed(api: FakeApi, projectId: string): void {
  api.hit(projectId, { path: "/", country: "ES", city: "Madrid", device: "desktop", browser: "Firefox", visitor: "a" });
  api.hit(projectId, { path: "/docs", country: "ES", device: "mobile", browser: "Safari", os: "iOS", referrer_host: "news.ycombinator.com", visitor: "b" });
  api.hit(projectId, { path: "/docs", country: "MX", device: "desktop", visitor: "c" });
  api.hit(projectId, { path: "/pricing", name: "signup", props: { plan: "pro" }, country: "ES", visitor: "a" });
}

describe("RBAC: tool visibility follows the key's role", () => {
  test("viewer sees read-only tools only", async () => {
    const { toolNames } = await connect("viewer");
    const names = await toolNames();
    expect(names).toEqual(["get_breakdown", "get_live", "get_project", "get_stats", "get_usage", "list_events", "list_projects", "project_summary"].sort());
    expect(names).not.toContain("update_project");
    expect(names).not.toContain("purge_events");
  });

  test("editor adds write tools but no delete, purge or audit", async () => {
    const { toolNames } = await connect("editor");
    const names = await toolNames();
    for (const t of ["create_project", "update_project", "rotate_project_key"]) expect(names).toContain(t);
    for (const t of ["delete_project", "purge_events", "get_audit_log"]) expect(names).not.toContain(t);
  });

  test("admin sees every tool in CONTRACT.md", async () => {
    const { toolNames } = await connect("admin");
    expect(await toolNames()).toEqual([...ALL_TOOLS].sort());
    expect(ALL_TOOLS).toHaveLength(14);
  });

  test("a hidden tool cannot be called", async () => {
    const { call, textOf, api } = await connect("viewer");
    const r = await call("create_project", { name: "x" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/not found/i);
    expect(api.calls.filter((c) => c.startsWith("POST"))).toHaveLength(0);
  });

  test("the API's own scope check is surfaced as a denied result, not a crash", async () => {
    const { call, textOf, audit } = await connect("admin", { apiRole: "viewer" });
    const r = await call("create_project", { name: "x" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("insufficient_scope");
    expect(textOf(r)).toContain('"required_scope":"projects:write"');
    expect(audit.entries.at(-1)?.outcome).toBe("denied");
  });
});

describe("projects", () => {
  test("create_project returns the public key and a snippet", async () => {
    const c = await connect("editor");
    const r = await c.call("create_project", { name: "Web app", url: "https://example.com", timezone: "Europe/Madrid" });
    expect(r.isError).toBeFalsy();
    const p = r.structuredContent as Project;
    expect(p.key).toBe("web-app");
    expect(p.public_key).toMatch(/^oops_pub_/);
    expect(p.timezone).toBe("Europe/Madrid");
    expect(c.textOf(r)).toContain(`data-key="${p.public_key}"`);
    expect((await c.call("list_projects")).structuredContent).toMatchObject({ total: 1 });
  });

  test("key_taken and limit_reached surface with their codes", async () => {
    const c = await connect("editor");
    await c.project();
    const dup = await c.call("create_project", { name: "Web app" });
    expect(dup.isError).toBe(true);
    expect(c.textOf(dup)).toContain("key_taken");
    c.api.limitReached = "projects";
    const lim = await c.call("create_project", { name: "Other" });
    expect(lim.isError).toBe(true);
    expect(c.textOf(lim)).toContain("limit_reached");
    expect(c.textOf(lim)).toContain('"which":"projects"');
    expect(c.audit.entries.at(-1)?.error?.code).toBe("limit_reached");
  });

  test("update_project pauses tracking and sets origins; rotate_project_key issues a new key", async () => {
    const c = await connect("editor");
    const p = await c.project();
    const up = (await c.call("update_project", { project_id: p.id, collect_enabled: false, allowed_origins: ["example.com", "*.example.com"] })).structuredContent as Project;
    expect(up.collect_enabled).toBe(false);
    expect(up.allowed_origins).toEqual(["example.com", "*.example.com"]);
    const bad = await c.call("update_project", { project_id: p.id, timezone: "Mars/Olympus" });
    expect(bad.isError).toBe(true);
    expect(c.textOf(bad)).toContain("invalid_timezone");

    const rot = await c.call("rotate_project_key", { project_id: p.id });
    expect(rot.isError).toBeFalsy();
    expect((rot.structuredContent as { public_key: string }).public_key).not.toBe(p.public_key);
  });

  test("invalid input is rejected before reaching the API", async () => {
    const c = await connect("editor");
    const before = c.api.calls.length;
    expect((await c.call("create_project", { name: "x", key: "Not A Slug" })).isError).toBe(true);
    expect((await c.call("get_stats", { project_id: crypto.randomUUID(), period: "yesterweek" })).isError).toBe(true);
    expect((await c.call("get_breakdown", { project_id: crypto.randomUUID(), by: "shoe_size" })).isError).toBe(true);
    expect((await c.call("get_stats", { project_id: crypto.randomUUID(), from: "15/10/2026" })).isError).toBe(true);
    expect(c.api.calls.length).toBe(before);
  });
});

describe("stats", () => {
  test("project_summary, get_stats with filters, get_breakdown and get_live", async () => {
    const c = await connect("viewer", { api: new FakeApi("editor") });
    const created = await new FakeApi("editor").fetch("http://fake/api/projects", { method: "POST", headers: { "X-API-Key": "oops_live_test" }, body: JSON.stringify({ name: "Site" }) });
    void created;
    const admin = await connect("editor", { api: c.api });
    const p = await admin.project("Site");
    seed(c.api, p.id);

    const s = await c.call("project_summary", { project_id: p.id });
    expect(s.isError).toBeFalsy();
    expect((s.structuredContent as Summary).last_30_days).toEqual({ pageviews: 3, visitors: 3, events: 1 });
    expect(c.textOf(s)).toContain("3 views / 3 visitors");

    const st = await c.call("get_stats", { project_id: p.id, period: "7d", filters: { country: "ES" } });
    expect(st.isError).toBeFalsy();
    const stats = st.structuredContent as Stats;
    expect(stats.totals).toEqual({ pageviews: 2, visitors: 2, events: 1 });
    expect(stats.filters).toEqual({ country: "ES" });
    expect(c.api.lastQuery?.get("country")).toBe("ES");
    expect(c.api.lastQuery?.get("period")).toBe("7d");
    expect(c.textOf(st)).toContain("Top pages (views)");
    expect(c.textOf(st)).toContain("news.ycombinator.com");

    const b = await c.call("get_breakdown", { project_id: p.id, by: "country" });
    expect(b.isError).toBeFalsy();
    const rows = (b.structuredContent as { items: BreakdownRow[] }).items;
    expect(rows.map((r) => r.value)).toEqual(["ES", "MX"]);
    expect(rows[0]!.visitors).toBe(2);

    const names = (await c.call("get_breakdown", { project_id: p.id, by: "name" })).structuredContent as { items: BreakdownRow[] };
    expect(names.items).toEqual([{ value: "signup", pageviews: 0, visitors: 1, events: 1 }]);

    const live = await c.call("get_live", { project_id: p.id });
    expect(live.isError).toBeFalsy();
    expect(c.textOf(live)).toContain("3 visitor(s)");
  });

  test("list_events filters by kind and q and shows props", async () => {
    const c = await connect("editor");
    const p = await c.project();
    seed(c.api, p.id);
    const ev = await c.call("list_events", { project_id: p.id, kind: "event" });
    expect(ev.isError).toBeFalsy();
    const page = ev.structuredContent as { items: EventRow[]; total: number };
    expect(page.total).toBe(1);
    expect(page.items[0]!.name).toBe("signup");
    expect(c.textOf(ev)).toContain('{"plan":"pro"}');
    const docs = (await c.call("list_events", { project_id: p.id, q: "docs" })).structuredContent as { total: number };
    expect(docs.total).toBe(2);
  });

  test("get_usage and get_audit_log return schema-valid structured content", async () => {
    const c = await connect("admin");
    const u = await c.call("get_usage");
    expect(u.isError).toBeFalsy();
    expect(c.textOf(u)).toContain("1234/500000 events");
    const a = await c.call("get_audit_log", { limit: 5 });
    expect(a.isError).toBeFalsy();
    expect((a.structuredContent as { items: unknown[] }).items).toHaveLength(1);
    expect(c.textOf(a)).toContain("project.update");
  });
});

describe("destructive tools require human approval", () => {
  test("delete_project refuses without confirmation and succeeds with confirm=true", async () => {
    const c = await connect("admin");
    const p = await c.project();
    seed(c.api, p.id);

    const refused = await c.call("delete_project", { project_id: p.id });
    expect(refused.isError).toBe(true);
    expect(c.textOf(refused)).toContain("confirmation_required");
    expect(c.textOf(refused)).toContain("Web app");
    expect(c.api.projects.has(p.id)).toBe(true);
    expect(c.audit.entries.at(-1)?.outcome).toBe("pending");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);

    const done = await c.call("delete_project", { project_id: p.id, confirm: true });
    expect(done.isError).toBeFalsy();
    expect(done.structuredContent).toEqual({ deleted: true, id: p.id, key: "web-app", name: "Web app" });
    expect(c.api.projects.has(p.id)).toBe(false);
    expect(c.audit.entries.at(-1)?.outcome).toBe("ok");
  });

  test("purge_events follows the same flow", async () => {
    const c = await connect("admin");
    const p = await c.project();
    seed(c.api, p.id);
    const refused = await c.call("purge_events", { project_id: p.id });
    expect(refused.isError).toBe(true);
    expect(c.textOf(refused)).toContain("confirmation_required");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);
    const done = await c.call("purge_events", { project_id: p.id, confirm: true });
    expect(done.isError).toBeFalsy();
    expect(done.structuredContent).toEqual({ deleted: 4, before: null, project_id: p.id });
    expect(c.api.events.get(p.id)).toEqual([]);
  });

  test("with elicitation, the user is asked and can accept", async () => {
    const asked: string[] = [];
    const c = await connect("admin", {
      elicit: async (message) => {
        asked.push(message);
        return { action: "accept", content: { confirm: true } };
      },
    });
    const p = await c.project();
    seed(c.api, p.id);
    const done = await c.call("purge_events", { project_id: p.id, before: "2026-10-01" });
    expect(done.isError).toBeFalsy();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("before 2026-10-01");
    expect(asked[0]).toContain("Web app");
  });

  test("with elicitation, declining cancels and nothing is deleted", async () => {
    const c = await connect("admin", { elicit: async () => ({ action: "decline" }) });
    const p = await c.project();
    const r = await c.call("delete_project", { project_id: p.id });
    expect(r.isError).toBeFalsy();
    expect(c.textOf(r)).toContain("Cancelled");
    expect((r.structuredContent as { deleted: boolean }).deleted).toBe(false);
    expect(c.api.projects.has(p.id)).toBe(true);
    expect(c.audit.entries.at(-1)?.outcome).toBe("cancelled");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);
  });
});

describe("resources and prompts", () => {
  test("projects resource and summary template are exposed for a viewer", async () => {
    const admin = await connect("admin");
    const p = await admin.project();
    seed(admin.api, p.id);
    const viewer = await connect("viewer", { api: Object.assign(admin.api, { role: "viewer" as Role }) });
    const res = await viewer.mcp.listResources();
    expect(res.resources.map((r) => r.uri)).toContain("oops://projects");
    const tpl = await viewer.mcp.listResourceTemplates();
    expect(tpl.resourceTemplates.map((t) => t.uriTemplate)).toContain("oops://projects/{id}/summary");
    const list = await viewer.mcp.readResource({ uri: "oops://projects" });
    expect(JSON.parse((list.contents[0] as { text: string }).text).total).toBe(1);
    const summary = await viewer.mcp.readResource({ uri: `oops://projects/${p.id}/summary` });
    expect(JSON.parse((summary.contents[0] as { text: string }).text).all_time_pageviews).toBe(3);
  });

  test("weekly_report prompt is available when stats:read is granted", async () => {
    const { mcp } = await connect("viewer");
    const prompts = await mcp.listPrompts();
    expect(prompts.prompts.map((p) => p.name)).toContain("weekly_report");
    const got = await mcp.getPrompt({ name: "weekly_report", arguments: { project_id: "p-1" } });
    const text = (got.messages[0]!.content as { text: string }).text;
    expect(text).toContain('project_id="p-1"');
    expect(text).toContain("get_stats");
  });
});
