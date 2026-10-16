import { component$, useContext, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { Link, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../lib/api";
import { capture } from "../../../lib/analytics";
import { errorMessage, isLimitError } from "../../../lib/errors";
import { browserTz, fmtCompact, fmtRelative, isLive, slugify, timezones } from "../../../lib/stats";
import { UsageBar } from "../../../components/usage-bar";
import { EarlyAccessBanner } from "../../../components/early-access-banner";
import { Modal } from "../../../components/modal";
import { FeaturesContext } from "../../../lib/features";
import { tr, useI18n } from "../../../i18n";
import type { MeResponse, Project } from "../../../lib/types";

/** Projects: one card per app with open issues, events 24h / 30d and the last event. */
export default component$(() => {
  const nav = useNavigate();
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const state = useStore<{
    projects: Project[];
    me: MeResponse | null;
    loading: boolean;
    loadError: string;
    q: string;
  }>({ projects: [], me: null, loading: true, loadError: "", q: "" });

  const form = useStore({
    open: false,
    name: "",
    key: "",
    keyTouched: false,
    url: "",
    timezone: "UTC",
    tzOptions: [] as string[],
    submitting: false,
    error: "",
    limitReached: false,
  });

  const load = $(async () => {
    state.loading = true;
    state.loadError = "";
    try {
      const [me, projects] = await Promise.all([api.me(), api.listProjects()]);
      state.me = me;
      state.projects = projects.items;
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.loadError = errorMessage(i18n, e, "dash.loadFailed");
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    form.timezone = browserTz();
    form.tzOptions = timezones();
    load();
  });

  const createProject = $(async () => {
    form.error = "";
    form.limitReached = false;
    form.submitting = true;
    try {
      const project = await api.createProject({
        name: form.name.trim(),
        key: form.key.trim() || undefined,
        url: form.url.trim() || undefined,
        timezone: form.timezone || undefined,
      });
      capture("project_created");
      form.open = false;
      form.name = "";
      form.key = "";
      form.keyTouched = false;
      form.url = "";
      // Land on settings: that is where the public key and the SDK snippet live.
      await nav(`/dashboard/projects/${project.id}/settings`);
    } catch (e) {
      form.limitReached = isLimitError(e);
      form.error = errorMessage(i18n, e, "dash.createFailed");
    } finally {
      form.submitting = false;
    }
  });

  const closeDialog = $(() => {
    form.open = false;
    form.error = "";
  });

  const limits = state.me?.limits;
  const usage = state.me?.usage;
  const q = state.q.trim().toLowerCase();
  const visible = q
    ? state.projects.filter((p) => `${p.name} ${p.key} ${p.description ?? ""} ${p.url ?? ""}`.toLowerCase().includes(q))
    : state.projects;
  const eventsLimit = limits?.events_per_month ?? -1;
  const overage = !!usage && eventsLimit >= 0 && usage.events > eventsLimit;

  return (
    <div class="mx-auto max-w-6xl px-4 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "dash.title")}</h1>
          {state.me && (
            <p class="text-sm text-slate-500">
              {state.me.account.name} ·{" "}
              {features["early-access"] ? (
                <span>{tr(i18n, "dash.earlyAccess")}</span>
              ) : (
                <>
                  <span class="capitalize">{state.me.account.plan}</span> {tr(i18n, "dash.planSuffix")}
                </>
              )}
            </p>
          )}
        </div>
        <div class="flex items-center gap-2">
          {features.billing && !features["early-access"] && (
            <Link href="/dashboard/billing" class="btn-secondary">
              {tr(i18n, "dash.upgradePlan")}
            </Link>
          )}
          <button type="button" class="btn-primary" onClick$={() => (form.open = true)}>
            {tr(i18n, "dash.newProject")}
          </button>
        </div>
      </div>

      <div class="mt-4">
        <EarlyAccessBanner />
      </div>

      {/* Usage */}
      {limits && usage && (
        <div class="mt-6 grid gap-6 sm:grid-cols-2">
          <div class="card p-5">
            <UsageBar
              label={tr(i18n, "dash.usageProjects")}
              used={state.me?.counts?.projects ?? usage.counts?.projects ?? state.projects.length}
              limit={limits.projects}
            />
          </div>
          <div class="card p-5">
            <UsageBar label={tr(i18n, "dash.usageEvents")} used={usage.events} limit={limits.events_per_month} />
            {overage ? (
              <p class="mt-2 text-xs text-amber-700">{tr(i18n, "dash.eventsOverage", { n: fmtCompact(usage.events_dropped, i18n.lang) })}</p>
            ) : (
              <p class="mt-2 text-xs text-slate-400">{tr(i18n, "dash.usageIngestHint")}</p>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {state.projects.length > 0 && (
        <div class="mt-6">
          <input
            type="search"
            class="input sm:max-w-sm"
            placeholder={tr(i18n, "dash.searchPlaceholder")}
            aria-label={tr(i18n, "common.search")}
            value={state.q}
            onInput$={(_, el) => (state.q = el.value)}
          />
        </div>
      )}

      {/* Projects grid */}
      <div class="mt-6">
        {state.loading ? (
          <div class="card p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>
        ) : state.loadError ? (
          <div class="card p-10 text-center text-sm text-red-600">
            {state.loadError}{" "}
            <button type="button" class="font-medium underline" onClick$={load}>
              {tr(i18n, "common.retry")}
            </button>
          </div>
        ) : state.projects.length === 0 ? (
          <div class="card p-10 text-center text-sm text-slate-500">{tr(i18n, "dash.emptyIssues")}</div>
        ) : visible.length === 0 ? (
          <div class="card p-10 text-center text-sm text-slate-500">{tr(i18n, "dash.noMatch")}</div>
        ) : (
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const live = isLive(p.counts.last_event_at);
              const open = p.counts.open_issues;
              return (
                <Link key={p.id} href={`/dashboard/projects/${p.id}`} class="card flex flex-col p-5 hover:border-primary-300" data-testid="project-card">
                  <div class="flex items-start justify-between gap-2">
                    <h2 class="font-semibold text-slate-900">{p.name}</h2>
                    <span class="font-mono text-xs text-slate-500">{p.key}</span>
                  </div>
                  {(p.description || p.url) && (
                    <p class="mt-1 line-clamp-2 text-sm text-slate-600">{p.description || p.url}</p>
                  )}
                  <div class="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div class={["text-lg font-bold", open > 0 ? "text-red-700" : "text-slate-900"]}>{fmtCompact(open, i18n.lang)}</div>
                      <div class="text-xs text-slate-500">{tr(i18n, "dash.openIssues")}</div>
                    </div>
                    <div>
                      <div class="text-lg font-bold text-slate-900">{fmtCompact(p.counts.events_24h, i18n.lang)}</div>
                      <div class="text-xs text-slate-500">{tr(i18n, "dash.events24h")}</div>
                    </div>
                    <div>
                      <div class="text-lg font-bold text-slate-900">{fmtCompact(p.counts.events_30d, i18n.lang)}</div>
                      <div class="text-xs text-slate-500">{tr(i18n, "dash.events30d")}</div>
                    </div>
                  </div>
                  <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {!p.ingest_enabled ? (
                      <span class="badge bg-amber-100 text-amber-800">{tr(i18n, "pnav.paused")}</span>
                    ) : live ? (
                      <span class="badge bg-green-100 text-green-800">
                        <span class="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden="true" />
                        {tr(i18n, "pnav.live")}
                      </span>
                    ) : p.counts.last_event_at ? (
                      <span class="badge bg-slate-100 text-slate-600" title={p.counts.last_event_at}>
                        {tr(i18n, "dash.lastEvent", { when: fmtRelative(p.counts.last_event_at, i18n.lang) })}
                      </span>
                    ) : (
                      <span class="badge bg-slate-100 text-slate-600">{tr(i18n, "dash.noEventsYet")}</span>
                    )}
                    <span class="ml-auto font-medium text-primary-600">{tr(i18n, "dash.openProject")}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Create project dialog */}
      <Modal open={form.open} title={tr(i18n, "dash.newProject")} onClose$={closeDialog}>
        <form class="space-y-4" preventdefault:submit onSubmit$={createProject}>
          {form.error && (
            <div
              class={[
                "rounded-lg border px-3 py-2 text-sm",
                form.limitReached ? "border-amber-300 bg-amber-50 text-amber-800" : "border-red-200 bg-red-50 text-red-700",
              ]}
            >
              {form.error}{" "}
              {form.limitReached && features.billing && !features["early-access"] && (
                <Link href="/dashboard/billing" class="font-semibold underline">
                  {tr(i18n, "limit.upgrade")}
                </Link>
              )}
            </div>
          )}
          <div>
            <label class="label" for="pname">
              {tr(i18n, "dash.projectName")}
            </label>
            <input
              id="pname"
              type="text"
              required
              class="input"
              placeholder={tr(i18n, "dash.projectNamePlaceholder")}
              value={form.name}
              onInput$={(_, el) => {
                form.name = el.value;
                if (!form.keyTouched) form.key = slugify(el.value);
              }}
            />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="label" for="pkey">
                {tr(i18n, "dash.projectKey")} <span class="text-slate-400">{tr(i18n, "common.optional")}</span>
              </label>
              <input
                id="pkey"
                type="text"
                class="input font-mono"
                pattern="[a-z0-9][a-z0-9-]{0,62}"
                placeholder={tr(i18n, "dash.projectKeyPlaceholder")}
                value={form.key}
                onInput$={(_, el) => {
                  form.key = el.value;
                  form.keyTouched = true;
                }}
              />
              <p class="mt-1 text-xs text-slate-400">{tr(i18n, "dash.projectKeyHint")}</p>
            </div>
            <div>
              <label class="label" for="ptz">
                {tr(i18n, "dash.timezone")}
              </label>
              <input id="ptz" type="text" class="input" {...({ list: "tz-list" } as Record<string, string>)} value={form.timezone} onInput$={(_, el) => (form.timezone = el.value)} />
              <datalist id="tz-list">
                {form.tzOptions.map((z) => <option key={z} value={z} />)}
              </datalist>
              <p class="mt-1 text-xs text-slate-400">{tr(i18n, "dash.timezoneHint")}</p>
            </div>
          </div>
          <div>
            <label class="label" for="purl">
              {tr(i18n, "dash.projectUrl")} <span class="text-slate-400">{tr(i18n, "common.optional")}</span>
            </label>
            <input
              id="purl"
              type="url"
              class="input"
              placeholder="https://myapp.example.com"
              value={form.url}
              onInput$={(_, el) => (form.url = el.value)}
            />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn-secondary" onClick$={closeDialog}>
              {tr(i18n, "common.cancel")}
            </button>
            <button type="submit" class="btn-primary" disabled={form.submitting}>
              {form.submitting ? tr(i18n, "common.creating") : tr(i18n, "dash.createProject")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
});

export const head: DocumentHead = { title: "Projects — oops" };
