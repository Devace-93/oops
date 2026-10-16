import { component$, useContext } from "@builder.io/qwik";
import { useLocation, Link, type DocumentHead } from "@builder.io/qwik-city";
import { PricingTable } from "../../../../components/pricing-table";
import { FeaturesContext } from "../../../../lib/features";
import { tr, useI18n } from "../../../../i18n";
import type { CatalogKey } from "../../../../i18n/catalog/en";

const APP_URL = (import.meta.env.VITE_APP_URL || "https://oops.3m4.net").replace(/\/$/, "");
const CONTRACT_URL = "https://github.com/Devace-93/oops/blob/main/CONTRACT.md";
const MCP_SNIPPET = "claude mcp add oops --scope user --env OOPS_API_KEY=oops_live_… -- npx -y oops-errors-mcp";
const MCP_REMOTE_SNIPPET = `claude mcp add --transport http oops ${APP_URL}/mcp --header "Authorization: Bearer oops_live_…"`;

const SCRIPT_TAG = `<script defer src="${APP_URL}/m.js" data-key="oops_pub_…"></script>`;
const SCRIPT_ATTRS = `<script defer src="${APP_URL}/m.js" data-key="oops_pub_…"
        data-spa="true" data-hash="false" data-dnt="false" data-local="false"></script>`;
const TRACKER_JS = `// custom events (≤ 2 KB of props)
oops.track("signup", { plan: "pro" });

// manual page view (when data-spa="false")
oops.pageview();

// queue calls before the script has loaded
window.oops = { q: [["track", "cta_click", { where: "hero" }]] };`;
const DECLARATIVE = `<button data-oops-event="cta_click" data-oops-props='{"where":"hero"}'>Start</button>`;
const PIXEL = `<img src="${APP_URL}/api/collect/pixel.gif?k=oops_pub_…&u=/newsletter/october&n=open"
     alt="" width="1" height="1" style="position:absolute;left:-9999px">`;
const CURL_COLLECT = `curl -X POST ${APP_URL}/api/collect \\
  -H "X-Project-Key: oops_pub_…" -H "Content-Type: application/json" \\
  -H "User-Agent: my-backend/1.0" \\
  -d '{
    "n": "purchase",
    "u": "https://myapp.example.com/checkout",
    "r": "https://news.ycombinator.com/",
    "l": "es-MX",
    "p": { "amount": 42, "currency": "USD" },
    "s": "api"
  }'`;
