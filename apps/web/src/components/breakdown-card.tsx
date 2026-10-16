import { component$, type QRL } from "@builder.io/qwik";
import type { BreakdownRow, Dimension, Metric } from "../lib/types";
import { DEVICE_ICON, LEVEL_LABEL, fmtNumber, isFilterDimension } from "../lib/stats";
import { tr, useI18n, type I18nState } from "../i18n";
import type { CatalogKey } from "../i18n/catalog/en";

/**
 * One breakdown list (levels, environments, releases, browsers …): label, a
 * proportional bar wash behind it, the count on the right. For dimensions the
 * API accepts as filters (level / environment / release) clicking a row
 * filters the whole page on that value; `type` rows feed the search box; the
 * rest are display-only.
 */
interface Props {
  title: string;
  dimension: Dimension;
  rows: BreakdownRow[];
  metric: Metric;
  active?: string;
  onSelect$?: QRL<(dimension: Dimension, value: string) => void>;
  emptyKey?: CatalogKey;
}

export function rowLabel(dimension: Dimension, value: string, i18n: I18nState): string {
  if (dimension === "level") {
    const key = LEVEL_LABEL[value as keyof typeof LEVEL_LABEL];
    return key ? tr(i18n, key) : value;
  }
  if (dimension === "device") return `${DEVICE_ICON[value] ?? ""} ${value}`.trim();
  if (!value) return tr(i18n, "dim.none");
  return value;
}

export const BreakdownCard = component$<Props>(({ title, dimension, rows, metric, active, onSelect$, emptyKey }) => {
  const i18n = useI18n();
  const max = Math.max(...rows.map((r) => r[metric]), 1);
  const clickable = !!onSelect$ && (isFilterDimension(dimension) || dimension === "type");
  return (
    <section class="card flex flex-col p-4" data-breakdown={dimension}>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">{title}</h3>
        <span class="text-xs text-slate-400">{tr(i18n, metric === "events" ? "metric.events" : "metric.users")}</span>
      </div>
      {rows.length === 0 ? (
        <p class="mt-4 text-sm text-slate-400">{tr(i18n, emptyKey ?? "overview.noData")}</p>
      ) : (
        <ul class="mt-3 space-y-1">
          {rows.map((r) => {
            const label = rowLabel(dimension, r.value, i18n);
            const pct = Math.round((r[metric] / max) * 100);
            const isActive = active !== undefined && active === r.value;
            return (
              <li key={r.value}>
                <button
                  type="button"
                  class={[
                    "relative flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-sm",
                    clickable ? "hover:bg-slate-50" : "cursor-default",
                    isActive ? "ring-1 ring-primary-400" : "",
                  ]}
                  title={label}
                  disabled={!clickable}
                  onClick$={() => clickable && onSelect$?.(dimension, r.value)}
                >
                  <span class="absolute inset-y-0 left-0 rounded bg-primary-100/70" style={{ width: `${pct}%` }} aria-hidden="true" />
                  <span class="relative min-w-0 flex-1 truncate text-slate-800">{label}</span>
                  <span class="relative font-medium tabular-nums text-slate-700">{fmtNumber(r[metric], i18n.lang)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
});
