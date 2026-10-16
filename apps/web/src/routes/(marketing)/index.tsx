import { component$, useContext } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { FeaturesContext } from "../../lib/features";
import { tr, useI18n } from "../../i18n";
import { PLANS, fmtLimit } from "../../lib/plans";
import { LevelBadge } from "../../components/level-badge";
import type { Level } from "../../lib/types";

const APP_URL = (import.meta.env.VITE_APP_URL || "https://oops.3m4.net").replace(/\/$/, "");
const GITHUB_URL = "https://github.com/Devace-93/oops";
const MCP_NPM_URL = "https://www.npmjs.com/package/oops-errors-mcp";
const MCP_SNIPPET = "claude mcp add oops --scope user --env OOPS_API_KEY=oops_live_… -- npx -y oops-errors-mcp";
const MCP_REMOTE_SNIPPET = `claude mcp add --transport http oops ${APP_URL}/mcp --header "Authorization: Bearer oops_live_…"`;
const SDK_SNIPPET = `<script defer src="${APP_URL}/o.js"
        data-key="oops_pub_…" data-env="production"
        data-release="1.4.2"></script>`;
const INGEST_SNIPPET = `curl -X POST ${APP_URL}/api/ingest \\
  -H "X-Project-Key: oops_pub_…" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "ValueError", "message": "order 42 has no items",
       "platform": "python", "release": "1.4.2",
       "frames": [{"filename": "app/orders.py", "function": "ship",
                   "lineno": 88, "in_app": true}]}'`;
const INGEST_RESPONSE = `HTTP/1.1 202 Accepted
{ "ok": true, "event_id": "9021", "issue_id": "…", "issue_number": 12 }`;
const AGENT_SNIPPET = `# an agent reporting its own failure through MCP
report_error(project="checkout-bot",
             type="ToolError", message="stripe refund timed out",
             level="warning", tags={"tool": "refund"})`;

