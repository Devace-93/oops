import { component$, useStore, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../lib/api";
import { errorMessage } from "../../../../../lib/errors";
import { DIMENSION_LABEL, OOPS, METRIC_LABEL, fmtNumber, todayIn } from "../../../../../lib/stats";
import { Chart } from "../../../../../components/chart";
import { StatTile } from "../../../../../components/stat-tile";
import { BreakdownCard, rowLabel } from "../../../../../components/breakdown-card";
import { RangePicker } from "../../../../../components/range-picker";
import { Modal } from "../../../../../components/modal";
import { ProjectNav } from "../../../../../components/project-nav";
import { tr, useI18n } from "../../../../../i18n";
import type { BreakdownRow, Dimension, Filters, Metric, Period, Project, Stats } from "../../../../../lib/types";

const LIVE_REFRESH_MS = 30_000;

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const i18n = useI18n();
  const id = loc.params.id;

  const state = useStore<{
    project: Project | null;
    stats: Stats | null;
    loading: boolean;
    error: string;
    period: Period | "";
    from: string;
    to: string;
    metric: Metric;
    filters: Filters;
    tabs: { geo: Dimension; tech: Dimension; utm: Dimension };
    tick: number;
  }>({
    project: null,
    stats: null,
    loading: true,
    error: "",
    period: "30d",
    from: "",
    to: "",
    metric: "pageviews",
    filters: {},
    tabs: { geo: "country", tech: "device", utm: "utm_source" },
    tick: 0,
  });

  const modal = useStore<{
    open: boolean;
    by: Dimension;
    items: BreakdownRow[];
    page: number;
    perPage: number;
    total: number;
    loading: boolean;
  }>({ open: false, by: "path", items: [], page: 1, perPage: 50, total: 0, loading: false });

  const loadProject = $(async () => {
    try {
      state.project = await api.getProject(id);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = errorMessage(i18n, e, "overview.loadFailed");
    }
  });

  const loadStats = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      state.stats = await api.stats(id, {
        period: state.period || undefined,
        from: state.from || undefined,
        to: state.to || undefined,
        filters: state.filters,
        limit: 8,
      });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = errorMessage(i18n, e, "overview.loadFailed");
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    loadProject();
    loadStats();
    const timer = setInterval(() => (state.tick += 1), LIVE_REFRESH_MS);
    cleanup(() => clearInterval(timer));
  });

  // Reload whenever the range or a filter changes (the first load happens in
  // the visible task above: a tracking task does not re-run on hydration).
  useTask$(({ track }) => {
    const key = track(() => [state.period, state.from, state.to, JSON.stringify(state.filters)].join("|"));
    if (typeof window === "undefined" || key === "30d|||{}") return;
    loadStats();
  });

  // Live counter refresh.
  useTask$(({ track }) => {
    track(() => state.tick);
    if (typeof window === "undefined" || !state.stats) return;
    api
      .live(id)
      .then((live) => {
        if (state.stats) state.stats = { ...state.stats, live };
      })
      .catch(() => {});
  });

  const setPeriod = $((p: Period) => {
    state.period = p;
    state.from = "";
    state.to = "";
  });

  const setCustom = $((from: string, to: string) => {
    const tz = state.project?.timezone || "UTC";
    state.from = from || todayIn(tz);
    state.to = to || todayIn(tz);
    state.period = "";
  });

  const toggleFilter = $((dimension: Dimension, value: string) => {
    const next = { ...state.filters };
    if (next[dimension] === value) delete next[dimension];
    else next[dimension] = value;
    state.filters = next;
    modal.open = false;
  });

  const clearFilter = $((dimension: Dimension) => {
    const next = { ...state.filters };
    delete next[dimension];
    state.filters = next;
  });

  const loadModal = $(async () => {
    modal.loading = true;
    try {
      const res = await api.breakdown(
        id,
        modal.by,
        { period: state.period || undefined, from: state.from || undefined, to: state.to || undefined, filters: state.filters },
        modal.page,
        modal.perPage,
      );
      modal.items = res.items;
      modal.total = res.total;
    } catch (e) {
      state.error = errorMessage(i18n, e, "overview.loadFailed");
    } finally {
      modal.loading = false;
    }
  });

  const openModal = $(async (dimension: Dimension) => {
    modal.by = dimension;
    modal.page = 1;
    modal.open = true;
    await loadModal();
  });

  const s = state.stats;
  const p = state.project;
  const prev = s?.previous;
  const activeFilters = Object.entries(state.filters) as [Dimension, string][];
  const pages = Math.max(1, Math.ceil(modal.total / modal.perPage));
  const viewsPerVisitor = s && s.totals.visitors ? Math.round((s.totals.pageviews / s.totals.visitors) * 10) / 10 : 0;

  return (
    <>
      <ProjectNav project={p} id={id} />
      <div class="mx-auto max-w-6xl px-4 py-6">
        {/* Filter row */}
        <div class="flex flex-wrap items-center justify-between gap-3">
          <RangePicker period={state.period} from={state.from} to={state.to} tz={s?.range.tz ?? p?.timezone ?? "UTC"} onPeriod$={setPeriod} onCustom$={setCustom} />
          {s && (
            <div class="flex items-center gap-2 text-sm text-slate-600" data-testid="live-visitors">
              <span class={["inline-block h-2 w-2 rounded-full", s.live.visitors > 0 ? "animate-pulse bg-green-600" : "bg-slate-300"]} aria-hidden="true" />
              {tr(i18n, "overview.liveNow", { n: s.live.visitors })}
            </div>
          )}
        </div>

        {activeFilters.length > 0 && (
          <div class="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="active-filters">
            {activeFilters.map(([dim, value]) => (
              <button key={dim} type="button" class="badge bg-primary-100 text-primary-800 hover:bg-primary-200" onClick$={() => clearFilter(dim)} title={tr(i18n, "overview.removeFilter")}>
                {tr(i18n, DIMENSION_LABEL[dim])}: {rowLabel(dim, value, i18n.lang, i18n)} ✕
              </button>
            ))}
            <button type="button" class="btn-ghost text-xs" onClick$={() => (state.filters = {})}>
              {tr(i18n, "overview.clearFilters")}
            </button>
          </div>
        )}

        {state.error && <div class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}

        {!s && state.loading && <div class="card mt-6 p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>}

        {s && (
          <div class={["transition-opacity", state.loading ? "opacity-60" : ""]}>
            {/* KPI row */}
            <div class="mt-6 grid gap-3 sm:grid-cols-4" data-testid="kpis">
              {OOPS.map((m) => (
                <StatTile key={m} label={tr(i18n, METRIC_LABEL[m])} value={s.totals[m]} previous={prev?.[m]} active={state.metric === m} onClick$={() => (state.metric = m)} />
              ))}
              <StatTile label={tr(i18n, "overview.viewsPerVisitor")} value={viewsPerVisitor} />
            </div>

            {/* Chart */}
            <section class="card mt-4 p-4">
              <div class="flex items-center justify-between">
                <h2 class="text-sm font-semibold text-slate-900">{tr(i18n, METRIC_LABEL[state.metric])}</h2>
                <span class="text-xs text-slate-400">
                  {s.range.from === s.range.to ? s.range.from : `${s.range.from} → ${s.range.to}`} · {tr(i18n, `interval.${s.range.interval}` as "interval.hour")}
                </span>
              </div>
              <div class="mt-3">
                <Chart points={s.series} metric={state.metric} interval={s.range.interval} />
              </div>
              {s.totals.pageviews === 0 && s.totals.events === 0 && (
                <p class="mt-3 text-center text-sm text-slate-500">
                  {tr(i18n, "overview.emptyRange")}{" "}
                  <Link href={`/dashboard/projects/${id}/settings`} class="font-medium text-primary-600 hover:underline">
                    {tr(i18n, "overview.emptyCta")}
                  </Link>
                </p>
              )}
            </section>

            {/* Breakdowns */}
            <div class="mt-4 grid gap-4 lg:grid-cols-2">
              <BreakdownCard title={tr(i18n, "dim.path")} dimension="path" rows={s.breakdowns.path} metric={state.metric} active={state.filters.path} onSelect$={toggleFilter} onViewAll$={openModal} />
              <BreakdownCard title={tr(i18n, "dim.referrer")} dimension="referrer" rows={s.breakdowns.referrer} metric={state.metric} active={state.filters.referrer} onSelect$={toggleFilter} onViewAll$={openModal} />
            </div>
            <div class="mt-4 grid gap-4 lg:grid-cols-3">
              <div class="flex flex-col gap-2">
                <Tabs options={["country", "region", "city"]} value={state.tabs.geo} onChange$={(d) => (state.tabs.geo = d)} />
                <BreakdownCard title={tr(i18n, DIMENSION_LABEL[state.tabs.geo])} dimension={state.tabs.geo} rows={s.breakdowns[state.tabs.geo]} metric={state.metric} active={state.filters[state.tabs.geo]} onSelect$={toggleFilter} onViewAll$={openModal} emptyKey="overview.noGeo" />
              </div>
              <div class="flex flex-col gap-2">
                <Tabs options={["device", "browser", "os"]} value={state.tabs.tech} onChange$={(d) => (state.tabs.tech = d)} />
                <BreakdownCard title={tr(i18n, DIMENSION_LABEL[state.tabs.tech])} dimension={state.tabs.tech} rows={s.breakdowns[state.tabs.tech]} metric={state.metric} active={state.filters[state.tabs.tech]} onSelect$={toggleFilter} onViewAll$={openModal} />
              </div>
              <div class="flex flex-col gap-2">
                <Tabs options={["utm_source", "utm_medium", "utm_campaign"]} value={state.tabs.utm} onChange$={(d) => (state.tabs.utm = d)} />
                <BreakdownCard title={tr(i18n, DIMENSION_LABEL[state.tabs.utm])} dimension={state.tabs.utm} rows={s.breakdowns[state.tabs.utm]} metric={state.metric} active={state.filters[state.tabs.utm]} onSelect$={toggleFilter} onViewAll$={openModal} emptyKey="overview.noUtm" />
              </div>
            </div>
            <div class={["mt-4 grid gap-4", p?.store_ip ? "lg:grid-cols-3" : "lg:grid-cols-2"]}>
              <BreakdownCard title={tr(i18n, "dim.lang")} dimension="lang" rows={s.breakdowns.lang} metric={state.metric} active={state.filters.lang} onSelect$={toggleFilter} onViewAll$={openModal} />
              <BreakdownCard title={tr(i18n, "dim.name")} dimension="name" rows={s.breakdowns.name} metric="events" active={state.filters.name} onSelect$={toggleFilter} onViewAll$={openModal} emptyKey="overview.noEvents" />
              {p?.store_ip && (
                <BreakdownCard title={tr(i18n, "dim.ip")} dimension="ip" rows={s.breakdowns.ip ?? []} metric={state.metric} active={state.filters.ip} onSelect$={toggleFilter} onViewAll$={openModal} />
              )}
            </div>

            <p class="mt-6 text-xs text-slate-400">{tr(i18n, "overview.visitorsNote")}</p>
          </div>
        )}
      </div>

      {/* Full breakdown */}
      <Modal open={modal.open} title={tr(i18n, DIMENSION_LABEL[modal.by])} onClose$={() => (modal.open = false)} wide>
        {modal.loading && modal.items.length === 0 ? (
          <div class="p-6 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>
        ) : (
          <div class={modal.loading ? "opacity-60" : ""}>
            <table class="w-full text-left text-sm">
              <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="py-2">{tr(i18n, DIMENSION_LABEL[modal.by])}</th>
                  <th class="py-2 text-right">{tr(i18n, "metric.pageviews")}</th>
                  <th class="py-2 text-right">{tr(i18n, "metric.visitors")}</th>
                  <th class="py-2 text-right">{tr(i18n, "metric.events")}</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                {modal.items.map((r) => (
                  <tr key={r.value} class="hover:bg-slate-50">
                    <td class="max-w-md truncate py-2 pr-3" title={r.value}>
                      <button type="button" class="text-left hover:text-primary-700" onClick$={() => toggleFilter(modal.by, r.value)}>
                        {rowLabel(modal.by, r.value, i18n.lang, i18n)}
                      </button>
                    </td>
                    <td class="py-2 text-right tabular-nums">{fmtNumber(r.pageviews, i18n.lang)}</td>
                    <td class="py-2 text-right tabular-nums">{fmtNumber(r.visitors, i18n.lang)}</td>
                    <td class="py-2 text-right tabular-nums">{fmtNumber(r.events, i18n.lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div class="mt-4 flex items-center justify-between text-sm text-slate-600">
                <button type="button" class="btn-secondary" disabled={modal.page <= 1} onClick$={async () => { modal.page -= 1; await loadModal(); }}>←</button>
                <span>{tr(i18n, "common.pageOf", { page: modal.page, pages, total: modal.total })}</span>
                <button type="button" class="btn-secondary" disabled={modal.page >= pages} onClick$={async () => { modal.page += 1; await loadModal(); }}>→</button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
});

/** Small segmented control that switches which dimension a card shows. */
const Tabs = component$<{ options: Dimension[]; value: Dimension; onChange$: (d: Dimension) => void }>(({ options, value, onChange$ }) => {
  const i18n = useI18n();
  return (
    <div class="flex gap-1 text-xs" role="tablist">
      {options.map((o) => (
        <button key={o} type="button" role="tab" aria-selected={o === value} class={["rounded-md px-2 py-1 font-medium", o === value ? "bg-primary-50 text-primary-700" : "text-slate-500 hover:text-slate-800"]} onClick$={() => onChange$(o)}>
          {tr(i18n, DIMENSION_LABEL[o])}
        </button>
      ))}
    </div>
  );
});

export const head: DocumentHead = { title: "Overview — oops" };
