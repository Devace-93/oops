import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  call,
  createApiKey,
  createProject,
  getIssue,
  ingestOk,
  listEvents,
  listIssueEvents,
  listIssues,
  patchIssue,
  registerAccount,
  stats,
  summary,
  type Project,
} from "../helpers";

/**
 * Issues: list filters, sorting and paging, the status lifecycle
 * (resolve → regression reopens, ignored stays ignored, bulk), stats and
 * summary, RBAC with API keys (viewer denied + audited) and purge.
 */
async function seed(request: APIRequestContext, project: Project) {
  // A: 3 events, 3 users. B: warning on staging. C: fatal on release 2.0.0, 2 events, anonymous.
  const a1 = await ingestOk(request, project.public_key, { type: "TypeError", message: "alpha failed", environment: "production", user: { id: "u1" } });
  await ingestOk(request, project.public_key, { type: "TypeError", message: "alpha failed", environment: "production", user: { id: "u2" } });
  await ingestOk(request, project.public_key, { type: "TypeError", message: "alpha failed", environment: "production", user: { id: "u3" } });
  const b1 = await ingestOk(request, project.public_key, { type: "ReferenceError", message: "beta missing", level: "warning", environment: "staging" });
  const c1 = await ingestOk(request, project.public_key, { type: "Error", message: "gamma exploded", level: "fatal", environment: "production", release: "2.0.0" });
  await ingestOk(request, project.public_key, { type: "Error", message: "gamma exploded", level: "fatal", environment: "production", release: "2.0.0" });
  return { A: a1.issue_id, B: b1.issue_id, C: c1.issue_id };
}

