import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FeaturesContext } from "../../lib/features";
import { tr, useI18n } from "../../i18n";
import { PLANS, fmtLimit } from "../../lib/plans";

const APP_URL = (import.meta.env.VITE_APP_URL || "https://oops.3m4.net").replace(/\/$/, "");
const GITHUB_URL = "https://github.com/Devace-93/oops";
const MCP_NPM_URL = "https://www.npmjs.com/package/oops-errors-mcp";
const MCP_SNIPPET = "claude mcp add oops --scope user --env OOPS_API_KEY=oops_live_… -- npx -y oops-errors-mcp";
const MCP_REMOTE_SNIPPET = `claude mcp add --transport http oops ${APP_URL}/mcp --header "Authorization: Bearer oops_live_…"`;
const SCRIPT_SNIPPET = `<script defer src="${APP_URL}/m.js"
        data-key="oops_pub_…"></script>`;
const PIXEL_SNIPPET = `<img src="${APP_URL}/api/collect/pixel.gif?k=oops_pub_…&u=/newsletter"
     alt="" width="1" height="1">`;
const CURL_SNIPPET = `curl -X POST ${APP_URL}/api/collect \\
  -H "X-Project-Key: oops_pub_…" \\
  -H "Content-Type: application/json" \\
  -d '{"n": "purchase", "u": "https://myapp.example.com/checkout",
       "p": {"amount": 42}}'`;
const CURL_RESPONSE = `HTTP/1.1 202 Accepted
{ "ok": true }`;

