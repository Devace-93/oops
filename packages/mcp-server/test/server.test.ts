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
import { InvalidIssueRef, formatIssueRef, parseIssueRef } from "../src/issue.js";
import { ALL_TOOLS, TOOL_SCOPES, allowedTools, type ToolName } from "../src/rbac.js";
import { createOopsServer } from "../src/server.js";
import type { Event, IngestEventInput, Issue, KeyInfo, Level, Project, Role, Scope, Stats } from "../src/types.js";
import { VERSION } from "../src/version.js";

import roles from "../../shared/api_key_roles.json";

const ROLE_SCOPES = Object.fromEntries(
  Object.entries(roles.roles).map(([r, v]) => [r, v.scopes as Scope[]]),
) as Record<Role, Scope[]>;

const keyInfo = (role: Role): KeyInfo => ({
  id: "key-1",
  name: "test key",
  role,
  prefix: "oops_live_test",
  scopes: ROLE_SCOPES[role],
  account: { id: "acc-1", name: "Test", plan: "pro", created_at: "2026-01-01T00:00:00Z" },
});

const NOW = "2026-10-15T00:00:00Z";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const notFound = (what: string) => json(404, { error: { code: "not_found", message: `${what} not found.` } });

interface Captured {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
  query: URLSearchParams;
}

/** Just enough of the oops REST + ingest API to exercise every tool, with scope checks. */
class FakeApi {
  projects = new Map<string, Project>();
  issues = new Map<string, Issue[]>();
  events = new Map<string, Event[]>();
  limitReached: null | "projects" = null;
  overBudget = false;
  calls: string[] = [];
  last: Captured | null = null;
  lastIngest: Captured | null = null;
  private n = 0;
  private evn = 0;

  constructor(public role: Role) {}

  private need(scope: Scope): Response | null {
    return ROLE_SCOPES[this.role].includes(scope)
      ? null
      : json(403, { error: { code: "insufficient_scope", message: `lacks ${scope}`, required_scope: scope, role: this.role } });
  }

  private view(p: Project): Project {
    const issues = this.issues.get(p.id) ?? [];
    const events = this.events.get(p.id) ?? [];
    return {
      ...p,
      counts: {
        open_issues: issues.filter((i) => i.status === "open").length,
        events_24h: events.length,
        events_30d: events.length,
        users_30d: new Set(events.map((e) => e.user_hash)).size,
        last_event_at: events[0]?.ts ?? null,
      },
    };
  }

  /** Test seam: what the ingest API stores (simplified fingerprint = type + message). */
  ingest(project: Project, input: IngestEventInput & { user_hash?: string; source?: string }): Event {
    this.evn += 1;
    const n = this.evn;
    const fp = input.fingerprint?.join("|") ?? `${input.type ?? ""}|${input.message ?? ""}`;
    const list = this.issues.get(project.id) ?? [];
    let issue = list.find((i) => i.fingerprint === fp);
    const title = input.type && input.message ? `${input.type}: ${input.message}` : (input.type ?? input.message ?? "");
    if (!issue) {
      issue = {
        id: crypto.randomUUID(), project_id: project.id, number: list.length + 1, fingerprint: fp, title,
        culprit: input.frames?.[0] ? `${input.frames[0].function ?? "?"} in ${input.frames[0].filename ?? "?"}` : null,
        type: input.type ?? null, level: input.level ?? "error", status: "open", first_seen: NOW, last_seen: NOW,
        resolved_at: null, regressed_at: null, event_count: 0, user_count: 0, environments: [], releases: [],
        latest_event_id: null, created_at: NOW, updated_at: NOW,
      };
      list.push(issue);
      this.issues.set(project.id, list);
    } else if (issue.status === "resolved") {
      issue.status = "open";
      issue.resolved_at = null;
      issue.regressed_at = NOW;
    }
    const e: Event = {
      id: String(1000 + n), project_id: project.id, issue_id: issue.id, issue_number: issue.number, ts: NOW,
      level: input.level ?? "error", type: input.type ?? null, message: input.message ?? "", frames: (input.frames ?? []).map((f) => ({ ...f, in_app: f.in_app ?? true })),
      stack_raw: input.stack ?? null, url: input.url ?? null, path: input.url ? new URL(input.url).pathname : null, hostname: input.url ? new URL(input.url).hostname : null,
      release: input.release ?? null, environment: input.environment ?? "production", platform: input.platform ?? null, sdk: input.sdk ?? null,
      user: input.user ?? null, user_hash: input.user_hash ?? (input.user?.id ? `u:${input.user.id}` : `anon${n}`),
      browser: "Chrome", os: "Linux", device: "desktop", ip: null, tags: input.tags ?? {}, extra: input.extra ?? {}, breadcrumbs: input.breadcrumbs ?? [],
      source: input.source ?? "api",
    };
    const events = this.events.get(project.id) ?? [];
    events.unshift(e);
    this.events.set(project.id, events);
    issue.event_count += 1;
    issue.user_count = new Set(events.filter((x) => x.issue_id === issue!.id).map((x) => x.user_hash)).size;
    issue.last_seen = NOW;
    issue.latest_event_id = e.id;
    if (!issue.environments.includes(e.environment)) issue.environments.push(e.environment);
    if (e.release && !issue.releases.includes(e.release)) issue.releases.push(e.release);
    return e;
  }

