import { component$, useContext } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { PricingTable } from "../../../../components/pricing-table";
import { FeaturesContext } from "../../../../lib/features";
import { PLANS, fmtLimit } from "../../../../lib/plans";
import { tr, useI18n } from "../../../../i18n";
import type { CatalogKey } from "../../../../i18n/catalog/en";

const APP_URL = (import.meta.env.VITE_APP_URL || "https://oops.3m4.net").replace(/\/$/, "");
const CONTRACT_URL = "https://github.com/Devace-93/oops/blob/main/CONTRACT.md";
const MCP_SNIPPET = "claude mcp add oops --scope user --env OOPS_API_KEY=oops_live_… -- npx -y oops-errors-mcp";
const MCP_REMOTE_SNIPPET = `claude mcp add --transport http oops ${APP_URL}/mcp --header "Authorization: Bearer oops_live_…"`;

const SCRIPT_TAG = `<script defer src="${APP_URL}/o.js" data-key="oops_pub_…"></script>`;
const SCRIPT_ATTRS = `<script defer src="${APP_URL}/o.js" data-key="oops_pub_…"
        data-env="production" data-release="1.4.2"
        data-console="false" data-local="false" data-sample="1"
        data-user='{"id": "u_42"}'></script>`;
const SDK_JS = `// report a caught error, with context
oops.capture(err, { level: "error", tags: { page: "checkout" }, extra: { cart: 3 }, fingerprint: ["checkout", "pay-failed"] });

// a plain message (info by default)
oops.message("Payment retried", "warning", { tags: { gateway: "stripe" } });

// who is affected (hashed per project; counted once per issue)
oops.setUser({ id: "u_42", email: "ada@example.com" });   // or null to forget

// tags and context merged into every later event
oops.setTag("plan", "pro");
oops.setTags({ ab: "variant-b" });
oops.setContext("cart", { items: 3, total: 42 });

// your own breadcrumbs (clicks, navigation, failed requests are automatic)
oops.breadcrumb({ category: "cart", message: "coupon applied", data: { code: "SPRING" } });

// queue calls before the script has loaded
window.oops = { q: [["setUser", { id: "u_42" }]] };`;
const INGEST = `curl -X POST ${APP_URL}/api/ingest \\
  -H "X-Project-Key: oops_pub_…" -H "Content-Type: application/json" \\
  -d '{
    "type": "TypeError", "message": "x is not a function", "level": "error",
    "stack": "TypeError: x is not a function\\n    at init (https://app/x.js:12:4)",
    "url": "https://app.example/checkout?x=1",
    "release": "1.4.2", "environment": "production", "platform": "javascript",
    "user": { "id": "u_42" }, "tags": { "page": "checkout" }, "extra": { "cart": 3 },
    "breadcrumbs": [{ "ts": "2026-10-16T10:00:00Z", "category": "click", "message": "button#pay" }],
    "fingerprint": ["checkout", "pay-failed"],
    "ts": "2026-10-16T10:00:01Z"
  }'`;
const INGEST_RESPONSE = `202 { "ok": true, "event_id": "9021", "issue_id": "…", "issue_number": 12 }
202 { "ok": false, "reason": "paused" | "origin" | "limit" }
400 { "error": { "code": "invalid_event", "message": "…" } }
401 { "error": { "code": "invalid_project_key", "message": "…" } }`;
const BATCH = `POST ${APP_URL}/api/ingest/batch
{ "events": [ { … }, { … } ] }           # ≤ 20 events → { "ok": true, "results": [ … ] }`;
const CURL_ISSUES = `curl "${APP_URL}/api/projects/$PROJECT/issues?status=open&period=7d&sort=users" \\
  -H "X-API-Key: oops_live_…"`;
const CURL_RESOLVE = `curl -X PATCH "${APP_URL}/api/projects/$PROJECT/issues/12" \\
  -H "X-API-Key: oops_live_…" -H "Content-Type: application/json" \\
  -d '{"status": "resolved"}'`;
const CURL_STATS = `curl "${APP_URL}/api/projects/$PROJECT/stats?period=7d&environment=production" \\
  -H "X-API-Key: oops_live_…"`;

interface Endpoint {
  method: string;
  path: string;
  scope: string;
  notes?: string;
}