export default component$(() => {
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const early = features["early-access"];
  const steps = [
    { title: tr(i18n, "landing.step1Title"), body: tr(i18n, "landing.step1Body") },
    { title: tr(i18n, "landing.step2Title"), body: tr(i18n, "landing.step2Body") },
    { title: tr(i18n, "landing.step3Title"), body: tr(i18n, "landing.step3Body") },
  ];
  const paths = [
    { icon: "📜", title: tr(i18n, "landing.pathScriptTitle"), body: tr(i18n, "landing.pathScriptBody"), code: SCRIPT_SNIPPET },
    { icon: "🖼️", title: tr(i18n, "landing.pathPixelTitle"), body: tr(i18n, "landing.pathPixelBody"), code: PIXEL_SNIPPET },
    { icon: "⚡", title: tr(i18n, "landing.pathApiTitle"), body: tr(i18n, "landing.pathApiBody"), code: CURL_SNIPPET },
  ];
  const demo = [
    ["/", 1284, 100],
    ["/docs", 612, 48],
    ["/blog/launch", 391, 30],
    ["/pricing", 207, 16],
  ] as const;
  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-primary-50 to-white">
        <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <span class="badge mb-5 bg-primary-100 text-primary-700">{tr(i18n, "landing.badge")}</span>
          <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {tr(i18n, "landing.heroTitle")} <span class="text-primary-600">{tr(i18n, "landing.heroTitleAccent")}</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{tr(i18n, "landing.heroBody")}</p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            {features.signups ? (
              <Link href="/signup" class="btn-primary px-6 py-3 text-base">{tr(i18n, "landing.getStarted")}</Link>
            ) : (
              <Link href="/login" class="btn-primary px-6 py-3 text-base">{tr(i18n, "nav.login")}</Link>
            )}
            {early ? (
              <Link href="/blog/what-paid-plans-will-include" class="btn-secondary px-6 py-3 text-base">{tr(i18n, "landing.whyFree")}</Link>
            ) : (
              <Link href="/info/pricing" class="btn-secondary px-6 py-3 text-base">{tr(i18n, "landing.seePricing")}</Link>
            )}
          </div>
          <p class="mt-4 text-sm text-slate-500" data-testid="hero-plan-note">
            {early
              ? tr(i18n, "landing.earlyNote")
              : tr(i18n, "landing.freeNote", {
                  projects: fmtLimit(PLANS.free.projects, i18n),
                  events: fmtLimit(PLANS.free.events_per_month, i18n),
                })}
          </p>
        </div>
      </section>

      {/* Three ways in */}
      <section class="mx-auto max-w-6xl px-4 py-16" id="integrate">
        <h2 class="text-center text-3xl font-bold text-slate-900">{tr(i18n, "landing.pathsTitle")}</h2>
        <p class="mx-auto mt-3 max-w-2xl text-center text-slate-600">{tr(i18n, "landing.pathsBody")}</p>
        <div class="mt-10 grid gap-6 lg:grid-cols-3">
          {paths.map((p) => (
            <div key={p.title} class="card flex flex-col p-6">
              <div class="text-2xl" aria-hidden="true">{p.icon}</div>
              <h3 class="mt-2 text-lg font-semibold text-slate-900">{p.title}</h3>
              <p class="mt-2 flex-1 text-sm text-slate-600">{p.body}</p>
              <pre class="panel-dark mt-4 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100"><code>{p.code}</code></pre>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section class="border-y border-slate-200 bg-slate-50">
        <div class="mx-auto max-w-6xl px-4 py-16">
          <h2 class="text-center text-3xl font-bold text-slate-900">{tr(i18n, "landing.howTitle")}</h2>
          <div class="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} class="card p-6">
                <h3 class="text-lg font-semibold text-slate-900">{s.title}</h3>
                <p class="mt-2 text-sm text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What you see */}
      <section class="mx-auto max-w-6xl px-4 py-16" id="dashboard">
        <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <h2 class="text-3xl font-bold text-slate-900">{tr(i18n, "landing.seeTitle")}</h2>
            <p class="mt-3 text-slate-600">{tr(i18n, "landing.seeBody")}</p>
            <ul class="mt-5 space-y-3 text-sm text-slate-700">
              <li><strong>{tr(i18n, "landing.seeWhereTitle")}</strong> {tr(i18n, "landing.seeWhereBody")}</li>
              <li><strong>{tr(i18n, "landing.seeWhoTitle")}</strong> {tr(i18n, "landing.seeWhoBody")}</li>
              <li><strong>{tr(i18n, "landing.seeWhatTitle")}</strong> {tr(i18n, "landing.seeWhatBody")}</li>
              <li><strong>{tr(i18n, "landing.seeLiveTitle")}</strong> {tr(i18n, "landing.seeLiveBody")}</li>
            </ul>
          </div>
          <div class="card p-6">
            <div class="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
              <span>{tr(i18n, "dim.path")}</span>
              <span>{tr(i18n, "metric.visitors")}</span>
            </div>
            <ul class="mt-3 space-y-1 text-sm">
              {demo.map(([path, n, pct]) => (
                <li key={path} class="relative flex items-center justify-between rounded px-2 py-1.5">
                  <span class="absolute inset-y-0 left-0 rounded bg-primary-100/70" style={{ width: `${pct}%` }} aria-hidden="true" />
                  <span class="relative font-mono text-xs text-slate-800">{path}</span>
                  <span class="relative font-medium tabular-nums text-slate-700">{n.toLocaleString()}</span>
                </li>
              ))}
            </ul>
            <div class="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden="true" />
              {tr(i18n, "overview.liveNow", { n: 7 })}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section class="border-y border-slate-200 bg-slate-50" id="privacy">
        <div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <h2 class="text-3xl font-bold text-slate-900">{tr(i18n, "landing.privacyTitle")}</h2>
            <p class="mt-3 text-slate-600">{tr(i18n, "landing.privacyBody")}</p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li>✓ {tr(i18n, "landing.privacy1")}</li>
              <li>✓ {tr(i18n, "landing.privacy2")}</li>
              <li>✓ {tr(i18n, "landing.privacy3")}</li>
              <li>✓ {tr(i18n, "landing.privacy4")}</li>
            </ul>
            <Link href="/info/docs" class="btn-secondary mt-6">{tr(i18n, "landing.readDocs")}</Link>
          </div>
          <div class="panel-dark card min-w-0 bg-slate-900 p-6 text-slate-100">
            <div class="text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.panelRequest")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{CURL_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.panelResponse")}</div>
            <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs leading-relaxed"><code>{CURL_RESPONSE}</code></pre>
            <p class="mt-4 text-sm text-slate-300">{tr(i18n, "landing.apiNote")}</p>
          </div>
        </div>
      </section>

      {/* MCP */}
      <section class="mx-auto max-w-6xl px-4 py-16" id="mcp">
        <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <span class="badge bg-primary-100 text-primary-700">{tr(i18n, "landing.mcpBadge")}</span>
            <h2 class="mt-4 text-3xl font-bold text-slate-900">{tr(i18n, "landing.mcpTitle")}</h2>
            <p class="mt-3 text-slate-600">
              {tr(i18n, "landing.mcpIntro")} <em>{tr(i18n, "landing.mcpExample1")}</em> {tr(i18n, "landing.mcpOr")}{" "}
              <em>{tr(i18n, "landing.mcpExample2")}</em>
            </p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li><strong>{tr(i18n, "landing.mcpBullet1Title")}</strong> {tr(i18n, "landing.mcpBullet1Body")}</li>
              <li><strong>{tr(i18n, "landing.mcpBullet2Title")}</strong> {tr(i18n, "landing.mcpBullet2Body")}</li>
              <li><strong>{tr(i18n, "landing.mcpBullet3Title")}</strong> {tr(i18n, "landing.mcpBullet3Body")}</li>
              <li>
                <strong>{tr(i18n, "landing.mcpBullet4Title")}</strong> {tr(i18n, "landing.mcpBullet4Body1")}{" "}
                <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">npx oops-errors-mcp</code>{" "}
                (<a href={MCP_NPM_URL} target="_blank" rel="noreferrer" class="text-primary-600 hover:underline">{tr(i18n, "landing.mcpBullet4Npm")}</a>){" "}
                {tr(i18n, "landing.mcpBullet4Body2")} <code class="rounded bg-slate-200 px-1 py-0.5 text-xs">{APP_URL}/mcp</code> {tr(i18n, "landing.mcpBullet4Body3")}
              </li>
            </ul>
          </div>
          <div class="panel-dark card min-w-0 bg-slate-900 p-6 text-slate-100">
            <div class="text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelLocal")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{MCP_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelRemote")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{MCP_REMOTE_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.mcpPanelJson")}</div>
            <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs leading-relaxed"><code>{`{
  "mcpServers": {
    "oops": {
      "command": "npx",
      "args": ["-y", "oops-errors-mcp"],
      "env": { "OOPS_API_KEY": "oops_live_…" }
    }
  }
}`}</code></pre>
            <p class="mt-4 text-sm text-slate-300">
              {tr(i18n, "landing.mcpKeyNote")}{" "}
              <Link href="/dashboard/settings" class="text-white underline">{tr(i18n, "landing.mcpKeyLink")}</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* Early access notice + CTA */}
      <section class="mx-auto max-w-6xl px-4 pb-16">
        <div class="card bg-primary-50 p-8 text-center">
          <h2 class="text-2xl font-bold text-slate-900">{tr(i18n, "landing.ctaTitle")}</h2>
          <p class="mx-auto mt-2 max-w-2xl text-slate-600">{tr(i18n, "landing.ctaBody")}</p>
          {early && (
            <p class="mx-auto mt-3 max-w-2xl text-sm text-primary-900" data-testid="early-access-note">
              <span class="font-semibold">{tr(i18n, "early.bannerTitle")}</span> {tr(i18n, "early.bannerText")}
            </p>
          )}
          <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
            {features.signups ? (
              <Link href="/signup" class="btn-primary px-6 py-3 text-base">{tr(i18n, "landing.getStarted")}</Link>
            ) : (
              <Link href="/login" class="btn-primary px-6 py-3 text-base">{tr(i18n, "nav.login")}</Link>
            )}
            <Link href="/info/docs" class="btn-secondary px-6 py-3 text-base">{tr(i18n, "landing.readDocs")}</Link>
          </div>
        </div>
      </section>

      {/* Self-host callout */}
      <section class="mx-auto max-w-6xl px-4 pb-20">
        <div class="panel-dark card flex flex-col items-start gap-6 bg-slate-900 p-8 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-2xl font-bold">{tr(i18n, "landing.selfhostTitle")}</h2>
            <p class="mt-2 max-w-2xl text-slate-300">
              {tr(i18n, "landing.selfhostBody1")}
              <code class="mx-1 rounded bg-slate-800 px-1.5 py-0.5 text-sm">docker compose up</code>
              {tr(i18n, "landing.selfhostBody2")}
            </p>
          </div>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer" class="btn bg-white text-slate-900 hover:bg-slate-100">
            {tr(i18n, "landing.viewGithub")}
          </a>
        </div>
      </section>
    </>
  );
});

export const head: DocumentHead = {
  title: "oops — privacy-friendly web analytics for your apps",
  meta: [
    {
      name: "description",
      content:
        "oops is an open-source analytics service: one script tag (or a pixel, or an API call) per project and you see page views, visitors, pages, referrers, countries, devices and browsers. No cookies, no raw IPs, role-scoped API keys and an MCP server for AI agents. Hosted or self-hostable (MIT).",
    },
  ],
};