const CURL_STATS = `curl "${APP_URL}/api/projects/$PROJECT/stats?period=7d&tz=Europe/Madrid" \\
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
    body: "docs.projectsBody",
    endpoints: [
      { method: "GET", path: "/projects?q=", scope: "projects:read", notes: "with 30-day counts" },
      { method: "POST", path: "/projects", scope: "projects:write", notes: "{name, key?, url?, timezone?, allowed_origins?} → 201 · 402 limit_reached" },
      { method: "GET", path: "/projects/:id", scope: "projects:read" },
      { method: "PATCH", path: "/projects/:id", scope: "projects:write", notes: "name, url, timezone, allowed_origins, collect_enabled, exclude_bots" },
      { method: "DELETE", path: "/projects/:id", scope: "projects:delete", notes: "cascades events" },
      { method: "POST", path: "/projects/:id/rotate-key", scope: "projects:write", notes: "old public key stops immediately" },
      { method: "GET", path: "/projects/:id/summary", scope: "stats:read", notes: "today / yesterday / 7d / 30d, live" },
      { method: "DELETE", path: "/projects/:id/events?before=", scope: "events:delete", notes: "purge stored events" },
    ],
    snippet: `curl -X POST ${APP_URL}/api/projects \\
  -H "X-API-Key: oops_live_…" -H "Content-Type: application/json" \\
  -d '{"name": "My app", "url": "https://myapp.example.com", "timezone": "Europe/Madrid"}'`,
  },
  {
    title: "docs.statsTitle",
    body: "docs.statsBody",
    endpoints: [
      { method: "GET", path: "/projects/:id/stats?period=&from=&to=&tz=&interval=&limit=&<dimension>=", scope: "stats:read", notes: "totals, previous period, series, top-8 breakdowns, live" },
      { method: "GET", path: "/projects/:id/stats/breakdown?by=&page=&per_page=", scope: "stats:read", notes: "one dimension, paginated" },
      { method: "GET", path: "/projects/:id/stats/series", scope: "stats:read", notes: "the time series alone" },
      { method: "GET", path: "/projects/:id/events?kind=&q=&page=", scope: "stats:read", notes: "raw events, newest first" },
      { method: "GET", path: "/projects/:id/live", scope: "stats:read", notes: "visitors in the last 5 minutes" },
    ],
    snippet: CURL_STATS,
  },
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
          <p class="mx-auto mt-3 max-w-2xl text-slate-600">{early ? tr(i18n, "pricing.introPlanned") : tr(i18n, "pricing.intro")}</p>
        </div>

        {early && (
          <div class="mx-auto mt-8 max-w-3xl rounded-xl border border-primary-200 bg-primary-50 p-6 text-center" data-testid="early-access-pricing">
            <p class="text-lg font-semibold text-primary-900">{tr(i18n, "pricing.earlyTitle")}</p>
            <p class="mt-2 text-sm text-primary-900/80">{tr(i18n, "pricing.earlyBody")}</p>
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
          {tr(i18n, "pricing.footnote")}
          {early && ` ${tr(i18n, "pricing.footnoteEarly")}`}
        </p>
      </div>
    );
  }

  if (slug === "docs") {
    return (
      <div class="mx-auto max-w-4xl px-4 py-16">
        <h1 class="text-3xl font-bold text-slate-900">{tr(i18n, "docs.title")}</h1>
        <p class="mt-2 text-slate-600">{tr(i18n, "docs.intro")}</p>
        <a href={CONTRACT_URL} target="_blank" rel="noreferrer" class="mt-3 inline-block text-sm font-medium text-primary-600 hover:underline">
          {tr(i18n, "docs.fullContract")} →
        </a>

        {/* Tracker */}
        <section class="mt-8 card p-6" id="tracker">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.trackerTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.trackerBody")}</p>
          <Code code={SCRIPT_TAG} />
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.trackerAttrsTitle")}</h3>
          <Code code={SCRIPT_ATTRS} />
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li><code>data-key</code> — {tr(i18n, "docs.attrKey")}</li>
            <li><code>data-spa</code> — {tr(i18n, "docs.attrSpa")}</li>
            <li><code>data-hash</code> — {tr(i18n, "docs.attrHash")}</li>
            <li><code>data-dnt</code> — {tr(i18n, "docs.attrDnt")}</li>
            <li><code>data-local</code> — {tr(i18n, "docs.attrLocal")}</li>
            <li><code>data-api</code> — {tr(i18n, "docs.attrApi")}</li>
          </ul>
          <h3 class="mt-5 font-semibold text-slate-900">{tr(i18n, "docs.trackerJsTitle")}</h3>
          <p class="mt-1 text-sm text-slate-600">{tr(i18n, "docs.trackerJsBody")}</p>
          <Code code={TRACKER_JS} />
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.trackerDeclarative")}</p>
          <Code code={DECLARATIVE} />
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.trackerWhat")}</p>
        </section>

        {/* Pixel */}
        <section class="mt-8 card p-6" id="pixel">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.pixelTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.pixelBody")}</p>
          <Code code={PIXEL} />
        </section>

        {/* Collect API */}
        <section class="mt-8 card p-6" id="collect">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.collectTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.collectBody")}</p>
          <Code code={CURL_COLLECT} />
          <ul class="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{tr(i18n, "docs.collectField1")}</li>
            <li>{tr(i18n, "docs.collectField2")}</li>
            <li>{tr(i18n, "docs.collectField3")}</li>
            <li>{tr(i18n, "docs.collectField4")}</li>
            <li>{tr(i18n, "docs.collectField5")}</li>
          </ul>
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.collectResponses")}</p>
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
            <li>{tr(i18n, "docs.authPublicKey")}</li>
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
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.dimensionsBody")}</p>
          <Code code="path · hostname · referrer · country · region · city · device · browser · os · lang · utm_source · utm_medium · utm_campaign · name" />
        </section>

        <section class="mt-8 card p-6">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.errorsTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.errorsBody")}</p>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.privacyBody")}</p>
        </section>

        <section class="mt-8 card p-6" id="mcp">
          <h2 class="text-xl font-semibold text-slate-900">{tr(i18n, "docs.mcpTitle")}</h2>
          <p class="mt-2 text-sm text-slate-600">{tr(i18n, "docs.mcpBody")}</p>
          <div class="mt-4 text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "docs.mcpLocal")}</div>
          <Code code={MCP_SNIPPET} />
          <div class="mt-4 text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "docs.mcpRemote")}</div>
          <Code code={MCP_REMOTE_SNIPPET} />
          <p class="mt-3 text-sm text-slate-600">{tr(i18n, "docs.mcpTools")}</p>
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
