import { component$, useStore, useTask$, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../../lib/api";
import { errorMessage } from "../../../../../../lib/errors";
import { DEVICE_ICON, PERIODS, PERIOD_LABEL, countryName, flag, fmtDateTime, fmtNumber, shortUrl } from "../../../../../../lib/stats";
import { ProjectNav } from "../../../../../../components/project-nav";
import { tr, useI18n } from "../../../../../../i18n";
import type { EventKind, EventRow, Period, Project } from "../../../../../../lib/types";

const PER_PAGE = 50;

/** Raw event log: one row per page view / custom event, newest first. */
export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const i18n = useI18n();
  const id = loc.params.id;

  const state = useStore<{
    project: Project | null;
    items: EventRow[];
    total: number;
    page: number;
    loading: boolean;
    error: string;
    period: Period;
    kind: EventKind | "";
    q: string;
    expanded: number | null;
  }>({ project: null, items: [], total: 0, page: 1, loading: true, error: "", period: "7d", kind: "", q: "", expanded: null });

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      const res = await api.events(id, { period: state.period }, { page: state.page, per_page: PER_PAGE, kind: state.kind, q: state.q.trim() || undefined });
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
  });

  // Reload on filter changes (the first load is the visible task above: a
  // tracking task does not re-run on hydration).
  useTask$(({ track, cleanup }) => {
    const key = track(() => [state.period, state.kind, state.q, state.page].join("|"));
    if (typeof window === "undefined" || key === "7d||" + "|1") return;
    const t = setTimeout(() => load(), state.q ? 300 : 0);
    cleanup(() => clearTimeout(t));
  });

  const pages = Math.max(1, Math.ceil(state.total / PER_PAGE));

  return (
    <>
      <ProjectNav project={state.project} id={id} />
      <div class="mx-auto max-w-6xl px-4 py-6">
        <div class="flex flex-wrap items-center gap-2">
          <select class="input w-auto" aria-label={tr(i18n, "overview.range")} value={state.period} onChange$={(_, el) => { state.period = el.value as Period; state.page = 1; }}>
            {PERIODS.map((p) => (
              <option key={p} value={p} selected={p === state.period}>{tr(i18n, PERIOD_LABEL[p])}</option>
            ))}
          </select>
          <select class="input w-auto" aria-label={tr(i18n, "events.kind")} value={state.kind} onChange$={(_, el) => { state.kind = el.value as EventKind | ""; state.page = 1; }}>
            <option value="">{tr(i18n, "events.allKinds")}</option>
            <option value="pageview" selected={state.kind === "pageview"}>{tr(i18n, "events.kindPageview")}</option>
            <option value="event" selected={state.kind === "event"}>{tr(i18n, "events.kindEvent")}</option>
          </select>
          <input type="search" class="input w-full sm:w-64" placeholder={tr(i18n, "events.searchPlaceholder")} aria-label={tr(i18n, "common.search")} value={state.q} onInput$={(_, el) => { state.q = el.value; state.page = 1; }} />
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
                    <th class="px-3 py-2">{tr(i18n, "events.colEvent")}</th>
                    <th class="px-3 py-2">{tr(i18n, "dim.path")}</th>
                    <th class="px-3 py-2">{tr(i18n, "dim.referrer")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colLocation")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colClient")}</th>
                    <th class="px-3 py-2">{tr(i18n, "events.colVisitor")}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  {state.items.map((e) => (
                    <>
                      <tr key={e.id} class="cursor-pointer hover:bg-slate-50" onClick$={() => (state.expanded = state.expanded === e.id ? null : e.id)}>
                        <td class="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDateTime(e.ts, i18n.lang)}</td>
                        <td class="px-3 py-2">
                          {e.kind === "pageview" ? (
                            <span class="badge bg-slate-100 text-slate-600">{tr(i18n, "events.kindPageview")}</span>
                          ) : (
                            <span class="badge bg-primary-100 text-primary-800">⚡ {e.name}</span>
                          )}
                        </td>
                        <td class="max-w-xs truncate px-3 py-2 font-mono text-xs text-slate-800" title={e.title ?? e.path}>{e.path}</td>
                        <td class="max-w-[12rem] truncate px-3 py-2 text-slate-600" title={e.referrer ?? ""}>{e.referrer_host ?? (e.utm_source ? `utm: ${e.utm_source}` : "—")}</td>
                        <td class="whitespace-nowrap px-3 py-2 text-slate-600" title={countryName(e.country, i18n.lang)}>
                          {e.country ? `${flag(e.country)} ${[e.city, e.country].filter(Boolean).join(", ")}` : "—"}
                        </td>
                        <td class="whitespace-nowrap px-3 py-2 text-slate-600">
                          {e.device ? `${DEVICE_ICON[e.device] ?? ""} ` : ""}{[e.browser, e.os].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td class="px-3 py-2 font-mono text-xs text-slate-400">{e.ip ? <span class="text-slate-700">{e.ip}</span> : e.visitor}</td>
                      </tr>
                      {state.expanded === e.id && (
                        <tr key={`${e.id}-x`} class="bg-slate-50">
                          <td colSpan={7} class="px-3 py-3">
                            <dl class="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
                              {e.title && (<><dt class="text-slate-500">{tr(i18n, "events.title")}</dt><dd class="text-slate-800">{e.title}</dd></>)}
                              {e.hostname && (<><dt class="text-slate-500">{tr(i18n, "dim.hostname")}</dt><dd class="text-slate-800">{e.hostname}</dd></>)}
                              {e.referrer && (<><dt class="text-slate-500">{tr(i18n, "dim.referrer")}</dt><dd class="break-all text-slate-800">{shortUrl(e.referrer)}</dd></>)}
                              {(e.utm_source || e.utm_medium || e.utm_campaign) && (<><dt class="text-slate-500">UTM</dt><dd class="text-slate-800">{[e.utm_source, e.utm_medium, e.utm_campaign].filter(Boolean).join(" / ")}</dd></>)}
                              {e.region && (<><dt class="text-slate-500">{tr(i18n, "dim.region")}</dt><dd class="text-slate-800">{e.region}</dd></>)}
                              {(e.screen_w || e.screen_h) && (<><dt class="text-slate-500">{tr(i18n, "events.screen")}</dt><dd class="text-slate-800">{e.screen_w}×{e.screen_h}</dd></>)}
                              {e.lang && (<><dt class="text-slate-500">{tr(i18n, "dim.lang")}</dt><dd class="text-slate-800">{e.lang}</dd></>)}
                              {e.ip && (<><dt class="text-slate-500">IP</dt><dd class="font-mono text-slate-800">{e.ip}</dd></>)}
                              <dt class="text-slate-500">{tr(i18n, "events.colVisitor")}</dt><dd class="font-mono text-slate-800">{e.visitor}</dd>
                              <dt class="text-slate-500">{tr(i18n, "events.source")}</dt><dd class="text-slate-800">{e.source}</dd>
                              {Object.keys(e.props || {}).length > 0 && (<><dt class="text-slate-500">{tr(i18n, "events.props")}</dt><dd><pre class="overflow-x-auto rounded bg-slate-100 p-2 text-xs">{JSON.stringify(e.props, null, 2)}</pre></dd></>)}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </>
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
        <p class="mt-6 text-xs text-slate-400">{tr(i18n, "events.privacyNote")}</p>
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Events — oops" };
