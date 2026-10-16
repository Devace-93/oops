import { component$, type QRL } from "@builder.io/qwik";
import type { Period } from "../lib/types";
import { PERIODS, PERIOD_LABEL } from "../lib/stats";
import { tr, useI18n } from "../i18n";

/**
 * The one filter row above the charts: period presets first, then a custom
 * from / to pair. Everything below re-renders against the same slice.
 */
interface Props {
  period: Period | "";
  from: string;
  to: string;
  tz: string;
  onPeriod$: QRL<(p: Period) => void>;
  onCustom$: QRL<(from: string, to: string) => void>;
}

export const RangePicker = component$<Props>(({ period, from, to, tz, onPeriod$, onCustom$ }) => {
  const i18n = useI18n();
  return (
    <div class="flex flex-wrap items-center gap-2" data-testid="range-picker">
      <div class="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1" role="group" aria-label={tr(i18n, "overview.range")}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            class={["rounded-md px-2.5 py-1 text-sm font-medium", period === p ? "bg-white text-primary-700 shadow-sm" : "text-slate-600 hover:text-slate-900"]}
            aria-pressed={period === p}
            onClick$={() => onPeriod$(p)}
          >
            {tr(i18n, PERIOD_LABEL[p])}
          </button>
        ))}
      </div>
      <div class="flex items-center gap-1 text-sm text-slate-600">
        <input type="date" class="input w-auto py-1" aria-label={tr(i18n, "overview.from")} value={from} max={to || undefined} onChange$={(_, el) => onCustom$(el.value, to)} />
        <span>→</span>
        <input type="date" class="input w-auto py-1" aria-label={tr(i18n, "overview.to")} value={to} min={from || undefined} onChange$={(_, el) => onCustom$(from, el.value)} />
      </div>
      <span class="text-xs text-slate-400" title={tr(i18n, "overview.tzHint")}>
        {tz}
      </span>
    </div>
  );
});
