import { component$, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../../../lib/api";
import { errorMessage } from "../../../../../../../lib/errors";
import { fmtCompact, fmtDateTime, fmtNumber, fmtRelative, fmtTimestamp } from "../../../../../../../lib/stats";
import { ProjectNav } from "../../../../../../../components/project-nav";
import { LevelBadge, StatusBadge } from "../../../../../../../components/level-badge";
import { EventDetail } from "../../../../../../../components/event-detail";
import { tr, useI18n } from "../../../../../../../i18n";
import type { Event, Issue, IssueStatus, Project } from "../../../../../../../lib/types";

const PER_PAGE = 20;

/**
 * Issue page: header with status actions and counters, the selected occurrence
 * rendered in full (latest by default) and the paged list of occurrences, any
 * of which can be viewed instead.
 */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const i18n = useI18n();
  const id = loc.params.id;
  const issueParam = loc.params.issue;

  const state = useStore<{
    project: Project | null;
    issue: Issue | null;
    event: Event | null;
    occurrences: Event[];
    page: number;
    total: number;
    loading: boolean;
    listLoading: boolean;
    error: string;
    busy: boolean;
    showList: boolean;
  }>({ project: null, issue: null, event: null, occurrences: [], page: 1, total: 0, loading: true, listLoading: false, error: "", busy: false, showList: true });

  const loadOccurrences = $(async () => {
    if (!state.issue) return;
    state.listLoading = true;
    try {
      const res = await api.issueEvents(id, state.issue.id, state.page, PER_PAGE);
      state.occurrences = res.items;
      state.total = res.total;
    } catch {
      /* the latest event is still shown */
    } finally {
      state.listLoading = false;
    }
  });

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      const issue = await api.getIssue(id, issueParam);
      state.issue = issue;
      state.event = issue.latest_event ?? null;
      await loadOccurrences();
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = errorMessage(i18n, e, "issue.loadFailed");
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
  });

  const setStatus = $(async (status: IssueStatus) => {
    if (!state.issue) return;
    state.busy = true;
    state.error = "";
    try {
      const updated = await api.updateIssue(id, state.issue.id, status);
      state.issue = { ...updated, latest_event: state.issue.latest_event };
      // Open-issue count in the header changes with the status.
      api.getProject(id).then((p) => (state.project = p)).catch(() => {});
    } catch (e) {
      state.error = errorMessage(i18n, e, "issue.updateFailed");
    } finally {
      state.busy = false;
    }
  });

  const it = state.issue;
  const pages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const isLatest = !!it && !!state.event && (it.latest_event_id ? state.event.id === it.latest_event_id : state.event.id === it.latest_event?.id);

  return (
    <>
      <ProjectNav project={state.project} id={id} />
      <div class="mx-auto max-w-6xl px-4 py-6">
        <Link href={`/dashboard/projects/${id}`} class="text-sm text-slate-500 hover:text-primary-600">
          {tr(i18n, "issue.back")}
        </Link>

        {state.error && <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        {state.loading && !it && <div class="card mt-4 p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>}

        {it && (
          <>
            {/* Header */}
            <section class="card mt-3 p-5" data-testid="issue-header" data-issue-number={it.number}>
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <LevelBadge level={it.level} />
                    <span title={it.resolved_at ? tr(i18n, "issue.resolvedAt", { when: fmtDateTime(it.resolved_at, i18n.lang) }) : undefined}>
                      <StatusBadge status={it.status} />
                    </span>
                    {it.regressed_at && (
                      <span class="badge bg-amber-100 text-amber-800" title={tr(i18n, "issue.regressedAt", { when: fmtDateTime(it.regressed_at, i18n.lang) })}>
                        {tr(i18n, "issue.regressed")}
                      </span>
                    )}
                    <span class="font-mono text-xs text-slate-400">#{it.number}</span>
                  </div>
                  <h1 class="mt-2 break-words text-xl font-bold text-slate-900">{it.title}</h1>
                  {it.culprit && <p class="mt-1 break-all font-mono text-sm text-slate-500">{it.culprit}</p>}
                </div>
                <div class="flex flex-wrap gap-2" data-testid="issue-actions">
                  {it.status !== "resolved" && (
                    <button type="button" class="btn-primary" disabled={state.busy} onClick$={() => setStatus("resolved")}>
                      {tr(i18n, "issue.resolve")}
                    </button>
                  )}
                  {it.status !== "ignored" && (
                    <button type="button" class="btn-secondary" disabled={state.busy} onClick$={() => setStatus("ignored")}>
                      {tr(i18n, "issue.ignore")}
                    </button>
                  )}
                  {it.status !== "open" && (
                    <button type="button" class="btn-secondary" disabled={state.busy} onClick$={() => setStatus("open")}>
                      {tr(i18n, "issue.reopen")}
                    </button>
                  )}
                </div>
              </div>

              <dl class="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "metric.events")}</dt>
                  <dd class="mt-0.5 text-lg font-bold text-slate-900" title={fmtNumber(it.event_count, i18n.lang)}>{fmtCompact(it.event_count, i18n.lang)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "metric.users")}</dt>
                  <dd class="mt-0.5 text-lg font-bold text-slate-900" title={fmtNumber(it.user_count, i18n.lang)}>{fmtCompact(it.user_count, i18n.lang)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "inbox.colFirstSeen")}</dt>
                  <dd class="mt-0.5 text-slate-800" title={fmtTimestamp(it.first_seen, i18n.lang)}>{fmtRelative(it.first_seen, i18n.lang)}</dd>
                </div>
                <div>
                  <dt class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "inbox.colLastSeen")}</dt>
                  <dd class="mt-0.5 text-slate-800" title={fmtTimestamp(it.last_seen, i18n.lang)}>{fmtRelative(it.last_seen, i18n.lang)}</dd>
                </div>
              </dl>

              <div class="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "dim.environment")}</span>
                  {it.environments.length ? it.environments.map((env) => <span key={env} class="badge bg-slate-100 text-slate-700">{env}</span>) : <span class="text-slate-400">—</span>}
                </div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs uppercase tracking-wide text-slate-500">{tr(i18n, "dim.release")}</span>
                  {it.releases.length ? it.releases.map((r) => <span key={r} class="badge bg-slate-100 font-mono text-[11px] text-slate-700">{r}</span>) : <span class="text-slate-400">—</span>}
                </div>
              </div>
            </section>

            <div class="mt-4 grid gap-4 lg:grid-cols-[1fr,20rem]">
              {/* Selected occurrence */}
              <section class="card p-5">
                <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 class="text-sm font-semibold text-slate-900">
                    {isLatest ? tr(i18n, "issue.latestEvent") : tr(i18n, "issue.selectedEvent")}
                    {state.event && <span class="ml-2 font-mono text-xs text-slate-400">{state.event.id}</span>}
                  </h2>
                  {!isLatest && it.latest_event && (
                    <button type="button" class="btn-ghost text-xs" onClick$={() => (state.event = it.latest_event ?? null)}>
                      {tr(i18n, "issue.backToLatest")}
                    </button>
                  )}
                </div>
                {state.event ? <EventDetail event={state.event} projectId={id} /> : <p class="text-sm text-slate-400">{tr(i18n, "issue.noEvent")}</p>}
              </section>

              {/* Occurrences */}
              <aside class="card self-start p-4" data-testid="occurrences">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-slate-900">{tr(i18n, "issue.occurrences", { n: fmtNumber(state.total, i18n.lang) })}</h2>
                  <button type="button" class="btn-ghost px-2 py-1 text-xs lg:hidden" onClick$={() => (state.showList = !state.showList)} aria-expanded={state.showList}>
                    {state.showList ? "▴" : "▾"}
                  </button>
                </div>
                <div class={[state.showList ? "" : "hidden lg:block", state.listLoading ? "opacity-60" : ""]}>
                  {state.occurrences.length === 0 ? (
                    <p class="mt-3 text-sm text-slate-400">{state.listLoading ? tr(i18n, "common.loading") : tr(i18n, "issue.noEvent")}</p>
                  ) : (
                    <ul class="mt-3 divide-y divide-slate-100 text-sm">
                      {state.occurrences.map((ev) => {
                        const active = state.event?.id === ev.id;
                        return (
                          <li key={ev.id}>
                            <button
                              type="button"
                              class={["flex w-full flex-col items-start gap-0.5 rounded px-2 py-2 text-left hover:bg-slate-50", active ? "bg-primary-50 ring-1 ring-primary-300" : ""]}
                              aria-pressed={active}
                              onClick$={() => (state.event = ev)}
                            >
                              <span class="flex w-full items-center justify-between gap-2">
                                <span class="text-slate-800" title={fmtTimestamp(ev.ts, i18n.lang)}>{fmtRelative(ev.ts, i18n.lang)}</span>
                                <LevelBadge level={ev.level} small />
                              </span>
                              <span class="flex w-full flex-wrap gap-x-2 text-xs text-slate-500">
                                <span>{ev.environment}</span>
                                {ev.release && <span class="font-mono">{ev.release}</span>}
                                {(ev.browser || ev.os) && <span>{[ev.browser, ev.os].filter(Boolean).join(" · ")}</span>}
                                {ev.user?.id && <span class="font-mono">{ev.user.id}</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {pages > 1 && (
                    <div class="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <button type="button" class="btn-secondary px-2 py-1" disabled={state.page <= 1} onClick$={async () => { state.page -= 1; await loadOccurrences(); }}>←</button>
                      <span>{state.page} / {pages}</span>
                      <button type="button" class="btn-secondary px-2 py-1" disabled={state.page >= pages} onClick$={async () => { state.page += 1; await loadOccurrences(); }}>→</button>
                    </div>
                  )}
                  <Link href={`/dashboard/projects/${id}/events?issue=${it.id}`} class="mt-3 inline-block text-xs font-medium text-primary-600 hover:underline">
                    {tr(i18n, "issue.allEventsLink")} →
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Issue — oops" };