  /** Test seam: create a project bypassing the scope check. */
  createProject(name: string): Project {
    this.n += 1;
    const p: Project = {
      id: crypto.randomUUID(), key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), name, description: null, url: null,
      public_key: `oops_pub_k${this.n}secret`, public_key_prefix: `oops_pub_k${this.n}`,
      timezone: "UTC", allowed_origins: [], ingest_enabled: true, store_ip: false,
      counts: { open_issues: 0, events_24h: 0, events_30d: 0, users_30d: 0, last_event_at: null }, created_at: NOW, updated_at: NOW,
    };
    this.projects.set(p.id, p);
    return { ...p };
  }

  private findIssue(projectId: string, ref: string): Issue | undefined {
    const list = this.issues.get(projectId) ?? [];
    return UUID_RE.test(ref) ? list.find((i) => i.id === ref) : list.find((i) => i.number === Number(ref));
  }

  private page<T>(items: T[], q: URLSearchParams) {
    const page = Number(q.get("page") ?? 1);
    const per_page = Number(q.get("per_page") ?? 25);
    return { items: items.slice((page - 1) * per_page, page * per_page), page, per_page, total: items.length };
  }

  fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api/, "");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    this.calls.push(`${method} ${path}`);
    this.last = { method, path, headers, body, query: url.searchParams };

    // --- ingest: project public key, no API key ---
    if (path === "/ingest" && method === "POST") {
      this.lastIngest = this.last;
      const key = headers["X-Project-Key"] ?? body.k;
      const project = [...this.projects.values()].find((p) => p.public_key === key);
      if (!project) return json(401, { error: { code: "invalid_project_key", message: "Unknown project key." } });
      if (!body.type && !body.message) return json(400, { error: { code: "invalid_event", message: "type or message required." } });
      if (!project.ingest_enabled) return json(202, { ok: false, reason: "paused" });
      if (this.overBudget) return json(202, { ok: false, reason: "limit" });
      const e = this.ingest(project, { ...body, source: "api" });
      return json(202, { ok: true, event_id: e.id, issue_id: e.issue_id, issue_number: e.issue_number });
    }

    if (headers["X-API-Key"] !== "oops_live_test") return json(401, { error: { code: "unauthorized", message: "bad key" } });

    if (path === "/apikeys/me") return json(200, keyInfo(this.role));

    if (path === "/projects" && method === "GET") {
      const items = [...this.projects.values()].map((p) => this.view(p)).reverse();
      return this.need("projects:read") ?? json(200, { items });
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
        timezone: body.timezone ?? "UTC", allowed_origins: body.allowed_origins ?? [], ingest_enabled: true, store_ip: false,
        counts: { open_issues: 0, events_24h: 0, events_30d: 0, users_30d: 0, last_event_at: null }, created_at: NOW, updated_at: NOW,
      };
      this.projects.set(p.id, p);
      return json(201, this.view(p));
    }
    if (path === "/account/usage") {
      return this.need("usage:read") ?? json(200, {
        period_start: "2026-10-01", period_end: "2026-11-01", events: 1234, events_dropped: this.overBudget ? 10 : 0,
        counts: { projects: this.projects.size, api_keys: 1 },
        limits: { projects: 20, api_keys: 20, events_per_month: 100000, retention_days: 90 },
      });
    }
    if (path === "/account/audit") {
      const denied = this.need("audit:read");
      if (denied) return denied;
      const items = [{
        id: "ev-1", ts: NOW, actor_type: "api_key", actor_id: "key-1", actor_label: "oops_live_test",
        action: "issue.update", target_type: "issue", target_id: "i-1", outcome: "ok", meta: { status: "resolved" },
      }].filter((e) => !url.searchParams.get("action") || e.action === url.searchParams.get("action"));
      return json(200, this.page(items, url.searchParams));
    }

    const pm = path.match(/^\/projects\/([^/]+)(?:\/(.*))?$/);
    if (!pm) return notFound(`route ${method} ${path}`);
    const project = this.projects.get(pm[1]!);
    if (!project) return notFound("Project");
    const sub = pm[2] ?? "";
    const q = url.searchParams;

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
        this.issues.delete(project.id);
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
      return json(200, this.view(project));
    }
    if (sub === "summary") {
      return this.need("projects:read") ?? json(200, this.view(project).counts);
    }
    if (sub === "events" && method === "DELETE") {
      const denied = this.need("events:delete");
      if (denied) return denied;
      const r = { deleted_events: (this.events.get(project.id) ?? []).length, deleted_issues: (this.issues.get(project.id) ?? []).length };
      this.events.set(project.id, []);
      this.issues.set(project.id, []);
      return json(200, r);
    }

    const issues = this.issues.get(project.id) ?? [];
    const events = this.events.get(project.id) ?? [];

    if (sub === "issues" && method === "GET") {
      const denied = this.need("issues:read");
      if (denied) return denied;
      let items = issues.slice();
      const status = q.get("status") ?? "open";
      if (status !== "all") items = items.filter((i) => i.status === status);
      if (q.get("level")) items = items.filter((i) => i.level === q.get("level"));
      if (q.get("environment")) items = items.filter((i) => i.environments.includes(q.get("environment")!));
      if (q.get("release")) items = items.filter((i) => i.releases.includes(q.get("release")!));
      if (q.get("q")) items = items.filter((i) => i.title.toLowerCase().includes(q.get("q")!.toLowerCase()));
      if (q.get("sort") === "users") items.sort((a, b) => b.user_count - a.user_count);
      else if (q.get("sort") === "events") items.sort((a, b) => b.event_count - a.event_count);
      return json(200, this.page(items, q));
    }
    if (sub === "issues/bulk" && method === "POST") {
      const denied = this.need("issues:write");
      if (denied) return denied;
      let updated = 0;
      for (const ref of body.ids as string[]) {
        const i = this.findIssue(project.id, ref);
        if (i) { i.status = body.status; updated += 1; }
      }
      return json(200, { updated });
    }
    const im = sub.match(/^issues\/([^/]+)(?:\/(events))?$/);
    if (im) {
      const issue = this.findIssue(project.id, im[1]!);
      if (!issue) return notFound("Issue");
      if (im[2] === "events") {
        return this.need("issues:read") ?? json(200, this.page(events.filter((e) => e.issue_id === issue.id), q));
      }
      if (method === "GET") {
        return this.need("issues:read") ?? json(200, { ...issue, latest_event: events.find((e) => e.id === issue.latest_event_id) ?? null });
      }
      if (method === "PATCH") {
        const denied = this.need("issues:write");
        if (denied) return denied;
        if (!["open", "resolved", "ignored"].includes(body.status)) return json(400, { error: { code: "invalid_status", message: "bad status" } });
        issue.status = body.status;
        issue.resolved_at = body.status === "resolved" ? NOW : null;
        return json(200, issue);
      }
    }
    if (sub === "events" && method === "GET") {
      const denied = this.need("issues:read");
      if (denied) return denied;
      let items = events.slice();
      if (q.get("level")) items = items.filter((e) => e.level === q.get("level"));
      if (q.get("environment")) items = items.filter((e) => e.environment === q.get("environment"));
      if (q.get("release")) items = items.filter((e) => e.release === q.get("release"));
      if (q.get("q")) items = items.filter((e) => e.message.toLowerCase().includes(q.get("q")!.toLowerCase()));
      if (q.get("issue")) {
        const issue = this.findIssue(project.id, q.get("issue")!);
        items = items.filter((e) => e.issue_id === issue?.id);
      }
      return json(200, this.page(items, q));
    }
    const em = sub.match(/^events\/(\d+)$/);
    if (em && method === "GET") {
      const denied = this.need("issues:read");
      if (denied) return denied;
      const e = events.find((x) => x.id === em[1]);
      return e ? json(200, e) : notFound("Event");
    }
    if (sub === "stats") {
      const denied = this.need("issues:read");
      if (denied) return denied;
      let rows = events.slice();
      if (q.get("level")) rows = rows.filter((e) => e.level === q.get("level"));
      if (q.get("environment")) rows = rows.filter((e) => e.environment === q.get("environment"));
      if (q.get("release")) rows = rows.filter((e) => e.release === q.get("release"));
      const group = (pick: (e: Event) => string | null | undefined) => {
        const m = new Map<string, Event[]>();
        for (const e of rows) { const v = pick(e); if (v) m.set(v, [...(m.get(v) ?? []), e]); }
        return [...m.entries()].map(([value, g]) => ({ value, events: g.length, users: new Set(g.map((e) => e.user_hash)).size })).sort((a, b) => b.events - a.events);
      };
      const totals = { events: rows.length, users: new Set(rows.map((e) => e.user_hash)).size, issues_new: issues.length, issues_open: issues.filter((i) => i.status === "open").length };
      const s: Stats = {
        range: { from: "2026-10-09", to: "2026-10-15", tz: project.timezone, interval: (q.get("interval") ?? "day") as Stats["range"]["interval"] },
        totals, previous: { events: 2, users: 1, issues_new: 1 },
        series: [{ ts: "2026-10-15T00:00:00Z", events: rows.length, users: totals.users }],
        breakdowns: { level: group((e) => e.level), environment: group((e) => e.environment), release: group((e) => e.release), browser: group((e) => e.browser), os: group((e) => e.os), device: group((e) => e.device), type: group((e) => e.type) },
      };
      return json(200, s);
    }
    if (sub === "live") {
      return this.need("issues:read") ?? json(200, { events: events.length, window_min: 5 });
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
  // Projects are created straight in the fake (no scope check) so viewers can have one too.
  const project = async (name = "Web app") => api.createProject(name);
  return { api, mcp, audit, server, call, toolNames, textOf, project };
}