test.describe("issues API", () => {
  test("@critical filters, sort, paging, resolve → regression reopens, ignored stays ignored, bulk", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const { A, B, C } = await seed(request, project);
    const ids = (page: { items: { id: string }[] }) => page.items.map((i) => i.id);

    const all = await listIssues(request, account, project.id);
    expect(all.total).toBe(3);
    expect(all.page).toBe(1);
    expect(all.items.every((i) => i.status === "open")).toBe(true);
    // Default sort: last_seen desc → C (most recent) first, A last.
    expect(ids(all)).toEqual([C, B, A]);

    expect(ids(await listIssues(request, account, project.id, { level: "warning" }))).toEqual([B]);
    expect(ids(await listIssues(request, account, project.id, { level: "fatal" }))).toEqual([C]);
    expect(ids(await listIssues(request, account, project.id, { environment: "staging" }))).toEqual([B]);
    expect(ids(await listIssues(request, account, project.id, { environment: "production" })).sort()).toEqual([A, C].sort());
    expect(ids(await listIssues(request, account, project.id, { release: "2.0.0" }))).toEqual([C]);
    expect(ids(await listIssues(request, account, project.id, { q: "gamma" }))).toEqual([C]);
    expect(ids(await listIssues(request, account, project.id, { q: "ReferenceError" }))).toEqual([B]);
    expect(ids(await listIssues(request, account, project.id, { q: "nothing-matches-this" }))).toEqual([]);

    expect(ids(await listIssues(request, account, project.id, { sort: "events" }))[0]).toBe(A);
    expect(ids(await listIssues(request, account, project.id, { sort: "users" }))[0]).toBe(A);
    expect(ids(await listIssues(request, account, project.id, { sort: "first_seen" }))).toEqual([C, B, A]);

    const page1 = await listIssues(request, account, project.id, { per_page: "2", page: "1" });
    expect(page1.items).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.per_page).toBe(2);
    const page2 = await listIssues(request, account, project.id, { per_page: "2", page: "2" });
    expect(page2.items).toHaveLength(1);
    expect(page2.page).toBe(2);
    expect([...ids(page1), ...ids(page2)]).toEqual([C, B, A]);

    // Resolve A.
    const resolved = await patchIssue(request, account, project.id, A, "resolved");
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolved_at).toBeTruthy();
    expect(resolved.regressed_at ?? null).toBeNull();
    expect((await listIssues(request, account, project.id)).total).toBe(2);
    expect(ids(await listIssues(request, account, project.id, { status: "resolved" }))).toEqual([A]);
    expect((await listIssues(request, account, project.id, { status: "all" })).total).toBe(3);

    // A new event reopens it and marks the regression.
    const again = await ingestOk(request, project.public_key, { type: "TypeError", message: "alpha failed", environment: "production", user: { id: "u4" } });
    expect(again.issue_id).toBe(A);
    const regressed = await getIssue(request, account, project.id, A);
    expect(regressed.status).toBe("open");
    expect(regressed.resolved_at ?? null).toBeNull();
    expect(regressed.regressed_at).toBeTruthy();
    expect(regressed.event_count).toBe(4);
    expect(regressed.user_count).toBe(4);
    expect(ids(await listIssues(request, account, project.id))).toContain(A);

    // Ignore B: new events still count but it stays ignored.
    expect((await patchIssue(request, account, project.id, B, "ignored")).status).toBe("ignored");
    await ingestOk(request, project.public_key, { type: "ReferenceError", message: "beta missing", level: "warning", environment: "staging" });
    const ignored = await getIssue(request, account, project.id, B);
    expect(ignored.status).toBe("ignored");
    expect(ignored.event_count).toBe(2);
    expect(ids(await listIssues(request, account, project.id, { status: "ignored" }))).toEqual([B]);
    expect(ids(await listIssues(request, account, project.id))).not.toContain(B);

    // Reopen explicitly.
    expect((await patchIssue(request, account, project.id, B, "open")).status).toBe("open");

    // Bulk.
    const bulk = await call(request, "post", `/projects/${project.id}/issues/bulk`, account, { data: { ids: [A, B, C], status: "resolved" } });
    expect(bulk.status, JSON.stringify(bulk.body)).toBe(200);
    expect(bulk.body.updated).toBe(3);
    expect((await listIssues(request, account, project.id)).total).toBe(0);
    expect((await listIssues(request, account, project.id, { status: "resolved" })).total).toBe(3);

    // Unknown issue → 404.
    expect((await call(request, "get", `/projects/${project.id}/issues/999999`, account)).status).toBe(404);
  });

  test("events, stats, summary and live reflect what was ingested", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account, { timezone: "Europe/Madrid" });
    const { A, C } = await seed(request, project);

    const events = await listEvents(request, account, project.id);
    expect(events.total).toBe(6);
    // Newest first.
    expect(events.items[0]!.issue_id).toBe(C);
    expect(events.items[5]!.issue_id).toBe(A);
    expect((await listEvents(request, account, project.id, { level: "warning" })).total).toBe(1);
    expect((await listEvents(request, account, project.id, { environment: "staging" })).total).toBe(1);
    expect((await listEvents(request, account, project.id, { release: "2.0.0" })).total).toBe(2);
    expect((await listEvents(request, account, project.id, { q: "gamma" })).total).toBe(2);
    expect((await listEvents(request, account, project.id, { issue: A })).total).toBe(3);
    const perIssue = await listIssueEvents(request, account, project.id, A);
    expect(perIssue.total).toBe(3);
    expect(perIssue.items.map((e) => e.user!.id)).toEqual(["u3", "u2", "u1"]);
    const one = await call(request, "get", `/projects/${project.id}/events/${perIssue.items[0]!.id}`, account);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(perIssue.items[0]!.id);
    expect(one.body.issue_number).toBe(1);

    const s = await stats(request, account, project.id);
    expect(s.range.tz).toBe("Europe/Madrid");
    expect(s.range.interval).toBeTruthy();
    expect(s.totals.events).toBe(6);
    expect(s.totals.users).toBe(4); // u1, u2, u3 + one anonymous (same IP + UA)
    expect(s.totals.issues_new).toBe(3);
    expect(s.totals.issues_open).toBe(3);
    expect(s.previous.events).toBe(0);
    expect(s.series.length).toBeGreaterThanOrEqual(1);
    expect(s.series.reduce((n: number, p: any) => n + p.events, 0)).toBe(6);
    const by = (name: string) => Object.fromEntries(s.breakdowns[name].map((r: any) => [r.value, r.events]));
    expect(by("level")).toEqual({ error: 3, warning: 1, fatal: 2 });
    expect(by("environment")).toEqual({ production: 5, staging: 1 });
    expect(by("release")["2.0.0"]).toBe(2);
    expect(by("type")).toEqual({ TypeError: 3, ReferenceError: 1, Error: 2 });
    expect(s.breakdowns.browser[0].value).toBe("Chrome");
    expect(s.breakdowns.device[0].value).toBe("desktop");
    expect(s.breakdowns.os.length).toBeGreaterThanOrEqual(1);

    const warnings = await stats(request, account, project.id, { level: "warning" });
    expect(warnings.totals.events).toBe(1);
    const staging = await stats(request, account, project.id, { environment: "staging", period: "24h" });
    expect(staging.totals.events).toBe(1);
    const hourly = await stats(request, account, project.id, { period: "today", interval: "hour" });
    expect(hourly.range.interval).toBe("hour");
    expect(hourly.totals.events).toBe(6);

    const sum = await summary(request, account, project.id);
    expect(sum).toMatchObject({ open_issues: 3, events_24h: 6, events_30d: 6, users_30d: 4 });
    expect(sum.last_event_at).toBeTruthy();

    const live = await call(request, "get", `/projects/${project.id}/live`, account);
    expect(live.status).toBe(200);
    expect(live.body.events).toBe(6);
    expect(typeof live.body.window_min).toBe("number");
  });

  test("RBAC: viewer reads but cannot triage (403 + audit), editor can, admin purges", async ({ request }) => {
    const account = await registerAccount(request);
    const project = await createProject(request, account);
    const { A } = await seed(request, project);
    const viewer = { apiKey: (await createApiKey(request, account, "viewer")).secret };
    const editor = { apiKey: (await createApiKey(request, account, "editor")).secret };
    const admin = { apiKey: (await createApiKey(request, account, "admin")).secret };

    // Viewer: reads fine.
    expect((await listIssues(request, viewer, project.id)).total).toBe(3);
    expect((await getIssue(request, viewer, project.id, A)).id).toBe(A);
    expect((await stats(request, viewer, project.id)).totals.events).toBe(6);

    // Viewer: writes denied with the scope named, and audited.
    const denied = await call(request, "patch", `/projects/${project.id}/issues/${A}`, viewer, { data: { status: "resolved" } });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toMatchObject({ code: "insufficient_scope", required_scope: "issues:write", role: "viewer" });
    const deniedBulk = await call(request, "post", `/projects/${project.id}/issues/bulk`, viewer, { data: { ids: [A], status: "resolved" } });
    expect(deniedBulk.status).toBe(403);
    const deniedPurge = await call(request, "delete", `/projects/${project.id}/events`, viewer);
    expect(deniedPurge.status).toBe(403);
    expect(deniedPurge.body.error.required_scope).toBe("events:delete");
    expect((await getIssue(request, account, project.id, A)).status).toBe("open");

    const audit = await call(request, "get", "/account/audit", admin, { query: { action: "auth.denied" } });
    expect(audit.status, JSON.stringify(audit.body)).toBe(200);
    expect(audit.body.total).toBeGreaterThanOrEqual(3);
    expect(audit.body.items.every((e: any) => e.action === "auth.denied")).toBe(true);
    // Viewers cannot read the audit log either.
    expect((await call(request, "get", "/account/audit", viewer)).status).toBe(403);

    // Editor: can triage, cannot purge.
    expect((await patchIssue(request, editor, project.id, A, "resolved")).status).toBe("resolved");
    const auditUpdate = await call(request, "get", "/account/audit", admin, { query: { action: "issue.update" } });
    expect(auditUpdate.body.total).toBeGreaterThanOrEqual(1);
    expect((await call(request, "delete", `/projects/${project.id}/events`, editor)).status).toBe(403);

    // Admin: purge empties issues and events.
    const purge = await call(request, "delete", `/projects/${project.id}/events`, admin);
    expect(purge.status, JSON.stringify(purge.body)).toBe(200);
    expect(purge.body).toEqual({ deleted_events: 6, deleted_issues: 3 });
    expect((await listIssues(request, account, project.id, { status: "all" })).total).toBe(0);
    expect((await listEvents(request, account, project.id)).total).toBe(0);
    expect((await summary(request, account, project.id)).open_issues).toBe(0);
    const purgeAudit = await call(request, "get", "/account/audit", account, { query: { action: "events.purge" } });
    expect(purgeAudit.body.total).toBeGreaterThanOrEqual(1);

    // The key metadata never leaks the secret.
    const keys = await call(request, "get", "/apikeys", account);
    expect(keys.status).toBe(200);
    expect(JSON.stringify(keys.body)).not.toContain(admin.apiKey);
    expect(keys.body.items.map((k: any) => k.role).sort()).toEqual(["admin", "editor", "viewer"]);
  });
});
