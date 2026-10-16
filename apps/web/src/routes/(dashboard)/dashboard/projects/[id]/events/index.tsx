import { component$, useStore, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../../lib/api";
import { errorMessage } from "../../../../../../lib/errors";
import { DEVICE_ICON, ISSUE_PERIODS, ISSUE_PERIOD_LABEL, LEVELS, LEVEL_LABEL, fmtNumber, fmtTimestamp, shortUrl } from "../../../../../../lib/stats";
import { ProjectNav } from "../../../../../../components/project-nav";
import { LevelBadge } from "../../../../../../components/level-badge";
import { Modal } from "../../../../../../components/modal";
import { EventDetail } from "../../../../../../components/event-detail";
import { tr, useI18n } from "../../../../../../i18n";
import type { Event, IssuePeriod, Level, Project } from "../../../../../../lib/types";

const PER_PAGE = 50;

/** Raw event log: one row per occurrence across the project, newest first, with a detail drawer. */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const i18n = useI18n();
  const id = loc.params.id;
  const issueParam = loc.url.searchParams.get("issue") ?? "";

  const state = useStore<{
    project: Project | null;
    items: Event[];
    total: number;
    page: number;
    loading: boolean;
    error: string;
    period: IssuePeriod;
    level: Level | "";
    environment: string;
    release: string;
    q: string;
    issue: string;
    envOptions: string[];
    relOptions: string[];
    open: Event | null;
  }>({ project: null, items: [], total: 0, page: 1, loading: true, error: "", period: "7d", level: "", environment: "", release: "", q: "", issue: issueParam, envOptions: [], relOptions: [], open: null });

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      const res = await api.events(id, {
        period: state.period,
        level: state.level,
        environment: state.environment || undefined,
        release: state.release || undefined,
        q: state.q.trim() || undefined,
        issue: state.issue || undefined,
        page: state.page,
        per_page: PER_PAGE,
      });
      state.items = res.items;
      state.total = res.total;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = errorMessage(i18n, e, "events.loadFailed");
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    load();
    api
      .getProject(id)
      .then((p) => (state.project = p))
      .catch(() => {});
    // Environment / release option lists from the 30-day breakdowns.
    api
      .stats(id, { period: "30d" })
      .then((s) => {
        state.envOptions = (s.breakdowns.environment ?? []).map((r) => r.value).filter(Boolean);
        state.relOptions = (s.breakdowns.release ?? []).map((r) => r.value).filter(Boolean);
      })
      .catch(() => {});
  });

  // Reload on filter changes (the first load is the visible task above: a
  // tracking task does not re-run on hydration).
  useTask$(({ track, cleanup }) => {
    const key = track(() => [state.period, state.level, state.environment, state.release, state.q, state.issue, state.page].join("|"));
    if (typeof window === "undefined" || key === `7d||||${""}|${issueParam}|1`) return;
    const t = setTimeout(() => load(), state.q ? 300 : 0);
    cleanup(() => clearTimeout(t));
  });

  const pages = Math.max(1, Math.ceil(state.total / PER_PAGE));

  return (
    <>
      <ProjectNav project={state.project} id={id} />
      <div class="mx-auto max-w-6xl px-4 py-6">
        <div class="flex flex-wrap items-center gap-2">
          <select class="input w-auto" aria-label={tr(i18n, "overview.range")} value={state.period} onChange$={(_, el) => { state.period = el.value as IssuePeriod; state.page = 1; }}>
            {ISSUE_PERIODS.map((p) => (
              <option key={p} value={p} selected={p === state.period}>{tr(i18n, ISSUE_PERIOD_LABEL[p])}</option>
            ))}
          </select>
          <select class="input w-auto" aria-label={tr(i18n, "dim.level")} value={state.level} onChange$={(_, el) => { state.level = el.value as Level | ""; state.page = 1; }}>
            <option value="">{tr(i18n, "inbox.allLevels")}</option>
            {LEVELS.map((l) => (
              <option key={l} value={l} selected={l === state.level}>{tr(i18n, LEVEL_LABEL[l])}</option>
            ))}
          </select>
          <select class="input w-auto" aria-label={tr(i18n, "dim.environment")} value={state.environment} onChange$={(_, el) => { state.environment = el.value; state.page = 1; }}>
            <option value="">{tr(i18n, "inbox.allEnvironments")}</option>
            {state.envOptions.map((v) => (
              <option key={v} value={v} selected={v === state.environment}>{v}</option>
            ))}
          </select>
          <select class="input w-auto" aria-label={tr(i18n, "dim.release")} value={state.release} onChange$={(_, el) => { state.release = el.value; state.page = 1; }}>
            <option value="">{tr(i18n, "inbox.allReleases")}</option>
            {state.relOptions.map((v) => (
              <option key={v} value={v} selected={v === state.release}>{v}</option>
            ))}
          </select>
          <input type="search" class="input w-full sm:w-64" placeholder={tr(i18n, "events.searchMessages")} aria-label={tr(i18n, "common.search")} value={state.q} onInput$={(_, el) => { state.q = el.value; state.page = 1; }} />
          {state.issue && (
            <button type="button" class="badge bg-primary-100 text-primary-800 hover:bg-primary-200" onClick$={() => { state.issue = ""; state.page = 1; }} title={tr(i18n, "overview.removeFilter")}>
              {tr(i18n, "events.issueFilter")} ✕
            </button>
          )}
          <span class="ml-auto text-sm text-slate-500">{tr(i18n, "events.total", { total: fmtNumber(state.total, i18n.lang) })}</span>
        </div>

        <div class="card mt-4 overflow-hidden">
          {state.loading && state.items.length === 0 ? (
            <div class="p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>
          ) : state.error ? (
            <div class="p-10 text-center text-sm text-red-600">
              {state.error}{" "}
              <button type="button" class="font-medium underline" onClick$={load}>{tr(i18n, "common.retry")}</button>
            </div>
          ) : state.items.length === 0 ? (
            <div class="p-10 text-center text-sm text-slate-500">
              {tr(i18n, "events.empty")}{" "}
              <Link href={`/dashboard/projects/${id}/settings`} class="font-medium text-primary-600 hover:underline">{tr(i18n, "overview.emptyCta")}</Link>
            </div>
          ) : (
            <div class={["overflow-x-auto", state.loading ? "opacity-60" : ""]}>
              <table class="w-full text-left text-sm" data-testid="events-table">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-3 py-2">{tr(i18n, "events.colTime")}</th>
                    <th class="px-3 py-2">{tr(i18n, "dim.level")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colError")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colIssue")}</th>
                    <th class="px-3 py-2">{tr(i18n, "dim.environment")}</th>
                    <th class="px-3 py-2">{tr(i18n, "dim.release")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colClient")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colUser")}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {state.items.map((e) => (
                    <tr key={e.id} class="cursor-pointer hover:bg-slate-50" data-testid="event-row" onClick$={() => (state.open = e)}>
                      <td class="whitespace-nowrap px-3 py-2 text-slate-600" title={e.ts}>{fmtTimestamp(e.ts, i18n.lang)}</td>
                      <td class="px-3 py-2"><LevelBadge level={e.level} small /></td>
                      <td class="max-w-md px-3 py-2">
                        <div class="truncate font-mono text-xs text-slate-900" title={e.message}>
                          {e.type && <span class="text-slate-500">{e.type}: </span>}
                          {e.message}
                        </div>
                        {e.url && <div class="truncate text-xs text-slate-400" title={e.url}>{shortUrl(e.url)}</div>}
                      </td>
                      <td class="whitespace-nowrap px-3 py-2 font-mono text-xs">
                        <Link href={`/dashboard/projects/${id}/issues/${e.issue_id}`} class="text-primary-600 hover:underline" onClick$={(ev) => ev.stopPropagation()}>#{e.issue_number}</Link>
                      </td>
                      <td class="whitespace-nowrap px-3 py-2 text-slate-600">{e.environment}</td>
                      <td class="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600">{e.release || "—"}</td>
                      <td class="whitespace-nowrap px-3 py-2 text-slate-600">
                        {e.device ? `${DEVICE_ICON[e.device] ?? ""} ` : ""}{[e.browser, e.os].filter(Boolean).join(" · ") || (e.platform ?? "—")}
                      </td>
                      <td class="max-w-[10rem] truncate px-3 py-2 font-mono text-xs text-slate-500" title={e.user?.email ?? e.user?.id ?? ""}>
                        {e.user?.id || e.user?.email || <span class="text-slate-400">{e.user_hash?.slice(0, 8)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pages > 1 && (
          <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
            <button type="button" class="btn-secondary" disabled={state.page <= 1} onClick$={() => (state.page -= 1)}>←</button>
            <span>{tr(i18n, "common.pageOf", { page: state.page, pages, total: state.total })}</span>
            <button type="button" class="btn-secondary" disabled={state.page >= pages} onClick$={() => (state.page += 1)}>→</button>
          </div>
        )}
        <p class="mt-6 text-xs text-slate-400">{tr(i18n, "events.privacyNoteErrors")}</p>
      </div>

      {/* Detail drawer */}
      <Modal open={!!state.open} title={state.open ? `${state.open.type ? state.open.type + ": " : ""}${state.open.message}`.slice(0, 120) : ""} onClose$={() => (state.open = null)} wide>
        {state.open && <EventDetail event={state.open} projectId={id} showIssueLink />}
      </Modal>
    </>
  );
});

export const head: DocumentHead = { title: "Events — oops" };