const SECTIONS: { title: CatalogKey; body: CatalogKey; endpoints: Endpoint[]; snippet?: string }[] = [
  {
    title: "docs.projectsTitle",
    body: "docs.projectsBodyErrors",
    endpoints: [
      { method: "GET", path: "/projects", scope: "projects:read", notes: "with open issues, events 24h / 30d, users 30d" },
      { method: "POST", path: "/projects", scope: "projects:write", notes: "{name, key?, description?, url?, allowed_origins?, timezone?} → 201 · 402 limit_reached" },
      { method: "GET", path: "/projects/:id", scope: "projects:read" },
      { method: "PATCH", path: "/projects/:id", scope: "projects:write", notes: "name, description, url, timezone, allowed_origins, ingest_enabled, store_ip" },
      { method: "DELETE", path: "/projects/:id", scope: "projects:delete", notes: "cascades issues and events" },
      { method: "POST", path: "/projects/:id/rotate-key", scope: "projects:write", notes: "old public key stops immediately" },
      { method: "GET", path: "/projects/:id/summary", scope: "projects:read", notes: "open_issues, events_24h, events_30d, users_30d, last_event_at" },
      { method: "DELETE", path: "/projects/:id/events", scope: "events:delete", notes: "purge every event and issue" },
    ],
    snippet: `curl -X POST ${APP_URL}/api/projects \\
  -H "X-API-Key: oops_live_…" -H "Content-Type: application/json" \\
  -d '{"name": "My app", "url": "https://myapp.example.com", "timezone": "Europe/Madrid"}'`,
  },
  {
    title: "docs.issuesTitle",
    body: "docs.issuesBody",
    endpoints: [
      { method: "GET", path: "/projects/:id/issues?status=&level=&environment=&release=&q=&period=&sort=&page=", scope: "issues:read", notes: "status open (default) | resolved | ignored | all · period 24h | 7d | 30d (default) | 90d | all · sort last_seen | first_seen | events | users" },
      { method: "GET", path: "/projects/:id/issues/:issue", scope: "issues:read", notes: "uuid or #number · includes latest_event" },
      { method: "PATCH", path: "/projects/:id/issues/:issue", scope: "issues:write", notes: "{status: open | resolved | ignored}" },
      { method: "POST", path: "/projects/:id/issues/bulk", scope: "issues:write", notes: "{ids: [≤ 100], status} → {updated}" },
      { method: "GET", path: "/projects/:id/issues/:issue/events?page=", scope: "issues:read", notes: "occurrences, newest first" },
      { method: "GET", path: "/projects/:id/events?level=&environment=&release=&q=&issue=&period=&page=", scope: "issues:read", notes: "raw events across the project" },
      { method: "GET", path: "/projects/:id/events/:event_id", scope: "issues:read" },
    ],
    snippet: `${CURL_ISSUES}\n\n${CURL_RESOLVE}`,
  },
  {
    title: "docs.statsTitle",
    body: "docs.statsBodyErrors",
    endpoints: [
      { method: "GET", path: "/projects/:id/stats?period=&from=&to=&interval=&level=&environment=&release=", scope: "issues:read", notes: "totals + previous period, series, top-10 breakdowns by level · environment · release · browser · os · device · type" },
      { method: "GET", path: "/projects/:id/live", scope: "issues:read", notes: "events in the last few minutes" },
      { method: "GET", path: "/account/usage", scope: "usage:read", notes: "events this month, dropped, counts, limits" },
      { method: "GET", path: "/account/audit?action=&actor_type=&outcome=&since=&page=", scope: "audit:read" },
    ],
    snippet: CURL_STATS,
  },
];

const MCP_TOOLS: { tool: string; scope: string }[] = [
  { tool: "list_projects, get_project", scope: "projects:read" },
  { tool: "create_project, update_project, rotate_public_key", scope: "projects:write" },
  { tool: "delete_project (confirm)", scope: "projects:delete" },
  { tool: "list_issues, get_issue, list_issue_events, get_event, search_events", scope: "issues:read" },
  { tool: "update_issue, bulk_update_issues", scope: "issues:write" },
  { tool: "get_stats, get_live", scope: "issues:read" },
  { tool: "purge_events (confirm)", scope: "events:delete" },
  { tool: "get_usage", scope: "usage:read" },
  { tool: "get_audit_log", scope: "audit:read" },
  { tool: "report_error", scope: "projects:read" },
];

const METHOD_CLASS: Record<string, string> = {
  GET: "bg-green-100 text-green-800",
  POST: "bg-primary-100 text-primary-800",
  PUT: "bg-amber-100 text-amber-800",
  PATCH: "bg-amber-100 text-amber-800",
  DELETE: "bg-red-100 text-red-800",
};

