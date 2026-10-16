import { component$, useContext, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { useLocation, useNavigate, type DocumentHead } from "@builder.io/qwik-city";
import { api, ApiRequestError } from "../../../../../../lib/api";
import { errorMessage } from "../../../../../../lib/errors";
import { FeaturesContext } from "../../../../../../lib/features";
import { fmtNumber, timezones } from "../../../../../../lib/stats";
import { Switch } from "../../../../../../components/switch";
import { ProjectNav } from "../../../../../../components/project-nav";
import { tr, useI18n } from "../../../../../../i18n";
import type { Project, ProjectPatch } from "../../../../../../lib/types";

const APP_URL = (import.meta.env.VITE_APP_URL || "https://oops.3m4.net").replace(/\/$/, "");
const API_URL = /^https?:\/\//.test(import.meta.env.VITE_API_URL || "") ? (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") : `${APP_URL}/api`;

type SnippetKind = "script" | "pixel" | "events" | "curl";

export function snippet(kind: SnippetKind, key: string): string {
  switch (kind) {
    case "script":
      return `<script defer src="${APP_URL}/m.js" data-key="${key}"></script>`;
    case "pixel":
      return `<img src="${API_URL}/collect/pixel.gif?k=${key}&u=/newsletter/october" alt="" width="1" height="1" style="position:absolute;left:-9999px">`;
    case "events":
      return `// after the script tag has loaded
oops.track("signup", { plan: "pro" });

// or declaratively, no JavaScript needed
<button data-oops-event="cta_click" data-oops-props='{"where":"hero"}'>Start</button>`;
    case "curl":
      return `curl -X POST ${API_URL}/collect \\
  -H "X-Project-Key: ${key}" -H "Content-Type: application/json" \\
  -H "User-Agent: my-backend/1.0" \\
  -d '{"n": "purchase", "u": "https://myapp.example.com/checkout", "p": {"amount": 42}, "s": "api"}'`;
  }
}

export default component$(() => {
  const loc = useLocation();
  const nav = useNavigate();
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const id = loc.params.id;

  const state = useStore<{
    project: Project | null;
    loading: boolean;
    error: string;
    saved: string;
    busy: string;
    copied: string;
    snippet: SnippetKind;
    rotateArmed: boolean;
    deleteText: string;
    purgeArmed: boolean;
    purged: number | null;
    tzOptions: string[];
    // editable fields
    name: string;
    description: string;
    url: string;
    timezone: string;
    origins: string;
  }>({
    project: null,
    loading: true,
    error: "",
    saved: "",
    busy: "",
    copied: "",
    snippet: "script",
    rotateArmed: false,
    deleteText: "",
    purgeArmed: false,
    purged: null,
    tzOptions: [],
    name: "",
    description: "",
    url: "",
    timezone: "UTC",
    origins: "",
  });

  const apply = $((p: Project) => {
    state.project = p;
    state.name = p.name;
    state.description = p.description ?? "";
    state.url = p.url ?? "";
    state.timezone = p.timezone;
    state.origins = p.allowed_origins.join("\n");
  });

  const load = $(async () => {
    state.loading = true;
    state.error = "";
    try {
      await apply(await api.getProject(id));
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 401) {
        nav("/login");
        return;
      }
      state.error = errorMessage(i18n, e, "psettings.loadFailed");
    } finally {
      state.loading = false;
    }
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    state.tzOptions = timezones();
    load();
  });

  const save = $(async (patch: ProjectPatch, busy: string) => {
    state.busy = busy;
    state.error = "";
    state.saved = "";
    try {
      await apply(await api.updateProject(id, patch));
      state.saved = busy;
      setTimeout(() => (state.saved = ""), 1500);
    } catch (e) {
      state.error = errorMessage(i18n, e, "psettings.saveFailed");
    } finally {
      state.busy = "";
    }
  });

  const copy = $(async (text: string, which: string) => {
    try {
      await navigator.clipboard.writeText(text);
      state.copied = which;
      setTimeout(() => (state.copied = ""), 1500);
    } catch {
      /* clipboard unavailable */
    }
  });

  const rotate = $(async () => {
    if (!state.rotateArmed) {
      state.rotateArmed = true;
      return;
    }
    state.busy = "rotate";
    state.rotateArmed = false;
    try {
      const res = await api.rotateProjectKey(id);
      if (state.project) state.project = { ...state.project, public_key: res.public_key, public_key_prefix: res.public_key_prefix };
    } catch (e) {
      state.error = errorMessage(i18n, e, "psettings.rotateFailed");
    } finally {
      state.busy = "";
    }
  });

  const purge = $(async () => {
    if (!state.purgeArmed) {
      state.purgeArmed = true;
      return;
    }
    state.busy = "purge";
    state.purgeArmed = false;
    try {
      const res = await api.purgeEvents(id);
      state.purged = res.deleted;
      await load();
    } catch (e) {
      state.error = errorMessage(i18n, e, "psettings.purgeFailed");
    } finally {
      state.busy = "";
    }
  });

  const remove = $(async () => {
    if (!state.project || state.deleteText !== state.project.key) return;
    state.busy = "delete";
    try {
      await api.deleteProject(id);
      await nav("/dashboard");
    } catch (e) {
      state.error = errorMessage(i18n, e, "psettings.deleteProjectFailed");
      state.busy = "";
    }
  });

  const p = state.project;
  const key = p?.public_key ?? "oops_pub_…";
  const kinds: { kind: SnippetKind; label: string }[] = [
    { kind: "script", label: tr(i18n, "psettings.snippetScript") },
    { kind: "pixel", label: tr(i18n, "psettings.snippetPixel") },
    { kind: "events", label: tr(i18n, "psettings.snippetEvents") },
    { kind: "curl", label: tr(i18n, "psettings.snippetApi") },
  ];

  return (
    <>
      <ProjectNav project={p} id={id} />
      <div class="mx-auto max-w-4xl space-y-8 px-4 py-6">
        {state.error && <div class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</div>}
        {state.loading && <div class="card p-10 text-center text-sm text-slate-400">{tr(i18n, "common.loading")}</div>}

        {p && (
          <>
            {/* Install */}
            <section class="card p-6" id="install">
              <h2 class="text-lg font-semibold text-slate-900">{tr(i18n, "psettings.installTitle")}</h2>
              <p class="mt-1 text-sm text-slate-600">{tr(i18n, "psettings.installBody")}</p>
              <div class="mt-4">
                <div class="label">{tr(i18n, "psettings.publicKey")}</div>
                <div class="flex flex-wrap items-center gap-2">
                  <code class="flex-1 overflow-x-auto rounded bg-slate-100 px-3 py-2 text-sm text-slate-800" data-testid="public-key" data-public-key={key}>{key}</code>
                  <button type="button" class="btn-secondary" onClick$={() => copy(key, "key")}>
                    {state.copied === "key" ? tr(i18n, "common.copied") : tr(i18n, "common.copy")}
                  </button>
                  <button type="button" class={state.rotateArmed ? "btn bg-amber-500 text-white hover:bg-amber-600" : "btn-ghost"} disabled={state.busy === "rotate"} onClick$={rotate}>
                    {state.rotateArmed ? tr(i18n, "psettings.rotateConfirm") : tr(i18n, "psettings.rotate")}
                  </button>
                  {state.rotateArmed && <button type="button" class="btn-ghost" onClick$={() => (state.rotateArmed = false)}>{tr(i18n, "common.cancel")}</button>}
                </div>
                <p class="mt-1 text-xs text-slate-500">{tr(i18n, "psettings.publicKeyHint")}</p>
              </div>
              <div class="mt-5 flex flex-wrap gap-1">
                {kinds.map((k) => (
                  <button key={k.kind} type="button" class={["rounded-lg px-3 py-1.5 text-sm font-medium", state.snippet === k.kind ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-100"]} onClick$={() => (state.snippet = k.kind)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <div class="relative mt-2">
                <pre class="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-100 p-3 text-xs leading-relaxed" data-testid="snippet"><code>{snippet(state.snippet, key)}</code></pre>
                <button type="button" class="btn-secondary absolute right-2 top-2 px-2 py-1 text-xs" onClick$={() => copy(snippet(state.snippet, key), "snippet")}>
                  {state.copied === "snippet" ? tr(i18n, "common.copied") : tr(i18n, "common.copy")}
                </button>
              </div>
              <p class="mt-2 text-xs text-slate-500">
                {state.snippet === "script" ? tr(i18n, "psettings.snippetScriptHint") : state.snippet === "pixel" ? tr(i18n, "psettings.snippetPixelHint") : state.snippet === "events" ? tr(i18n, "psettings.snippetEventsHint") : tr(i18n, "psettings.snippetApiHint")}{" "}
                <a href="/info/docs" class="text-primary-600 hover:underline">/info/docs</a>
              </p>
            </section>

            {/* Tracking */}
            <section class="card p-6" id="tracking">
              <h2 class="text-lg font-semibold text-slate-900">{tr(i18n, "psettings.trackingTitle")}</h2>
              <p class="mt-1 text-sm text-slate-600">{tr(i18n, "psettings.trackingBody")}</p>
              <div class="mt-4 grid gap-3 sm:grid-cols-2">
                <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <span>
                    <span class="font-medium text-slate-800">{tr(i18n, "psettings.collectEnabled")}</span>
                    {!features["collect-api"] && <span class="ml-2 badge bg-amber-100 text-amber-800">{tr(i18n, "psettings.featureOff")}</span>}
                  </span>
                  <Switch checked={p.collect_enabled} label={tr(i18n, "psettings.collectEnabled")} disabled={!!state.busy} onToggle$={(next) => save({ collect_enabled: next }, "collect")} />
                </label>
                <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <span class="font-medium text-slate-800">{tr(i18n, "psettings.excludeBots")}</span>
                  <Switch checked={p.exclude_bots} label={tr(i18n, "psettings.excludeBots")} disabled={!!state.busy} onToggle$={(next) => save({ exclude_bots: next }, "bots")} />
                </label>
                <label class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm sm:col-span-2">
                  <span>
                    <span class="font-medium text-slate-800">{tr(i18n, "psettings.storeIp")}</span>
                    <span class="mt-0.5 block text-xs text-slate-500">{tr(i18n, "psettings.storeIpHint")}</span>
                  </span>
                  <Switch checked={p.store_ip} label={tr(i18n, "psettings.storeIp")} disabled={!!state.busy} onToggle$={(next) => save({ store_ip: next }, "ip")} />
                </label>
              </div>
              {!features.geo && <p class="mt-3 text-xs text-amber-700">{tr(i18n, "psettings.geoOff")}</p>}
              <form class="mt-4 space-y-4" preventdefault:submit onSubmit$={() => save({ timezone: state.timezone.trim() || "UTC", allowed_origins: state.origins.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) }, "tracking")}>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="label" for="tz">{tr(i18n, "dash.timezone")}</label>
                    <input id="tz" type="text" class="input" {...({ list: "tz-list" } as Record<string, string>)} value={state.timezone} onInput$={(_, el) => (state.timezone = el.value)} />
                    <datalist id="tz-list">
                      {state.tzOptions.map((z) => <option key={z} value={z} />)}
                    </datalist>
                    <p class="mt-1 text-xs text-slate-400">{tr(i18n, "dash.timezoneHint")}</p>
                  </div>
                  <div>
                    <label class="label" for="origins">{tr(i18n, "psettings.allowedOrigins")}</label>
                    <textarea id="origins" class="input font-mono text-xs" rows={3} placeholder={"myapp.example.com\n*.example.com"} value={state.origins} onInput$={(_, el) => (state.origins = el.value)} />
                    <p class="mt-1 text-xs text-slate-400">{tr(i18n, "psettings.allowedOriginsHint")}</p>
                  </div>
                </div>
                <div class="flex justify-end">
                  <button type="submit" class="btn-primary" disabled={!!state.busy}>
                    {state.busy === "tracking" ? tr(i18n, "common.saving") : state.saved === "tracking" ? tr(i18n, "common.saved") : tr(i18n, "common.save")}
                  </button>
                </div>
              </form>
            </section>

            {/* Project info */}
            <section class="card p-6">
              <h2 class="text-lg font-semibold text-slate-900">{tr(i18n, "psettings.infoTitle")}</h2>
              <form class="mt-4 space-y-4" preventdefault:submit onSubmit$={() => save({ name: state.name.trim(), description: state.description.trim() || null, url: state.url.trim() || null }, "info")}>
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label class="label" for="pname">{tr(i18n, "common.name")}</label>
                    <input id="pname" type="text" required class="input" value={state.name} onInput$={(_, el) => (state.name = el.value)} />
                  </div>
                  <div>
                    <label class="label" for="purl">{tr(i18n, "dash.projectUrl")}</label>
                    <input id="purl" type="url" class="input" value={state.url} onInput$={(_, el) => (state.url = el.value)} />
                  </div>
                </div>
                <div>
                  <label class="label" for="pdesc">{tr(i18n, "common.description")}</label>
                  <textarea id="pdesc" class="input" rows={2} value={state.description} onInput$={(_, el) => (state.description = el.value)} />
                </div>
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs text-slate-400">{tr(i18n, "common.key")}: {p.key}</span>
                  <button type="submit" class="btn-primary" disabled={!!state.busy}>
                    {state.busy === "info" ? tr(i18n, "common.saving") : state.saved === "info" ? tr(i18n, "common.saved") : tr(i18n, "common.save")}
                  </button>
                </div>
              </form>
            </section>

            {/* Danger zone */}
            <section class="card border-red-200 p-6">
              <h2 class="text-lg font-semibold text-red-700">{tr(i18n, "psettings.dangerTitle")}</h2>
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <div class="font-medium text-slate-800">{tr(i18n, "psettings.purgeTitle")}</div>
                  <div class="text-xs text-slate-500">
                    {tr(i18n, "psettings.purgeBody")}
                    {state.purged !== null && <span class="ml-1 text-green-700">{tr(i18n, "psettings.purged", { n: fmtNumber(state.purged, i18n.lang) })}</span>}
                  </div>
                </div>
                <div class="flex gap-2">
                  <button type="button" class={state.purgeArmed ? "btn bg-red-600 text-white hover:bg-red-700" : "btn-ghost text-red-600"} disabled={state.busy === "purge"} onClick$={purge}>
                    {state.purgeArmed ? tr(i18n, "psettings.purgeConfirm") : tr(i18n, "psettings.purge")}
                  </button>
                  {state.purgeArmed && <button type="button" class="btn-ghost" onClick$={() => (state.purgeArmed = false)}>{tr(i18n, "common.cancel")}</button>}
                </div>
              </div>
              <p class="mt-4 text-sm text-slate-600">{tr(i18n, "psettings.dangerBody")}</p>
              <form class="mt-3 flex flex-wrap items-end gap-3" preventdefault:submit onSubmit$={remove}>
                <div class="flex-1">
                  <label class="label" for="delkey">{tr(i18n, "psettings.deleteProjectConfirm")}</label>
                  <input id="delkey" type="text" class="input font-mono" placeholder={p.key} value={state.deleteText} onInput$={(_, el) => (state.deleteText = el.value)} autoComplete="off" />
                </div>
                <button type="submit" class="btn bg-red-600 text-white hover:bg-red-700" disabled={state.deleteText !== p.key || state.busy === "delete"}>
                  {state.busy === "delete" ? tr(i18n, "common.deleting") : tr(i18n, "psettings.deleteProject")}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </>
  );
});

export const head: DocumentHead = { title: "Project settings — oops" };