export default component$(() => {
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const early = features["early-access"];
  const steps = [
    { title: tr(i18n, "landing.step1Title"), body: tr(i18n, "landing.step1BodyErrors") },
    { title: tr(i18n, "landing.step2TitleErrors"), body: tr(i18n, "landing.step2BodyErrors") },
    { title: tr(i18n, "landing.step3TitleErrors"), body: tr(i18n, "landing.step3BodyErrors") },
  ];
  const paths = [
    { icon: "🪲", title: tr(i18n, "landing.pathSdkTitle"), body: tr(i18n, "landing.pathSdkBody"), code: SDK_SNIPPET },
    { icon: "🛠️", title: tr(i18n, "landing.pathIngestTitle"), body: tr(i18n, "landing.pathIngestBody"), code: INGEST_SNIPPET },
    { icon: "🤖", title: tr(i18n, "landing.pathAgentTitle"), body: tr(i18n, "landing.pathAgentBody"), code: AGENT_SNIPPET },
  ];
  // Demo inbox rows: level, #number, title, culprit, events, users.
  const demo: { level: Level; n: number; title: string; culprit: string; events: number; users: number; regressed?: boolean }[] = [
    { level: "fatal", n: 31, title: "TypeError: cart.items is undefined", culprit: "renderTotal in checkout.js", events: 412, users: 96, regressed: true },
    { level: "error", n: 27, title: "ValueError: order <n> has no items", culprit: "ship in app/orders.py", events: 58, users: 23 },
    { level: "warning", n: 24, title: "Fetch failed: POST /api/pay (502)", culprit: "pay in checkout.js", events: 19, users: 11 },
    { level: "info", n: 12, title: "Payment retried", culprit: "retry in queue/pay.ts", events: 6, users: 6 },
  ];
  return (
    <>
      {/* Hero */}
      <section class="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-primary-50 to-white">
        <div class="mx-auto max-w-6xl px-4 py-20 text-center sm:py-28">
          <span class="badge mb-5 bg-primary-100 text-primary-700">{tr(i18n, "landing.badgeErrors")}</span>
          <h1 class="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            {tr(i18n, "landing.heroTitleErrors")} <span class="text-primary-600">{tr(i18n, "landing.heroTitleAccentErrors")}</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{tr(i18n, "landing.heroBodyErrors")}</p>
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
              : tr(i18n, "landing.freeNoteErrors", {
                  projects: fmtLimit(PLANS.free.projects, i18n),
                  events: fmtLimit(PLANS.free.events_per_month, i18n),
                })}
          </p>
        </div>
      </section>

      {/* Three ways in */}
      <section class="mx-auto max-w-6xl px-4 py-16" id="integrate">
        <h2 class="text-center text-3xl font-bold text-slate-900">{tr(i18n, "landing.pathsTitleErrors")}</h2>
        <p class="mx-auto mt-3 max-w-2xl text-center text-slate-600">{tr(i18n, "landing.pathsBodyErrors")}</p>
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
            <h2 class="text-3xl font-bold text-slate-900">{tr(i18n, "landing.seeTitleErrors")}</h2>
            <p class="mt-3 text-slate-600">{tr(i18n, "landing.seeBodyErrors")}</p>
            <ul class="mt-5 space-y-3 text-sm text-slate-700">
              <li><strong>{tr(i18n, "landing.seeGroupTitle")}</strong> {tr(i18n, "landing.seeGroupBody")}</li>
              <li><strong>{tr(i18n, "landing.seeUsersTitle")}</strong> {tr(i18n, "landing.seeUsersBody")}</li>
              <li><strong>{tr(i18n, "landing.seeReleasesTitle")}</strong> {tr(i18n, "landing.seeReleasesBody")}</li>
              <li><strong>{tr(i18n, "landing.seeCrumbsTitle")}</strong> {tr(i18n, "landing.seeCrumbsBody")}</li>
            </ul>
          </div>
          <div class="card p-4" aria-hidden="true">
            <div class="flex items-center justify-between px-2 text-xs uppercase tracking-wide text-slate-500">
              <span>{tr(i18n, "inbox.colIssue")}</span>
              <span class="flex gap-6"><span>{tr(i18n, "metric.events")}</span><span>{tr(i18n, "metric.users")}</span></span>
            </div>
            <ul class="mt-2 divide-y divide-slate-100 text-sm">
              {demo.map((d) => (
                <li key={d.n} class="flex items-start justify-between gap-3 px-2 py-2">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <LevelBadge level={d.level} small />
                      <span class="font-mono text-xs text-slate-400">#{d.n}</span>
                      <span class="truncate font-medium text-slate-900">{d.title}</span>
                      {d.regressed && <span class="badge bg-amber-100 text-[10px] text-amber-800">{tr(i18n, "issue.regressed")}</span>}
                    </div>
                    <div class="truncate font-mono text-xs text-slate-500">{d.culprit}</div>
                  </div>
                  <div class="flex shrink-0 gap-6 tabular-nums text-slate-700">
                    <span class="w-8 text-right">{d.events}</span>
                    <span class="w-8 text-right">{d.users}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div class="mt-3 flex items-center gap-2 px-2 text-xs text-slate-500">
              <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" aria-hidden="true" />
              {tr(i18n, "inbox.liveNow", { n: 3 })}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section class="border-y border-slate-200 bg-slate-50" id="privacy">
        <div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <h2 class="text-3xl font-bold text-slate-900">{tr(i18n, "landing.privacyTitleErrors")}</h2>
            <p class="mt-3 text-slate-600">{tr(i18n, "landing.privacyBodyErrors")}</p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li>✓ {tr(i18n, "landing.privacyScrub")}</li>
              <li>✓ {tr(i18n, "landing.privacyUa")}</li>
              <li>✓ {tr(i18n, "landing.privacyIp")}</li>
              <li>✓ {tr(i18n, "landing.privacyCookies")}</li>
            </ul>
            <Link href="/info/docs" class="btn-secondary mt-6">{tr(i18n, "landing.readDocs")}</Link>
          </div>
          <div class="panel-dark card min-w-0 bg-slate-900 p-6 text-slate-100">
            <div class="text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.panelRequest")}</div>
            <pre class="mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-800 p-4 text-sm leading-relaxed"><code>{INGEST_SNIPPET}</code></pre>
            <div class="mt-5 text-xs uppercase tracking-wide text-slate-400">{tr(i18n, "landing.panelResponse")}</div>
            <pre class="mt-3 overflow-x-auto rounded-lg bg-slate-800 p-4 text-xs leading-relaxed"><code>{INGEST_RESPONSE}</code></pre>
            <p class="mt-4 text-sm text-slate-300">{tr(i18n, "landing.apiNoteErrors")}</p>
          </div>
        </div>
      </section>

      {/* MCP */}
      <section class="mx-auto max-w-6xl px-4 py-16" id="mcp">
        <div class="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div class="min-w-0">
            <span class="badge bg-primary-100 text-primary-700">{tr(i18n, "landing.mcpBadge")}</span>
            <h2 class="mt-4 text-3xl font-bold text-slate-900">{tr(i18n, "landing.mcpTitleErrors")}</h2>
            <p class="mt-3 text-slate-600">
              {tr(i18n, "landing.mcpIntro")} <em>{tr(i18n, "landing.mcpExampleRelease")}</em> {tr(i18n, "landing.mcpOr")}{" "}
              <em>{tr(i18n, "landing.mcpExampleTriage")}</em>
            </p>
            <ul class="mt-5 space-y-2 text-sm text-slate-700">
              <li><strong>{tr(i18n, "landing.mcpTriageTitle")}</strong> {tr(i18n, "landing.mcpTriageBody")}</li>
              <li><strong>{tr(i18n, "landing.mcpBullet1Title")}</strong> {tr(i18n, "landing.mcpBullet1Body")}</li>
              <li><strong>{tr(i18n, "landing.mcpBullet2Title")}</strong> {tr(i18n, "landing.mcpBullet2BodyErrors")}</li>
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
          <h2 class="text-2xl font-bold text-slate-900">{tr(i18n, "landing.ctaTitleErrors")}</h2>
          <p class="mx-auto mt-2 max-w-2xl text-slate-600">{tr(i18n, "landing.ctaBodyErrors")}</p>
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
              {tr(i18n, "landing.selfhostBody1Errors")}
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
  title: "oops — catch and fix the errors your apps throw",
  meta: [
    {
      name: "description",
      content:
        "oops is an open-source error-tracking service: a 4 KB browser SDK, a server-side ingest API and an MCP server for AI agents. Errors are grouped into issues by fingerprint with affected users, releases, environments, stack traces and breadcrumbs. Scrubbed payloads, no raw user agents, optional IPs, no cookies. Hosted or self-hostable (MIT).",
    },
  ],
};
