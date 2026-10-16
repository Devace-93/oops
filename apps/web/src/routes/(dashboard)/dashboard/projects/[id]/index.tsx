import { component$, useStore, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../lib/api";
import { errorMessage } from "../../../../../lib/errors";
import {
  DIMENSION_LABEL,
  ISSUE_PERIODS,
  ISSUE_PERIOD_LABEL,
  ISSUE_SORTS,
  ISSUE_SORT_LABEL,
  LEVELS,
  LEVEL_LABEL,
  METRICS,
  METRIC_LABEL,
  STATUS_FILTERS,
  STATUS_LABEL,
  fmtCompact,
  fmtNumber,
  fmtRelative,
  isFilterDimension,
  statsPeriodFor,
} from "../../../../../lib/stats";
import { Chart } from "../../../../../components/chart";
import { StatTile } from "../../../../../components/stat-tile";
import { BreakdownCard, rowLabel } from "../../../../../components/breakdown-card";
import { LevelBadge } from "../../../../../components/level-badge";
import { ProjectNav } from "../../../../../components/project-nav";
import { tr, useI18n } from "../../../../../i18n";
import type { Dimension, FilterDimension, Issue, IssuePeriod, IssueSort, IssueStatus, Level, Metric, Project, Stats, StatusFilter } from "../../../../../lib/types";

const PER_PAGE = 25;
const LIVE_REFRESH_MS = 30_000;
const BREAKDOWNS: Dimension[] = ["level", "environment", "release", "browser", "os", "device"];

/**
 * Issues inbox: KPI strip + events chart + breakdowns for the selected period
 * and filters, then the issue list with status tabs, filters, sort, paging and
 * bulk Resolve / Ignore / Reopen.
 */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const i18n = useI18n();
  const id = loc.params.id;

  const state = useStore<{
    project: Project | null;
    stats: Stats | null;
    issues: Issue[];
    total: number;
    counts: Record<StatusFilter, number>;
    loading: boolean;
    statsLoading: boolean;
    error: string;
    // filters
    status: StatusFilter;
    level: Level | "";
    environment: string;
    release: string;
    q: string;
    period: IssuePeriod;
    sort: IssueSort;
    page: number;
    metric: Metric;
    // option lists (union of every value seen, so a filter never hides its siblings)
    envOptions: string[];
    relOptions: string[];
    selected: string[];
    bulkBusy: boolean;
    bulkDone: string;
    live: number | null;
    tick: number;
    /** Sequence of the latest issues request; stale responses are dropped. */
    seq: number;
    /** Set once the page is on screen and the first loads have been issued. */
    mounted: boolean;
    showStats: boolean;
  }>({
    project: null,
    stats: null,
    issues: [],
    total: 0,
    counts: { open: 0, resolved: 0, ignored: 0, all: 0 },
    loading: true,
    statsLoading: true,
    error: "",
    status: "open",
    level: "",
    environment: "",
    release: "",
    q: "",
    period: "30d",
    sort: "last_seen",
    page: 1,
    metric: "events",
    envOptions: [],
    relOptions: [],
    selected: [],
    bulkBusy: false,
    bulkDone: "",
    live: null,
    tick: 0,
    seq: 0,
    mounted: false,
    showStats: true,
  });

  const handle401 = $((e: unknown): boolean => {
    if (e instanceof ApiRequestError && e.status === 401) {
      nav("/login");
      return true;
    }
    return false;
  });

  const loadProject = $(async () => {
    try {
      state.project = await api.getProject(id);
    } catch (e) {
      if (await handle401(e)) return;
      state.error = errorMessage(i18n, e, "inbox.loadFailed");
    }
  });

  const loadIssues = $(async () => {
    // Tabs and filters can change while a request is in flight; only the
    // latest request may write to the store (and `status` is read once, so a
    // late response never files its rows under another tab).
    const seq = ++state.seq;
    const status = state.status;
    state.loading = true;
    state.error = "";
    const common = {
      level: state.level,
      environment: state.environment || undefined,
      release: state.release || undefined,
      q: state.q.trim() || undefined,
      period: state.period,
    };
    try {
      const [page, ...others] = await Promise.all([
        api.listIssues(id, { ...common, status, sort: state.sort, page: state.page, per_page: PER_PAGE }),
        ...STATUS_FILTERS.filter((s) => s !== status).map((s) => api.listIssues(id, { ...common, status: s, page: 1, per_page: 1 })),
      ]);
      if (seq !== state.seq) return;
      state.issues = page.items;
      state.total = page.total;
      const counts = { ...state.counts, [status]: page.total };
      STATUS_FILTERS.filter((s) => s !== status).forEach((s, i) => (counts[s] = others[i].total));
      state.counts = counts;
      // Drop selections that left the page.
      state.selected = state.selected.filter((sid) => page.items.some((it) => it.id === sid));
    } catch (e) {
      if (seq !== state.seq) return;
      if (await handle401(e)) return;
      state.error = errorMessage(i18n, e, "inbox.loadFailed");
    } finally {
      if (seq === state.seq) state.loading = false;
    }
  });

  const loadStats = $(async () => {
    state.statsLoading = true;
    try {
      const s = await api.stats(id, {
        period: statsPeriodFor(state.period),
        filters: {
          level: state.level || undefined,
          environment: state.environment || undefined,
          release: state.release || undefined,
        },
      });
      state.stats = s;
      const union = (prev: string[], rows?: { value: string }[], current?: string) =>
        Array.from(new Set([...prev, ...(rows ?? []).map((r) => r.value), ...(current ? [current] : [])].filter(Boolean))).sort();
      state.envOptions = union(state.envOptions, s.breakdowns.environment, state.environment);
      state.relOptions = union(state.relOptions, s.breakdowns.release, state.release);
    } catch (e) {
      if (await handle401(e)) return;
      // Stats are secondary: the inbox still works without them.
      state.stats = null;
    } finally {
      state.statsLoading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    state.mounted = true;
    loadProject();
    loadIssues();
    loadStats();
    const timer = setInterval(() => (state.tick += 1), LIVE_REFRESH_MS);
    cleanup(() => clearInterval(timer));
  });

  // Reload the list when a filter / sort / page changes (debounced for typing).
  useTask$(({ track, cleanup }) => {
    const key = track(() => [state.status, state.level, state.environment, state.release, state.q, state.period, state.sort, state.page].join("|"));
    // Before mount the visible task issues the first load; afterwards every
    // change reloads, including a change back to the default filters.
    if (typeof window === "undefined" || !state.mounted || !key) return;
    const t = setTimeout(() => loadIssues(), state.q ? 300 : 0);
    cleanup(() => clearTimeout(t));
  });

  // Stats follow the shared filters (not status / sort / page / search).
  useTask$(({ track }) => {
    const key = track(() => [state.level, state.environment, state.release, state.period].join("|"));
    if (typeof window === "undefined" || !state.mounted || !key) return;
    loadStats();
  });

  // Live counter refresh.
  useTask$(({ track }) => {
    track(() => state.tick);
    if (typeof window === "undefined") return;
    api
      .live(id)
      .then((l) => (state.live = l.events))
      .catch(() => {});
  });

  const setFilter = $((dim: FilterDimension, value: string) => {
    const cur = dim === "level" ? state.level : dim === "environment" ? state.environment : state.release;
    const next = cur === value ? "" : value;
    if (dim === "level") state.level = next as Level | "";
    else if (dim === "environment") state.environment = next;
    else state.release = next;
    state.page = 1;
  });

  const onBreakdownSelect = $((dim: Dimension, value: string) => {
    if (isFilterDimension(dim)) {
      setFilter(dim, value);
    } else if (dim === "type") {
      state.q = state.q === value ? "" : value;
      state.page = 1;
    }
  });

  const clearFilters = $(() => {
    state.level = "";
    state.environment = "";
    state.release = "";
    state.q = "";
    state.page = 1;
  });

  const toggleSelect = $((issueId: string) => {
    state.selected = state.selected.includes(issueId) ? state.selected.filter((s) => s !== issueId) : [...state.selected, issueId];
  });

  const toggleAll = $(() => {
    state.selected = state.selected.length === state.issues.length ? [] : state.issues.map((it) => it.id);
  });

  const bulk = $(async (status: IssueStatus) => {
    if (!state.selected.length) return;
    state.bulkBusy = true;
    state.bulkDone = "";
    try {
      const res = await api.bulkUpdateIssues(id, state.selected, status);
      state.bulkDone = tr(i18n, "inbox.bulkDone", { n: res.updated });
      state.selected = [];
      await Promise.all([loadIssues(), loadProject()]);
      setTimeout(() => (state.bulkDone = ""), 2500);
    } catch (e) {
      if (await handle401(e)) return;
      state.error = errorMessage(i18n, e, "inbox.bulkFailed");
    } finally {
      state.bulkBusy = false;
    }
  });

  const s = state.stats;
  const p = state.project;
  const pages = Math.max(1, Math.ceil(state.total / PER_PAGE));
  const activeFilters: { dim: FilterDimension; value: string }[] = [
    ...(state.level ? [{ dim: "level" as const, value: state.level }] : []),
    ...(state.environment ? [{ dim: "environment" as const, value: state.environment }] : []),
    ...(state.release ? [{ dim: "release" as const, value: state.release }] : []),
  ];
  const allSelected = state.issues.length > 0 && state.selected.length === state.issues.length;
  const tz = s?.range.tz ?? p?.timezone ?? "UTC";

  return (
    <>
      <ProjectNav project={p} id={id} />
      <div class="mx-auto max-w-6xl px-4 py-6">
        {/* Filter row */}
        <div class="flex flex-wrap items-center gap-2" data-testid="filters">
          <select class="input w-auto" aria-label={tr(i18n, "overview.range")} value={state.period} onChange$={(_, el) => { state.period = el.value as IssuePeriod; state.page = 1; }}>
            {ISSUE_PERIODS.map((per) => (
              <option key={per} value={per} selected={per === state.period}>{tr(i18n, ISSUE_PERIOD_LABEL[per])}</option>
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
          <input type="search" class="input w-full sm:w-64" placeholder={tr(i18n, "inbox.searchPlaceholder")} aria-label={tr(i18n, "common.search")} value={state.q} onInput$={(_, el) => { state.q = el.value; state.page = 1; }} />
          <div class="ml-auto flex items-center gap-3 text-sm text-slate-600">
            {state.live !== null && (
              <span class="flex items-center gap-2" data-testid="live-events" title={tr(i18n, "inbox.liveHint")}>
                <span class={["inline-block h-2 w-2 rounded-full", state.live > 0 ? "animate-pulse bg-red-600" : "bg-slate-300"]} aria-hidden="true" />
                {tr(i18n, "inbox.liveNow", { n: state.live })}
              </span>
            )}
            <button type="button" class="btn-ghost text-xs" onClick$={() => (state.showStats = !state.showStats)} aria-expanded={state.showStats}>
              {state.showStats ? tr(i18n, "inbox.hideStats") : tr(i18n, "inbox.showStats")}
            </button>
          </div>
        </div>

        {(activeFilters.length > 0 || state.q) && (
          <div class="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="active-filters">
            {activeFilters.map((f) => (
              <button key={f.dim} type="button" class="badge bg-primary-100 text-primary-800 hover:bg-primary-200" onClick$={() => setFilter(f.dim, f.value)} title={tr(i18n, "overview.removeFilter")}>
                {tr(i18n, DIMENSION_LABEL[f.dim])}: {rowLabel(f.dim, f.value, i18n)} ✕
              </button>
            ))}
            {state.q && (
              <button type="button" class="badge bg-primary-100 text-primary-800 hover:bg-primary-200" onClick$={() => { state.q = ""; state.page = 1; }} title={tr(i18n, "overview.removeFilter")}>
                {tr(i18n, "common.search")}: {state.q} ✕
              </button>
            )}
            <button type="button" class="btn-ghost text-xs" onClick$={clearFilters}>
              {tr(i18n, "overview.clearFilters")}
            </button>
          </div>
        )}

        {state.error && <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

        {/* KPI strip + chart + breakdowns */}
        {state.showStats && s && (
          <div class={["transition-opacity", state.statsLoading ? "opacity-60" : ""]} data-testid="stats">
            <div class="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="kpis">
              <StatTile label={tr(i18n, "metric.events")} value={s.totals.events} previous={s.previous.events} active={state.metric === "events"} onClick$={() => (state.metric = "events")} />
              <StatTile label={tr(i18n, "metric.users")} value={s.totals.users} previous={s.previous.users} active={state.metric === "users"} onClick$={() => (state.metric = "users")} />
              <StatTile label={tr(i18n, "inbox.newIssues")} value={s.totals.issues_new} previous={s.previous.issues_new} />
              <StatTile label={tr(i18n, "inbox.openIssues")} value={s.totals.issues_open} />
            </div>

            <section class="card mt-4 p-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex gap-1 text-xs" role="tablist">
                  {METRICS.map((m) => (
                    <button key={m} type="button" role="tab" aria-selected={m === state.metric} class={["rounded-md px-2 py-1 font-medium", m === state.metric ? "bg-primary-50 text-primary-700" : "text-slate-500 hover:text-slate-800"]} onClick$={() => (state.metric = m)}>
                      {tr(i18n, METRIC_LABEL[m])}
                    </button>
                  ))}
                </div>
                <span class="text-xs text-slate-400">
                  {s.range.from.slice(0, 10) === s.range.to.slice(0, 10) ? s.range.from.slice(0, 10) : `${s.range.from.slice(0, 10)} → ${s.range.to.slice(0, 10)}`} · {tr(i18n, `interval.${s.range.interval}` as "interval.hour")} · {tz}
                </span>
              </div>
              <div class="mt-3">
                <Chart points={s.series} metric={state.metric} interval={s.range.interval} tz={tz} />
              </div>
              {s.totals.events === 0 && (
                <p class="mt-3 text-center text-sm text-slate-500">
                  {tr(i18n, "inbox.emptyRange")}{" "}
                  <Link href={`/dashboard/projects/${id}/settings`} class="font-medium text-primary-600 hover:underline">
                    {tr(i18n, "overview.emptyCta")}
                  </Link>
                </p>
              )}
            </section>

            <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {BREAKDOWNS.map((d) => (
                <BreakdownCard
                  key={d}
                  title={tr(i18n, DIMENSION_LABEL[d])}
                  dimension={d}
                  rows={s.breakdowns[d] ?? []}
                  metric={state.metric}
                  active={d === "level" ? state.level : d === "environment" ? state.environment : d === "release" ? state.release : undefined}
                  onSelect$={onBreakdownSelect}
                />
              ))}
            </div>
          </div>
        )}

        {/* Status tabs */}
        <div class="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div class="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1" role="tablist" data-testid="status-tabs">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                role="tab"
                aria-selected={st === state.status}
                class={["whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium", st === state.status ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"]}
                onClick$={() => { state.status = st; state.page = 1; state.selected = []; }}
              >
                {tr(i18n, STATUS_LABEL[st])}{" "}
                <span class="ml-1 rounded-full bg-slate-200/70 px-1.5 text-xs tabular-nums text-slate-600" data-testid={`count-${st}`}>{fmtNumber(state.counts[st], i18n.lang)}</span>
              </button>
            ))}
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            {tr(i18n, "inbox.sortBy")}
            <select class="input w-auto py-1" value={state.sort} onChange$={(_, el) => { state.sort = el.value as IssueSort; state.page = 1; }}>
              {ISSUE_SORTS.map((so) => (
                <option key={so} value={so} selected={so === state.sort}>{tr(i18n, ISSUE_SORT_LABEL[so])}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Bulk bar */}
        {(state.selected.length > 0 || state.bulkDone) && (
          <div class="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-sm" data-testid="bulk-bar">
            {state.selected.length > 0 ? (
              <>
                <span class="font-medium text-primary-900">{tr(i18n, "inbox.selected", { n: state.selected.length })}</span>
                <button type="button" class="btn-secondary py-1 text-xs" disabled={state.bulkBusy} onClick$={() => bulk("resolved")}>{tr(i18n, "issue.resolve")}</button>
                <button type="button" class="btn-secondary py-1 text-xs" disabled={state.bulkBusy} onClick$={() => bulk("ignored")}>{tr(i18n, "issue.ignore")}</button>
                <button type="button" class="btn-secondary py-1 text-xs" disabled={state.bulkBusy} onClick$={() => bulk("open")}>{tr(i18n, "issue.reopen")}</button>
                <button type="button" class="btn-ghost py-1 text-xs" onClick$={() => (state.selected = [])}>{tr(i18n, "inbox.clearSelection")}</button>
              </>
            ) : (
              <span class="text-green-700">{state.bulkDone}</span>
            )}
          </div>
        )}

        {/* Issue list */}
        <div class="card mt-3 overflow-hidden" data-testid="issues">
          {state.loading && state.issues.length === 0 ? (
            <div class="p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>
          ) : state.issues.length === 0 ? (
            <div class="p-10 text-center text-sm text-slate-500">
              {state.status === "open" && activeFilters.length === 0 && !state.q ? (
                <>
                  {p && p.counts.events_30d === 0 ? tr(i18n, "inbox.emptyNoEvents") : tr(i18n, "inbox.emptyOpen")}{" "}
                  {p && p.counts.events_30d === 0 && (
                    <Link href={`/dashboard/projects/${id}/settings`} class="font-medium text-primary-600 hover:underline">{tr(i18n, "overview.emptyCta")}</Link>
                  )}
                </>
              ) : (
                tr(i18n, "inbox.emptyFiltered")
              )}
            </div>
          ) : (
            <div class={["overflow-x-auto", state.loading ? "opacity-60" : ""]}>
              <table class="w-full text-left text-sm" data-testid="issues-table">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="w-8 px-3 py-2">
                      <input type="checkbox" aria-label={tr(i18n, "inbox.selectAll")} checked={allSelected} onChange$={toggleAll} />
                    </th>
                    <th class="px-3 py-2">{tr(i18n, "inbox.colIssue")}</th>
                    <th class="px-3 py-2 text-right">{tr(i18n, "metric.events")}</th>
                    <th class="px-3 py-2 text-right">{tr(i18n, "metric.users")}</th>
                    <th class="px-3 py-2">{tr(i18n, "inbox.colFirstSeen")}</th>
                    <th class="px-3 py-2">{tr(i18n, "inbox.colLastSeen")}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {state.issues.map((it) => {
                    const checked = state.selected.includes(it.id);
                    return (
                      <tr key={it.id} class={["hover:bg-slate-50", checked ? "bg-primary-50/60" : ""]} data-testid="issue-row" data-issue-number={it.number}>
                        <td class="px-3 py-3 align-top">
                          <input type="checkbox" aria-label={`#${it.number}`} checked={checked} onChange$={() => toggleSelect(it.id)} />
                        </td>
                        <td class="min-w-[18rem] px-3 py-3 align-top">
                          <div class="flex flex-wrap items-center gap-2">
                            <LevelBadge level={it.level} small />
                            <Link href={`/dashboard/projects/${id}/issues/${it.id}`} class="font-medium text-slate-900 hover:text-primary-700 hover:underline">
                              <span class="mr-1.5 font-mono text-xs text-slate-400">#{it.number}</span>
                              {it.title}
                            </Link>
                            {it.regressed_at && <span class="badge bg-amber-100 text-amber-800" title={tr(i18n, "issue.regressedHint")}>{tr(i18n, "issue.regressed")}</span>}
                            {it.status !== "open" && state.status === "all" && (
                              <span class="badge bg-slate-100 text-slate-600">{tr(i18n, STATUS_LABEL[it.status])}</span>
                            )}
                          </div>
                          {it.culprit && <div class="mt-0.5 truncate font-mono text-xs text-slate-500" title={it.culprit}>{it.culprit}</div>}
                          {it.environments.length > 0 && (
                            <div class="mt-1.5 flex flex-wrap gap-1">
                              {it.environments.map((env) => (
                                <button key={env} type="button" class={["badge bg-slate-100 text-[11px] text-slate-600 hover:bg-primary-100 hover:text-primary-800", state.environment === env ? "ring-1 ring-primary-400" : ""]} onClick$={() => setFilter("environment", env)}>
                                  {env}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td class="px-3 py-3 text-right align-top tabular-nums text-slate-800" title={fmtNumber(it.event_count, i18n.lang)}>{fmtCompact(it.event_count, i18n.lang)}</td>
                        <td class="px-3 py-3 text-right align-top tabular-nums text-slate-800" title={fmtNumber(it.user_count, i18n.lang)}>{fmtCompact(it.user_count, i18n.lang)}</td>
                        <td class="whitespace-nowrap px-3 py-3 align-top text-slate-500" title={it.first_seen}>{fmtRelative(it.first_seen, i18n.lang)}</td>
                        <td class="whitespace-nowrap px-3 py-3 align-top text-slate-500" title={it.last_seen}>{fmtRelative(it.last_seen, i18n.lang)}</td>
                      </tr>
                    );
                  })}
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
        <p class="mt-6 text-xs text-slate-400">{tr(i18n, "inbox.usersNote")}</p>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Issues — oops" };
