import { component$, useSignal } from "@builder.io/qwik";
import type { Frame } from "../lib/types";
import { frameLocation } from "../lib/stats";
import { tr, useI18n } from "../i18n";

/**
 * Stack frames, top of the stack first. In-app frames are highlighted;
 * consecutive non-app frames (framework, vendor, browser internals) collapse
 * into one expandable row so the frame that matters stays in view. Falls back
 * to the raw stack string when no frame could be parsed.
 */
export const StackTrace = component$<{ frames: Frame[]; raw?: string | null }>(({ frames, raw }) => {
  const i18n = useI18n();
  const showAll = useSignal(false);
  const showRaw = useSignal(false);

  if (!frames.length) {
    return raw ? (
      <pre class="panel-dark overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{raw}</pre>
    ) : (
      <p class="text-sm text-slate-400">{tr(i18n, "issue.noStack")}</p>
    );
  }

  // Group runs of non-app frames so they can collapse together.
  type Group = { app: boolean; frames: { f: Frame; i: number }[] };
  const groups: Group[] = [];
  frames.forEach((f, i) => {
    const last = groups[groups.length - 1];
    if (last && last.app === f.in_app) last.frames.push({ f, i });
    else groups.push({ app: f.in_app, frames: [{ f, i }] });
  });
  const hasApp = frames.some((f) => f.in_app);

  return (
    <div class="overflow-hidden rounded-lg border border-slate-200" data-testid="stack-trace">
      <ol class="divide-y divide-slate-100 text-sm">
        {groups.map((g, gi) => {
          // Non-app groups collapse unless there are no in-app frames at all;
          // the group holding the top frame (the one that threw) always shows.
          const collapsed = gi > 0 && !g.app && hasApp && !showAll.value;
          if (collapsed) {
            return (
              <li key={gi} class="bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
                <button type="button" class="hover:text-primary-700 hover:underline" onClick$={() => (showAll.value = true)}>
                  {tr(i18n, "issue.hiddenFrames", { n: g.frames.length })}
                </button>
              </li>
            );
          }
          return g.frames.map(({ f, i }) => (
            <li key={i} class={["flex flex-wrap items-baseline gap-x-2 px-3 py-2", f.in_app ? "bg-white" : "bg-slate-50 text-slate-500"]} data-in-app={f.in_app}>
              <span class="w-6 shrink-0 text-right font-mono text-xs text-slate-400">{i}</span>
              <span class={["font-mono text-xs", f.in_app ? "font-semibold text-slate-900" : ""]} title={f.function ?? ""}>
                {f.function || "<anonymous>"}
              </span>
              <span class="text-xs text-slate-400">{tr(i18n, "issue.frameIn")}</span>
              <span class={["min-w-0 max-w-full truncate font-mono text-xs", f.in_app ? "text-primary-700" : ""]} title={frameLocation(f)}>
                {f.filename || "<anonymous>"}
                {f.lineno != null && (
                  <span class="text-slate-500">
                    :{f.lineno}
                    {f.colno != null ? `:${f.colno}` : ""}
                  </span>
                )}
              </span>
              {f.in_app && <span class="badge ml-auto bg-primary-50 px-1.5 text-[10px] text-primary-700">{tr(i18n, "issue.inApp")}</span>}
            </li>
          ));
        })}
      </ol>
      <div class="flex flex-wrap gap-3 border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-xs">
        {hasApp && groups.some((g, gi) => gi > 0 && !g.app) && (
          <button type="button" class="text-slate-500 hover:text-primary-700 hover:underline" onClick$={() => (showAll.value = !showAll.value)}>
            {showAll.value ? tr(i18n, "issue.collapseFrames") : tr(i18n, "issue.expandFrames")}
          </button>
        )}
        {raw && (
          <button type="button" class="text-slate-500 hover:text-primary-700 hover:underline" onClick$={() => (showRaw.value = !showRaw.value)}>
            {showRaw.value ? tr(i18n, "issue.hideRaw") : tr(i18n, "issue.showRaw")}
          </button>
        )}
      </div>
      {showRaw.value && raw && (
        <pre class="panel-dark overflow-x-auto whitespace-pre-wrap break-all bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">{raw}</pre>
      )}
    </div>
  );
});