/** Three issues: a TypeError hitting 3 users (2 events), a fatal from release 1.4.2 and a warning. */
function seed(api: FakeApi, p: Project): { typeErr: Issue; fatal: Issue; warn: Issue } {
  const frames = [{ filename: "https://app/x.js", function: "init", lineno: 12, colno: 4, in_app: true }];
  api.ingest(p, { type: "TypeError", message: "x is not a function", frames, url: "https://app.example/checkout?x=1", release: "1.4.1", user: { id: "u1" }, tags: { page: "checkout" }, breadcrumbs: [{ category: "click", message: "button#pay" }] });
  api.ingest(p, { type: "TypeError", message: "x is not a function", frames, url: "https://app.example/checkout", release: "1.4.2", user: { id: "u2" } });
  api.ingest(p, { type: "TypeError", message: "x is not a function", frames, url: "https://app.example/checkout", release: "1.4.2", user: { id: "u3" } });
  api.ingest(p, { type: "OutOfMemory", message: "heap exhausted", level: "fatal", release: "1.4.2", environment: "staging", user: { id: "u1" } });
  api.ingest(p, { message: "Deprecated API used", level: "warning", user: { id: "u9" } });
  const [typeErr, fatal, warn] = api.issues.get(p.id)!;
  return { typeErr: typeErr!, fatal: fatal!, warn: warn! };
}

// --------------------------------------------------------------------------- //

describe("issue references", () => {
  test("parseIssueRef accepts uuid, number, numeric string and #number", () => {
    const uuid = "6F9619FF-8B86-D011-B42D-00C04FC964FF";
    expect(parseIssueRef(uuid)).toBe(uuid.toLowerCase());
    expect(parseIssueRef(12)).toBe("12");
    expect(parseIssueRef("12")).toBe("12");
    expect(parseIssueRef("#12")).toBe("12");
    expect(parseIssueRef("  # 7 ")).toBe("7");
    expect(formatIssueRef("12")).toBe("#12");
    expect(formatIssueRef(uuid.toLowerCase())).toBe(uuid.toLowerCase());
  });

  test("parseIssueRef rejects garbage", () => {
    for (const bad of ["", "abc", "#", "#0", "0", "12abc", "1.5", "-3", 0, -1, 1.5, "not-a-uuid-at-all-1234"]) {
      expect(() => parseIssueRef(bad as string | number)).toThrow(InvalidIssueRef);
    }
  });
});