const EndpointTable = component$<{ endpoints: Endpoint[] }>(({ endpoints }) => {
  const i18n = useI18n();
  return (
    <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
      <table class="w-full text-left text-sm">
        <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2">{tr(i18n, "docs.colMethod")}</th>
            <th class="px-3 py-2">{tr(i18n, "docs.colPath")}</th>
            <th class="px-3 py-2">{tr(i18n, "docs.colScope")}</th>
            <th class="px-3 py-2">{tr(i18n, "docs.colNotes")}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          {endpoints.map((e) => (
            <tr key={e.method + e.path}>
              <td class="px-3 py-2">
                <span class={["badge font-mono", METHOD_CLASS[e.method] ?? "bg-slate-100 text-slate-700"]}>{e.method}</span>
              </td>
              <td class="px-3 py-2 font-mono text-xs text-slate-800">{e.path}</td>
              <td class="px-3 py-2 font-mono text-xs text-slate-500">{e.scope}</td>
              <td class="px-3 py-2 text-xs text-slate-600">{e.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

const Code = component$<{ code: string }>(({ code }) => (
  <pre class="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs leading-relaxed"><code>{code}</code></pre>
));

/**
 * Catch-all info section: /info/pricing, /info/docs and a generic placeholder
 * for any other slug (terms, privacy, …).
 */
export default component$(() => {
  const loc = useLocation();
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const slug = (loc.params.slug || "").replace(/\/$/, "");

  if (slug === "pricing") {
    const early = features["early-access"];
    return (
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="text-center">
          <h1 class="text-4xl font-bold text-slate-900">{early ? tr(i18n, "pricing.titlePlanned") : tr(i18n, "pricing.title")}</h1>
          <p class="mx-auto mt-3 max-w-2xl text-slate-600">{early ? tr(i18n, "pricing.introPlanned") : tr(i18n, "pricing.introErrors")}</p>
        </div>

        {early && (
          <div class="mx-auto mt-8 max-w-3xl rounded-xl border border-primary-200 bg-primary-50 p-6 text-center" data-testid="early-access-pricing">
            <p class="text-lg font-semibold text-primary-900">{tr(i18n, "pricing.earlyTitle")}</p>
            <p class="mt-2 text-sm text-primary-900/80">{tr(i18n, "pricing.earlyBodyErrors")}</p>
            <Link href="/blog/what-paid-plans-will-include" class="btn-primary mt-4">{tr(i18n, "pricing.earlyCta")}</Link>
          </div>
        )}

        <div class="mt-12">
          <PricingTable />
        </div>

        <div class="mt-10 card bg-primary-50 p-6 text-center">
          <h2 class="text-lg font-semibold text-slate-900">{tr(i18n, "pricing.enterpriseTitle")}</h2>
          <p class="mt-1 text-sm text-slate-600">{tr(i18n, "pricing.enterpriseBody")}</p>
          <a href="mailto:enrique@3m4.net?subject=oops%20Enterprise" class="btn-primary mt-4">{tr(i18n, "pricing.contactUs")}</a>
        </div>

        <p class="mt-8 text-center text-sm text-slate-500">
          {tr(i18n, "pricing.footnoteErrors")}
          {early && ` ${tr(i18n, "pricing.footnoteEarly")}`}
        </p>
      </div>
    );
  }

  if (slug === "docs") {
    return (
      <div class="mx-auto max-w-4xl px-4 py-16">
        <h1 class="text-3xl font-bold text-slate-900">{tr(i18n, "docs.title")}</h1>
        <p class="mt-2 text-slate-600">{tr(i18n, "docs.introErrors")}</p>
        <a href={CONTRACT_URL} target="_blank" rel="noreferrer" class="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline">
          {tr(i18n, "docs.fullContract")} →
        </a>

        {/* Browser SDK */}
        <section class="mt-8 card p-6" id="sdk">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.sdkTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.sdkBody")}</p>
          <Code code={SCRIPT_TAG} />
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.sdkAttrsTitle")}</h3>
          <Code code={SCRIPT_ATTRS} />
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li><code>data-key</code> — {tr(i18n, "docs.attrKey")}</li>
            <li><code>data-env</code> / <code>data-release</code> — {tr(i18n, "docs.attrEnvRelease")}</li>
            <li><code>data-console</code> — {tr(i18n, "docs.attrConsole")}</li>
            <li><code>data-local</code> — {tr(i18n, "docs.attrLocalErrors")}</li>
            <li><code>data-sample</code> — {tr(i18n, "docs.attrSample")}</li>
            <li><code>data-user</code> — {tr(i18n, "docs.attrUser")}</li>
            <li><code>data-api</code> — {tr(i18n, "docs.attrApiErrors")}</li>
          </ul>
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.sdkJsTitle")}</h3>
          <p class="mt-1 text-sm text-slate-600">{tr(i18n, "docs.sdkJsBody")}</p>
          <Code code={SDK_JS} />
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.sdkWhat")}</p>
        </section>

        {/* Ingest API */}
        <section class="mt-8 card p-6" id="ingest">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.ingestTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.ingestBody")}</p>
          <Code code={INGEST} />
          <ul class="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{tr(i18n, "docs.ingestField1")}</li>
            <li>{tr(i18n, "docs.ingestField2")}</li>
            <li>{tr(i18n, "docs.ingestField3")}</li>
            <li>{tr(i18n, "docs.ingestField4")}</li>
            <li>{tr(i18n, "docs.ingestField5")}</li>
            <li>{tr(i18n, "docs.ingestField6")}</li>
          </ul>
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.ingestResponsesTitle")}</h3>
          <p class="mt-1 text-sm text-slate-600">{tr(i18n, "docs.ingestResponses")}</p>
          <Code code={INGEST_RESPONSE} />
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.ingestBatchTitle")}</h3>
          <Code code={BATCH} />
        </section>

        {/* Grouping */}
        <section class="mt-8 card p-6" id="grouping">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.groupingTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.groupingBody")}</p>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{tr(i18n, "docs.groupingRule1")}</li>
            <li>{tr(i18n, "docs.groupingRule2")}</li>
            <li>{tr(i18n, "docs.groupingRule3")}</li>
            <li>{tr(i18n, "docs.groupingRule4")}</li>
          </ul>
        </section>

        <div class="mt-8 card p-6">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.baseUrl")}</h2>
          <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-sm"><code>{APP_URL}/api</code></pre>
        </div>

        <section class="mt-8 card p-6">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.authTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.authBody")}</p>
          <ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>{tr(i18n, "docs.authDashboard")}</li>
            <li>{tr(i18n, "docs.authApiKey")}</li>
            <li>{tr(i18n, "docs.authPublicKeyErrors")}</li>
          </ul>
        </section>

        {SECTIONS.map((s) => (
          <section key={s.title} class="mt-8 card p-6">
            <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, s.title)}</h2>
            <p class="mt-2 text-sm text-slate-600">{tr(i18n, s.body)}</p>
            <EndpointTable endpoints={s.endpoints} />
            {s.snippet && <Code code={s.snippet} />}
          </section>
        ))}

        <section class="mt-8 card p-6">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.dimensionsTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.dimensionsBodyErrors")}</p>
          <Code code="level · environment · release · browser · os · device · type" />
        </section>

        <section class="mt-8 card p-6" id="limits">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.limitsTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.errorsBodyErrors")}</p>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.capsBody")}</p>
          <p class="mt-2 text-sm text-slate-600">
            {tr(i18n, "docs.plansBody", {
              projects: fmtLimit(PLANS.free.projects, i18n),
              events: fmtLimit(PLANS.free.events_per_month, i18n),
              days: String(PLANS.free.retention_days),
            })}
          </p>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.privacyBodyErrors")}</p>
        </section>

        <section class="mt-8 card p-6" id="mcp">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.mcpTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.mcpBodyErrors")}</p>
          <div class="mt-4 text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "docs.mcpLocal")}</div>
          <Code code={MCP_SNIPPET} />
          <div class="mt-4 text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "docs.mcpRemote")}</div>
          <Code code={MCP_REMOTE_SNIPPET} />
          <div class="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-3 py-2">{tr(i18n, "docs.colTool")}</th>
                  <th class="px-3 py-2">{tr(i18n, "docs.colScope")}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {MCP_TOOLS.map((t) => (
                  <tr key={t.tool}>
                    <td class="px-3 py-2 font-mono text-xs text-slate-800">{t.tool}</td>
                    <td class="px-3 py-2 font-mono text-xs text-slate-500">{t.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.mcpPrompt")}</p>
        </section>
      </div>
    );
  }

  // Generic placeholder for any other /info/* page.
  const title = slug ? slug.split("/")[0].replace(/-/g, " ") : tr(i18n, "info.title");
  return (
    <div class="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 class="text-3xl font-bold capitalize text-slate-900">{title}</h1>
      <p class="mt-3 text-slate-600">{tr(i18n, "info.comingSoon")}</p>
      <Link href="/info" class="btn-secondary mt-6">{tr(i18n, "info.backToInfo")}</Link>
    </div>
  );
});

export const head: DocumentHead = ({ params }) => {
  const slug = (params.slug || "info").split("/")[0];
  const title = slug === "pricing" ? "Pricing" : slug === "docs" ? "Docs" : slug.replace(/-/g, " ");
  return { title: `${title.charAt(0).toUpperCase() + title.slice(1)} — oops` };
};
