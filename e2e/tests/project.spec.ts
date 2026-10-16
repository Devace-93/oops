import { test, expect } from "@playwright/test";
import {
  call,
  createProject,
  getProject,
  ingest,
  ingestOk,
  listEvents,
  listIssues,
  patchProject,
  registerAccount,
  summary,
  uniqueName,
} from "../helpers";

/**
 * Project lifecycle through the API: create → read → settings → rotate the
 * public key (old one dies at once) → delete (cascades issues and events).
 */
test.describe("projects", () => {
  test("@critical create, update settings, rotate the key, old key is 401, delete cascades", async ({ request }) => {
    const account = await registerAccount(request);
    const name = uniqueName("E2E Shop");
    const project = await createProject(request, account, {
      name,
      url: "https://shop.example",
      description: "Checkout front-end",
      timezone: "Europe/Madrid",
      allowed_origins: ["shop.example"],
    });
    expect(project.name).toBe(name);
    expect(project.key).toMatch(/^[a-z0-9-]{1,63}$/);
    expect(project.public_key).toMatch(/^oops_pub_/);
    expect(project.public_key.startsWith(project.public_key_prefix)).toBe(true);
    expect(project.timezone).toBe("Europe/Madrid");
    expect(project.allowed_origins).toEqual(["shop.example"]);
    expect(project.ingest_enabled).toBe(true);
    expect(project.store_ip).toBe(false);
    expect(project.counts.open_issues).toBe(0);
    expect(project.counts.events_24h).toBe(0);

    // Listed newest first, readable by id.
    const list = await call(request, "get", "/projects", account);
    expect(list.status).toBe(200);
    expect(list.body.items[0].id).toBe(project.id);
    expect((await getProject(request, account, project.id)).public_key).toBe(project.public_key);

    // Settings.
    const patched = await patchProject(request, account, project.id, {
      name: `${name} v2`,
      description: "Renamed",
      allowed_origins: [],
      timezone: "UTC",
      ingest_enabled: false,
    });
    expect(patched.name).toBe(`${name} v2`);
    expect(patched.description).toBe("Renamed");
    expect(patched.allowed_origins).toEqual([]);
    expect(patched.timezone).toBe("UTC");
    expect(patched.ingest_enabled).toBe(false);
    const paused = await ingest(request, project.public_key, { type: "Error", message: "while paused" });
    expect(paused.status).toBe(202);
    expect(paused.body).toEqual({ ok: false, reason: "paused" });
    await patchProject(request, account, project.id, { ingest_enabled: true });

    // One event shows up in the counts.
    const first = await ingestOk(request, project.public_key, { type: "TypeError", message: "checkout exploded", url: "https://shop.example/pay" });
    expect(first.issue_number).toBe(1);
    const afterOne = await getProject(request, account, project.id);
    expect(afterOne.counts.open_issues).toBe(1);
    expect(afterOne.counts.events_24h).toBe(1);
    expect(afterOne.counts.events_30d).toBe(1);
    expect(afterOne.counts.last_event_at).toBeTruthy();
    const sum = await summary(request, account, project.id);
    expect(sum.open_issues).toBe(1);
    expect(sum.events_24h).toBe(1);

    // Rotate: the old key stops at once, the new one works, data is kept.
    const rotated = await call(request, "post", `/projects/${project.id}/rotate-key`, account);
    expect(rotated.status, JSON.stringify(rotated.body)).toBe(200);
    const newKey: string = rotated.body.public_key;
    expect(newKey).toMatch(/^oops_pub_/);
    expect(newKey).not.toBe(project.public_key);
    expect(rotated.body.public_key_prefix).not.toBe(project.public_key_prefix);
    const old = await ingest(request, project.public_key, { type: "Error", message: "old key" });
    expect(old.status).toBe(401);
    expect((old.body as any).error.code).toBe("invalid_project_key");
    await ingestOk(request, newKey, { type: "TypeError", message: "checkout exploded" });
    expect((await listIssues(request, account, project.id)).total).toBe(1);
    expect((await listEvents(request, account, project.id)).total).toBe(2);

    // store_ip keeps the raw address on new events only.
    await patchProject(request, account, project.id, { store_ip: true });
    const withIp = await ingestOk(request, newKey, { type: "Error", message: "with ip" });
    const rows = (await listEvents(request, account, project.id)).items;
    expect(rows.find((e) => e.id === withIp.event_id)!.ip).toMatch(/^[0-9a-f.:]+$/);
    expect(rows.find((e) => e.id === first.event_id)!.ip ?? null).toBeNull();

    // Delete cascades; the key is gone too.
    const del = await call(request, "delete", `/projects/${project.id}`, account);
    expect(del.status).toBe(204);
    expect((await call(request, "get", `/projects/${project.id}`, account)).status).toBe(404);
    expect((await ingest(request, newKey, { type: "Error", message: "after delete" })).status).toBe(401);
  });

  test("an explicit key slug is honoured; a project of another account is a 404, never a 403", async ({ request }) => {
    const owner = await registerAccount(request);
    const other = await registerAccount(request);
    const slug = `custom-${Date.now().toString(36)}`;
    const project = await createProject(request, owner, { key: slug });
    expect(project.key).toBe(slug);

    expect((await call(request, "get", `/projects/${project.id}`, other)).status).toBe(404);
    expect((await call(request, "get", `/projects/${project.id}/issues`, other)).status).toBe(404);
    expect((await call(request, "get", `/projects/${project.id}/stats`, other)).status).toBe(404);
    expect((await call(request, "patch", `/projects/${project.id}`, other, { data: { name: "x" } })).status).toBe(404);
    expect((await call(request, "delete", `/projects/${project.id}`, other)).status).toBe(404);
    // Still there for the owner.
    expect((await getProject(request, owner, project.id)).id).toBe(project.id);
  });
});