describe("RBAC: tool visibility follows the key's role", () => {
  const READ = ["list_projects", "get_project", "list_issues", "get_issue", "list_issue_events", "get_event", "search_events", "get_stats", "get_live", "get_usage", "report_error"];
  const WRITE = ["create_project", "update_project", "rotate_public_key", "update_issue", "bulk_update_issues"];
  const ADMIN = ["delete_project", "purge_events", "get_audit_log"];

  test("the tool table matches CONTRACT.md", () => {
    expect(ALL_TOOLS).toHaveLength(19);
    expect([...READ, ...WRITE, ...ADMIN].sort()).toEqual([...ALL_TOOLS].sort());
    expect(TOOL_SCOPES.report_error).toEqual(["projects:read"]);
    expect(TOOL_SCOPES.get_stats).toEqual(["issues:read"]);
    expect(TOOL_SCOPES.purge_events).toEqual(["events:delete"]);
    expect(allowedTools(ROLE_SCOPES.viewer).sort()).toEqual([...READ].sort());
    expect(allowedTools(ROLE_SCOPES.editor).sort()).toEqual([...READ, ...WRITE].sort());
    expect(allowedTools(ROLE_SCOPES.admin).sort()).toEqual([...ALL_TOOLS].sort());
  });

  test("viewer sees read-only tools (and report_error) only", async () => {
    const { toolNames } = await connect("viewer");
    const names = await toolNames();
    expect(names).toEqual([...READ].sort());
    for (const t of [...WRITE, ...ADMIN]) expect(names).not.toContain(t);
  });

  test("editor adds write tools but no delete, purge or audit", async () => {
    const { toolNames } = await connect("editor");
    const names = await toolNames();
    expect(names).toEqual([...READ, ...WRITE].sort());
    for (const t of ADMIN) expect(names).not.toContain(t);
  });

  test("admin sees every tool", async () => {
    const { toolNames } = await connect("admin");
    expect(await toolNames()).toEqual([...ALL_TOOLS].sort());
  });

  test("a hidden tool cannot be called", async () => {
    const { call, textOf, api } = await connect("viewer");
    const r = await call("update_issue", { project_id: crypto.randomUUID(), issue: 1, status: "resolved" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toMatch(/not found/i);
    expect(api.calls.filter((c) => c.startsWith("PATCH"))).toHaveLength(0);
  });

  test("the API's own scope check is surfaced as a denied result, not a crash", async () => {
    const { call, textOf, audit } = await connect("admin", { apiRole: "viewer" });
    const r = await call("create_project", { name: "x" });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain("insufficient_scope");
    expect(textOf(r)).toContain('"required_scope":"projects:write"');
    expect(audit.entries.at(-1)?.outcome).toBe("denied");
  });

  test("every tool description names its scope", async () => {
    const { mcp } = await connect("admin");
    for (const t of (await mcp.listTools()).tools) {
      expect(t.description).toContain(`requires scope ${TOOL_SCOPES[t.name as ToolName].join(" + ")}`);
      expect(t.outputSchema).toBeDefined();
    }
  });
});

describe("input schemas", () => {
  const PID = crypto.randomUUID();
  /** For every tool: the required fields the host sees, one valid call, one invalid call. */
  /** `invalid: null` = the tool takes no input, so nothing can be invalid (unknown keys are stripped). */
  const CASES: Record<ToolName, { required: string[]; valid: Record<string, unknown>; invalid: Record<string, unknown> | null }> = {
    list_projects: { required: [], valid: {}, invalid: { q: "x".repeat(101) } },
    get_project: { required: ["project_id"], valid: { project_id: PID }, invalid: { project_id: "nope" } },
    create_project: { required: ["name"], valid: { name: "App", url: "https://a.example", allowed_origins: ["a.example"] }, invalid: { name: "App", key: "Not A Slug" } },
    update_project: { required: ["project_id"], valid: { project_id: PID, ingest_enabled: false }, invalid: { project_id: PID, url: "not a url" } },
    rotate_public_key: { required: ["project_id"], valid: { project_id: PID }, invalid: {} },
    delete_project: { required: ["project_id"], valid: { project_id: PID, confirm: true }, invalid: { project_id: PID, confirm: "yes" } },
    list_issues: { required: ["project_id"], valid: { project_id: PID, status: "all", level: "error", environment: "production", release: "1.4.2", q: "x", period: "7d", sort: "users", page: 1, per_page: 10 }, invalid: { project_id: PID, status: "closed" } },
    get_issue: { required: ["project_id", "issue"], valid: { project_id: PID, issue: "#1" }, invalid: { project_id: PID, issue: true } },
    list_issue_events: { required: ["project_id", "issue"], valid: { project_id: PID, issue: 1 }, invalid: { project_id: PID, issue: 1, per_page: 101 } },
    get_event: { required: ["project_id", "event_id"], valid: { project_id: PID, event_id: "1001" }, invalid: { project_id: PID, event_id: 1001 } },
    search_events: { required: ["project_id"], valid: { project_id: PID, level: "fatal", q: "heap", issue: "#2", period: "all" }, invalid: { project_id: PID, period: "yesterweek" } },
    update_issue: { required: ["project_id", "issue", "status"], valid: { project_id: PID, issue: 1, status: "resolved" }, invalid: { project_id: PID, issue: 1, status: "closed" } },
    bulk_update_issues: { required: ["project_id", "issues", "status"], valid: { project_id: PID, issues: [1, "#2"], status: "ignored" }, invalid: { project_id: PID, issues: [], status: "ignored" } },
    get_stats: { required: ["project_id"], valid: { project_id: PID, period: "30d", interval: "day", level: "error" }, invalid: { project_id: PID, from: "15/10/2026" } },
    get_live: { required: ["project_id"], valid: { project_id: PID }, invalid: { project_id: 12 } },
    purge_events: { required: ["project_id"], valid: { project_id: PID, confirm: true }, invalid: { project_id: PID, before: "2026-01-01", confirm: 1 } },
    get_usage: { required: [], valid: {}, invalid: null },
    get_audit_log: { required: [], valid: { action: "issue.update", actor_type: "api_key", outcome: "ok", since: NOW, page: 1, per_page: 5 }, invalid: { per_page: 0 } },
    report_error: { required: ["project_id"], valid: { project_id: PID, type: "TimeoutError", message: "upstream took 30s" }, invalid: { project_id: PID, message: "x", level: "critical" } },
  };

  test("every tool is covered and declares the expected required fields", async () => {
    expect(Object.keys(CASES).sort()).toEqual([...ALL_TOOLS].sort());
    const { mcp } = await connect("admin");
    const tools = new Map((await mcp.listTools()).tools.map((t) => [t.name, t]));
    for (const name of ALL_TOOLS) {
      const schema = tools.get(name)!.inputSchema as { required?: string[]; properties: Record<string, unknown> };
      expect([...(schema.required ?? [])].sort()).toEqual([...CASES[name].required].sort());
      for (const k of Object.keys(CASES[name].valid)) expect(schema.properties).toHaveProperty(k);
    }
  });

  test("invalid input is rejected before any API call; valid input reaches the API", async () => {
    const c = await connect("admin");
    const p = await c.project();
    seed(c.api, p);
    // Destructive tools last: with confirm=true they really purge / delete the seeded project.
    const order: ToolName[] = [...ALL_TOOLS.filter((t) => t !== "purge_events" && t !== "delete_project"), "purge_events", "delete_project"];
    for (const name of order) {
      const before = c.api.calls.length;
      const invalid = CASES[name].invalid;
      if (invalid) {
        const bad = await c.call(name, { ...invalid, ...(invalid.project_id === PID ? { project_id: p.id } : {}) });
        expect([name, bad.isError]).toEqual([name, true]);
        expect(c.api.calls.length).toBe(before);
      }
      const good = await c.call(name, { ...CASES[name].valid, ...(CASES[name].valid.project_id === PID ? { project_id: p.id } : {}) });
      expect([name, c.textOf(good)]).toEqual([name, good.isError ? "" : c.textOf(good)]);
      expect(c.api.calls.length).toBeGreaterThan(before);
    }
  });
});

describe("projects", () => {
  test("create_project returns the public key, an SDK tag and the ingest header", async () => {
    const c = await connect("editor");
    const r = await c.call("create_project", { name: "Web app", url: "https://example.com", timezone: "Europe/Madrid" });
    expect(r.isError).toBeFalsy();
    const p = r.structuredContent as Project;
    expect(p.key).toBe("web-app");
    expect(p.public_key).toMatch(/^oops_pub_/);
    expect(p.timezone).toBe("Europe/Madrid");
    expect(c.textOf(r)).toContain(`data-key="${p.public_key}"`);
    expect(c.textOf(r)).toContain("/o.js");
    expect(c.textOf(r)).toContain(`X-Project-Key: ${p.public_key}`);
    expect((await c.call("list_projects")).structuredContent).toMatchObject({ total: 1 });
  });

  test("list_projects filters with q client-side", async () => {
    const c = await connect("viewer");
    await c.project("Checkout");
    await c.project("Admin panel");
    expect((await c.call("list_projects", { q: "admin" })).structuredContent).toMatchObject({ total: 1 });
    expect((await c.call("list_projects", { q: "zzz" })).structuredContent).toMatchObject({ total: 0 });
    expect((await c.call("list_projects")).structuredContent).toMatchObject({ total: 2 });
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

  test("update_project pauses ingest and sets origins; rotate_public_key issues a new key", async () => {
    const c = await connect("editor");
    const p = await c.project();
    const up = (await c.call("update_project", { project_id: p.id, ingest_enabled: false, allowed_origins: ["example.com", "*.example.com"] })).structuredContent as Project;
    expect(up.ingest_enabled).toBe(false);
    expect(up.allowed_origins).toEqual(["example.com", "*.example.com"]);
    expect(c.textOf(await c.call("get_project", { project_id: p.id }))).toContain("ingest PAUSED");
    const bad = await c.call("update_project", { project_id: p.id, timezone: "Mars/Olympus" });
    expect(bad.isError).toBe(true);
    expect(c.textOf(bad)).toContain("invalid_timezone");

    const rot = await c.call("rotate_public_key", { project_id: p.id });
    expect(rot.isError).toBeFalsy();
    expect((rot.structuredContent as Project).public_key).not.toBe(p.public_key);
    expect(c.textOf(rot)).toContain("previous key is now invalid");
  });
});

describe("issues and events", () => {
  test("list_issues forwards every filter and summarises issues", async () => {
    const c = await connect("viewer");
    const p = await c.project();
    const { typeErr } = seed(c.api, p);

    const all = await c.call("list_issues", { project_id: p.id });
    expect(all.isError).toBeFalsy();
    expect((all.structuredContent as { total: number }).total).toBe(3);
    expect(c.textOf(all)).toContain(`#${typeErr.number} [open] error TypeError: x is not a function — init in https://app/x.js · 3 event(s) / 3 user(s)`);
    expect(c.textOf(all)).toContain("releases 1.4.1, 1.4.2");

    const r = await c.call("list_issues", { project_id: p.id, status: "all", level: "fatal", environment: "staging", release: "1.4.2", q: "heap", period: "90d", sort: "users", page: 1, per_page: 10 });
    expect(r.isError).toBeFalsy();
    const q = c.api.last!.query;
    expect(Object.fromEntries(q.entries())).toEqual({ status: "all", level: "fatal", environment: "staging", release: "1.4.2", q: "heap", period: "90d", sort: "users", page: "1", per_page: "10" });
    expect((r.structuredContent as { items: Issue[] }).items.map((i) => i.title)).toEqual(["OutOfMemory: heap exhausted"]);

    const sorted = (await c.call("list_issues", { project_id: p.id, sort: "users" })).structuredContent as { items: Issue[] };
    expect(sorted.items[0]!.user_count).toBe(3);
  });

  test("get_issue accepts #number, number string, number and uuid, and includes the latest event", async () => {
    const c = await connect("viewer");
    const p = await c.project();
    const { typeErr } = seed(c.api, p);

    for (const ref of [`#${typeErr.number}`, String(typeErr.number), typeErr.number, typeErr.id]) {
      const r = await c.call("get_issue", { project_id: p.id, issue: ref });
      expect(r.isError).toBeFalsy();
      expect(c.api.last!.path).toBe(`/projects/${p.id}/issues/${typeof ref === "string" && UUID_RE.test(ref) ? ref : typeErr.number}`);
      const i = r.structuredContent as Issue;
      expect(i.id).toBe(typeErr.id);
      expect(i.latest_event?.release).toBe("1.4.2");
    }
    const text = c.textOf(await c.call("get_issue", { project_id: p.id, issue: "#1" }));
    expect(text).toContain("Latest event:");
    expect(text).toContain("Stack (top first):");
    expect(text).toContain("* init https://app/x.js:12:4");

    const bad = await c.call("get_issue", { project_id: p.id, issue: "twelve" });
    expect(bad.isError).toBe(true);
    expect(c.textOf(bad)).toContain("invalid_issue_ref");
    expect(c.api.calls.filter((x) => x.includes("/issues/twelve"))).toHaveLength(0);

    const missing = await c.call("get_issue", { project_id: p.id, issue: 999 });
    expect(missing.isError).toBe(true);
    expect(c.textOf(missing)).toContain("not_found");
  });

  test("list_issue_events, search_events and get_event", async () => {
    const c = await connect("viewer");
    const p = await c.project();
    const { typeErr, fatal } = seed(c.api, p);

    const ev = await c.call("list_issue_events", { project_id: p.id, issue: `#${typeErr.number}`, per_page: 2 });
    expect(ev.isError).toBeFalsy();
    const page = ev.structuredContent as { items: Event[]; total: number; page: number };
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(c.textOf(ev)).toContain(`Issue #${typeErr.number}: 3 event(s) total`);
    expect(c.textOf(ev)).toContain("user=u3");

    const byIssue = (await c.call("search_events", { project_id: p.id, issue: fatal.id })).structuredContent as { items: Event[] };
    expect(byIssue.items.map((e) => e.type)).toEqual(["OutOfMemory"]);
    expect(c.api.last!.query.get("issue")).toBe(fatal.id);

    const byRef = await c.call("search_events", { project_id: p.id, issue: `#${fatal.number}`, level: "fatal", environment: "staging", release: "1.4.2", q: "heap", period: "all" });
    expect(byRef.isError).toBeFalsy();
    expect(Object.fromEntries(c.api.last!.query.entries())).toEqual({ issue: String(fatal.number), level: "fatal", environment: "staging", release: "1.4.2", q: "heap", period: "all", page: "1", per_page: "25" });
    expect((byRef.structuredContent as { total: number }).total).toBe(1);

    const eventId = page.items[0]!.id;
    const one = await c.call("get_event", { project_id: p.id, event_id: eventId });
    expect(one.isError).toBeFalsy();
    expect((one.structuredContent as Event).id).toBe(eventId);
    expect(c.textOf(one)).toContain("TypeError: x is not a function");
    const first = await c.call("get_event", { project_id: p.id, event_id: "1001" });
    expect(c.textOf(first)).toContain('Tags: {"page":"checkout"}');
    expect(c.textOf(first)).toContain("click button#pay");
  });

  test("update_issue resolves / ignores / reopens; bulk_update_issues mixes refs", async () => {
    const c = await connect("editor");
    const p = await c.project();
    const { typeErr, fatal, warn } = seed(c.api, p);

    const res = await c.call("update_issue", { project_id: p.id, issue: `#${typeErr.number}`, status: "resolved" });
    expect(res.isError).toBeFalsy();
    expect((res.structuredContent as Issue).status).toBe("resolved");
    expect(c.api.last).toMatchObject({ method: "PATCH", path: `/projects/${p.id}/issues/${typeErr.number}`, body: { status: "resolved" } });
    expect(c.textOf(res)).toStartWith("Resolved issue #");

    expect(c.textOf(await c.call("update_issue", { project_id: p.id, issue: warn.id, status: "ignored" }))).toStartWith("Ignored issue");
    expect(c.textOf(await c.call("update_issue", { project_id: p.id, issue: typeErr.number, status: "open" }))).toStartWith("Reopened issue");

    const bulk = await c.call("bulk_update_issues", { project_id: p.id, issues: [`#${typeErr.number}`, fatal.id, 999], status: "resolved" });
    expect(bulk.isError).toBeFalsy();
    expect(bulk.structuredContent).toEqual({ updated: 2, requested: 3, status: "resolved" });
    expect(c.api.last!.body).toEqual({ ids: [String(typeErr.number), fatal.id, "999"], status: "resolved" });
    expect(c.textOf(bulk)).toBe("2 of 3 issue(s) set to resolved.");

    // A resolved issue that receives a new event reopens as regressed (API behaviour, shown in summaries).
    c.api.ingest(p, { type: "TypeError", message: "x is not a function", user: { id: "u4" } });
    expect(c.textOf(await c.call("get_issue", { project_id: p.id, issue: typeErr.number }))).toContain("REGRESSED");
  });

  test("get_stats forwards range + filters and summarises; get_live counts", async () => {
    const c = await connect("viewer");
    const p = await c.project();
    seed(c.api, p);

    const st = await c.call("get_stats", { project_id: p.id, period: "7d", interval: "day", release: "1.4.2" });
    expect(st.isError).toBeFalsy();
    expect(Object.fromEntries(c.api.last!.query.entries())).toEqual({ period: "7d", interval: "day", release: "1.4.2" });
    const s = st.structuredContent as Stats;
    expect(s.totals.events).toBe(3);
    expect(s.breakdowns.type!.map((r) => r.value)).toEqual(["TypeError", "OutOfMemory"]);
    expect(c.textOf(st)).toContain("Totals: 3 events, 3 affected users");
    expect(c.textOf(st)).toContain("vs previous period: +50% events");
    expect(c.textOf(st)).toContain("Top error types: TypeError 2, OutOfMemory 1");

    const range = await c.call("get_stats", { project_id: p.id, from: "2026-10-01", to: "2026-10-15" });
    expect(range.isError).toBeFalsy();
    expect(c.api.last!.query.get("from")).toBe("2026-10-01");

    const live = await c.call("get_live", { project_id: p.id });
    expect(live.isError).toBeFalsy();
    expect(live.structuredContent).toEqual({ events: 5, window_min: 5 });
    expect(c.textOf(live)).toBe("5 event(s) in the last 5 minute(s).");
  });

  test("get_usage and get_audit_log return schema-valid structured content", async () => {
    const c = await connect("admin");
    const u = await c.call("get_usage");
    expect(u.isError).toBeFalsy();
    expect(c.textOf(u)).toContain("1234/100000 events");
    const a = await c.call("get_audit_log", { action: "issue.update", per_page: 5 });
    expect(a.isError).toBeFalsy();
    expect((a.structuredContent as { items: unknown[]; total: number }).total).toBe(1);
    expect(c.textOf(a)).toContain("issue.update by api_key:oops_live_test → issue:i-1");
    expect(c.api.last!.query.get("action")).toBe("issue.update");
    const none = await c.call("get_audit_log", { action: "events.purge" });
    expect((none.structuredContent as { total: number }).total).toBe(0);
  });
});

describe("report_error", () => {
  test("posts to /ingest with the project's public key and the agent defaults", async () => {
    const c = await connect("viewer");
    const p = await c.project("Agent");
    const r = await c.call("report_error", {
      project_id: p.id,
      type: "TimeoutError",
      message: "upstream took 30s",
      stack: "TimeoutError: upstream took 30s\n    at fetchUpstream (agent.js:10:5)",
      url: "https://agent.example/run?job=1",
      release: "2026.10.16",
      tags: { task: "nightly-sync" },
      extra: { attempt: 3 },
      user: { id: "cron" },
      fingerprint: ["nightly-sync", "timeout"],
    });
    expect(r.isError).toBeFalsy();

    const ing = c.api.lastIngest!;
    expect(ing.method).toBe("POST");
    expect(ing.path).toBe("/ingest");
    expect(ing.headers["X-Project-Key"]).toBe(p.public_key);
    expect(ing.headers["X-API-Key"]).toBeUndefined();
    expect(ing.headers["Content-Type"]).toBe("application/json");
    expect(ing.body).toEqual({
      type: "TimeoutError",
      message: "upstream took 30s",
      level: "error",
      stack: "TimeoutError: upstream took 30s\n    at fetchUpstream (agent.js:10:5)",
      url: "https://agent.example/run?job=1",
      release: "2026.10.16",
      platform: "agent",
      sdk: `oops-errors-mcp/${VERSION}`,
      tags: { task: "nightly-sync" },
      extra: { attempt: 3 },
      user: { id: "cron" },
      fingerprint: ["nightly-sync", "timeout"],
    });
    expect((ing.body as Record<string, unknown>).k).toBeUndefined();

    expect(r.structuredContent).toEqual({ ok: true, event_id: "1001", issue_id: c.api.issues.get(p.id)![0]!.id, issue_number: 1, project_id: p.id });
    expect(c.textOf(r)).toContain('Reported to "Agent": issue #1');
    expect(c.api.calls).toEqual([`GET /projects/${p.id}`, "POST /ingest"]);

    // Same fingerprint → same issue; a different platform and level are passed through.
    const again = await c.call("report_error", { project_id: p.id, message: "boom", level: "fatal", platform: "python", fingerprint: ["nightly-sync", "timeout"] });
    expect((again.structuredContent as { issue_number: number }).issue_number).toBe(1);
    expect(c.api.lastIngest!.body).toMatchObject({ message: "boom", level: "fatal", platform: "python" });
    expect(c.api.lastIngest!.body).not.toHaveProperty("type");
    expect(c.api.lastIngest!.body).not.toHaveProperty("stack");
  });

  test("requires type or message, and surfaces drop reasons without failing", async () => {
    const c = await connect("editor");
    const p = await c.project();
    const none = await c.call("report_error", { project_id: p.id, tags: { a: "b" } });
    expect(none.isError).toBe(true);
    expect(c.textOf(none)).toContain("invalid_event");
    expect(c.api.lastIngest).toBeNull();

    await c.call("update_project", { project_id: p.id, ingest_enabled: false });
    const paused = await c.call("report_error", { project_id: p.id, message: "x" });
    expect(paused.isError).toBeFalsy();
    expect(paused.structuredContent).toEqual({ ok: false, reason: "paused", project_id: p.id });
    expect(c.textOf(paused)).toContain("ingest is paused");
    await c.call("update_project", { project_id: p.id, ingest_enabled: true });

    c.api.overBudget = true;
    const limit = await c.call("report_error", { project_id: p.id, message: "x" });
    expect((limit.structuredContent as { reason: string }).reason).toBe("limit");
    expect(c.textOf(limit)).toContain("get_usage");
  });

  test("a viewer can report but the API decides what it can see", async () => {
    const admin = await connect("admin");
    const p = await admin.project();
    const viewer = await connect("viewer", { api: Object.assign(admin.api, { role: "viewer" as Role }) });
    const r = await viewer.call("report_error", { project_id: p.id, type: "Oops" });
    expect(r.isError).toBeFalsy();
    expect((r.structuredContent as { ok: boolean }).ok).toBe(true);
  });
});

describe("destructive tools require human approval", () => {
  test("delete_project refuses without confirmation and succeeds with confirm=true", async () => {
    const c = await connect("admin");
    const p = await c.project();
    seed(c.api, p);

    const refused = await c.call("delete_project", { project_id: p.id });
    expect(refused.isError).toBe(true);
    expect(c.textOf(refused)).toContain("confirmation_required");
    expect(c.textOf(refused)).toContain("Web app");
    expect(c.textOf(refused)).toContain("3 open issue(s) and 5 event(s)");
    expect(c.api.projects.has(p.id)).toBe(true);
    expect(c.audit.entries.at(-1)?.outcome).toBe("pending");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);

    const done = await c.call("delete_project", { project_id: p.id, confirm: true });
    expect(done.isError).toBeFalsy();
    expect(done.structuredContent).toEqual({ deleted: true, id: p.id, key: "web-app", name: "Web app" });
    expect(c.api.projects.has(p.id)).toBe(false);
    expect(c.audit.entries.at(-1)?.outcome).toBe("ok");
  });

  test("purge_events follows the same flow and reports events + issues", async () => {
    const c = await connect("admin");
    const p = await c.project();
    seed(c.api, p);
    const refused = await c.call("purge_events", { project_id: p.id });
    expect(refused.isError).toBe(true);
    expect(c.textOf(refused)).toContain("confirmation_required");
    expect(c.api.calls.filter((x) => x.startsWith("DELETE"))).toHaveLength(0);
    const done = await c.call("purge_events", { project_id: p.id, confirm: true });
    expect(done.isError).toBeFalsy();
    expect(done.structuredContent).toEqual({ deleted_events: 5, deleted_issues: 3, project_id: p.id });
    expect(c.textOf(done)).toBe('Deleted 5 event(s) and 3 issue(s) of "Web app".');
    expect(c.api.events.get(p.id)).toEqual([]);
    expect(c.api.projects.has(p.id)).toBe(true);
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
    seed(c.api, p);
    const done = await c.call("purge_events", { project_id: p.id });
    expect(done.isError).toBeFalsy();
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain("Purge ALL events and issues");
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
    const viewer = await connect("viewer");
    const p = await viewer.project();
    seed(viewer.api, p);
    const res = await viewer.mcp.listResources();
    expect(res.resources.map((r) => r.uri)).toContain("oops://projects");
    const tpl = await viewer.mcp.listResourceTemplates();
    expect(tpl.resourceTemplates.map((t) => t.uriTemplate)).toContain("oops://projects/{id}/summary");
    const list = await viewer.mcp.readResource({ uri: "oops://projects" });
    expect(JSON.parse((list.contents[0] as { text: string }).text).items).toHaveLength(1);
    const summary = await viewer.mcp.readResource({ uri: `oops://projects/${p.id}/summary` });
    expect(JSON.parse((summary.contents[0] as { text: string }).text)).toMatchObject({ open_issues: 3, events_30d: 5, users_30d: 4 });
  });

  test("triage prompt is available when issues:read is granted and takes project + period", async () => {
    const { mcp } = await connect("viewer");
    const prompts = await mcp.listPrompts();
    const triage = prompts.prompts.find((p) => p.name === "triage");
    expect(triage).toBeDefined();
    expect(triage!.arguments!.map((a) => [a.name, a.required])).toEqual([["project", true], ["period", false]]);

    const got = await mcp.getPrompt({ name: "triage", arguments: { project: "checkout", period: "30d" } });
    const text = (got.messages[0]!.content as { text: string }).text;
    expect(text).toContain('project "checkout"');
    expect(text).toContain('period="30d"');
    expect(text).toContain("list_issues");
    expect(text).toContain("get_stats");
    expect(text).toContain("REGRESSED");

    const dflt = (await mcp.getPrompt({ name: "triage", arguments: { project: "p-1" } })).messages[0]!.content as { text: string };
    expect(dflt.text).toContain("last 7d");
  });
});

describe("audit trail", () => {
  test("every tool call is logged with tool, outcome and compact args", async () => {
    const c = await connect("admin");
    const p = await c.project();
    await c.call("report_error", { project_id: p.id, message: "x".repeat(300) });
    const entry = c.audit.entries.at(-1)!;
    expect(entry).toMatchObject({ event: "tool.call", transport: "test", tool: "report_error", outcome: "ok", actor: { account: "acc-1", prefix: "oops_live_test", role: "admin" } });
    expect((entry.args!.message as string).length).toBe(201);
    expect(entry.duration_ms).toBeGreaterThanOrEqual(0);
  });
});
