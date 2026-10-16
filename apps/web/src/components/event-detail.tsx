import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";
import type { Event } from "../lib/types";
import { DEVICE_ICON, fmtJson, fmtTimestamp } from "../lib/stats";
import { LevelBadge } from "./level-badge";
import { StackTrace } from "./stack-trace";
import { Breadcrumbs } from "./breadcrumbs";
import { tr, useI18n } from "../i18n";

/**
 * One occurrence rendered in full: header (level, type, timestamp, source),
 * message, stack frames, context (user, browser / OS / device, URL, release,
 * environment, platform, SDK, IP when stored), tags, extra (JSON) and the
 * breadcrumb timeline. Used by the issue page and the event-log drawer.
 */
export const EventDetail = component$<{ event: Event; projectId: string; showIssueLink?: boolean }>(({ event: e, projectId, showIssueLink }) => {
  const i18n = useI18n();
  const tags = Object.entries(e.tags ?? {});
  const extraKeys = Object.keys(e.extra ?? {});
  const user = e.user && (e.user.id || e.user.email || e.user.name) ? e.user : null;
  const Row = (label: string, value: string | null | undefined, mono = false) =>
    value ? (
      <>
        <dt class="text-slate-500">{label}</dt>
        <dd class={["break-all text-slate-800", mono ? "font-mono text-xs" : ""]}>{value}</dd>
      </>
    ) : null;
  return (
    <div class="space-y-6" data-testid="event-detail" data-event-id={e.id}>
      {/* Header */}
      <div>
        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <LevelBadge level={e.level} />
          {e.type && <span class="font-mono text-slate-700">{e.type}</span>}
          <span>·</span>
          <time dateTime={e.ts} title={e.ts}>{fmtTimestamp(e.ts, i18n.lang)}</time>
          <span>·</span>
          <span class="font-mono">{e.source}</span>
          {showIssueLink && (
            <Link href={`/dashboard/projects/${projectId}/issues/${e.issue_id}`} class="ml-auto font-medium text-primary-600 hover:underline">
              {tr(i18n, "events.openIssue", { n: e.issue_number })} →
            </Link>
          )}
        </div>
        <p class="mt-2 break-words font-mono text-sm text-slate-900">{e.message}</p>
      </div>

      {/* Stack */}
      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.stackTitle")}</h3>
        <StackTrace frames={e.frames ?? []} raw={e.stack_raw} />
      </section>

      {/* Context */}
      <section class="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.contextTitle")}</h3>
          <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
            {Row(tr(i18n, "dim.environment"), e.environment)}
            {Row(tr(i18n, "dim.release"), e.release, true)}
            {Row(tr(i18n, "issue.url"), e.url, true)}
            {Row(tr(i18n, "dim.browser"), e.browser)}
            {Row(tr(i18n, "dim.os"), e.os)}
            {Row(tr(i18n, "dim.device"), e.device ? `${DEVICE_ICON[e.device] ?? ""} ${e.device}`.trim() : null)}
            {Row(tr(i18n, "issue.platform"), e.platform)}
            {Row(tr(i18n, "issue.sdk"), e.sdk, true)}
            {Row("IP", e.ip, true)}
          </dl>
        </div>
        <div>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.userTitle")}</h3>
          {user ? (
            <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-sm">
              {Row("id", user.id, true)}
              {Row(tr(i18n, "common.email"), user.email)}
              {Row(tr(i18n, "common.name"), user.name)}
            </dl>
          ) : (
            <p class="text-sm text-slate-400">{tr(i18n, "issue.anonymousUser")}</p>
          )}
          <p class="mt-1 font-mono text-xs text-slate-400" title={tr(i18n, "issue.userHashHint")}>
            {e.user_hash?.slice(0, 12)}
          </p>

          {tags.length > 0 && (
            <>
              <h3 class="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.tagsTitle")}</h3>
              <ul class="flex flex-wrap gap-1.5">
                {tags.map(([k, v]) => (
                  <li key={k} class="badge bg-slate-100 font-mono text-[11px] text-slate-700">
                    <span class="text-slate-500">{k}=</span>
                    {v}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* Extra */}
      {extraKeys.length > 0 && (
        <section>
          <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.extraTitle")}</h3>
          <pre class="overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-relaxed">{fmtJson(e.extra)}</pre>
        </section>
      )}

      {/* Breadcrumbs */}
      <section>
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr(i18n, "issue.breadcrumbsTitle")}</h3>
        <Breadcrumbs crumbs={e.breadcrumbs ?? []} eventTs={e.ts} />
      </section>
    </div>
  );
});
