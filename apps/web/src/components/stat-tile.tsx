import { component$ } from "@builder.io/qwik";
import { deltaPct, fmtCompact, fmtNumber, fmtPct } from "../lib/stats";
import { tr, useI18n } from "../i18n";

/**
 * Headline number with an optional delta against the previous period. The
 * delta colour follows direction (up is good for traffic); the value wears
 * text ink, never the series colour.
 */
export const StatTile = component$<{ label: string; value: number; previous?: number; active?: boolean; onClick$?: () => void }>(
  ({ label, value, previous, active, onClick$ }) => {
    const i18n = useI18n();
    const delta = previous === undefined ? undefined : deltaPct(value, previous);
    const body = (
      <>
        <div class="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div class="mt-1 text-2xl font-bold text-slate-900" title={fmtNumber(value, i18n.lang)}>
          {fmtCompact(value, i18n.lang)}
        </div>
        {delta !== undefined && (
          <div class="mt-1 text-xs" title={tr(i18n, "overview.vsPrevious")}>
            {delta === null ? (
              <span class="text-slate-400">—</span>
            ) : (
              <span class={delta > 0 ? "text-green-700" : delta < 0 ? "text-red-700" : "text-slate-500"}>
                {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} {fmtPct(delta, i18n.lang)}
              </span>
            )}
            <span class="ml-1 text-slate-400">{tr(i18n, "overview.vsPreviousShort")}</span>
          </div>
        )}
      </>
    );
    if (onClick$) {
      return (
        <button type="button" class={["card p-4 text-left", active ? "ring-2 ring-primary-600" : "hover:border-primary-300"]} onClick$={onClick$} aria-pressed={!!active}>
          {body}
        </button>
      );
    }
    return <div class="card p-4">{body}</div>;
  },
);
