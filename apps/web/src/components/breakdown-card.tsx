import { component$, type QRL } from "@builder.io/qwik";
import type { BreakdownRow, Dimension, Metric } from "../lib/types";
import { DEVICE_ICON, DEVICE_LABEL, DIRECT, countryName, flag, fmtNumber, languageName } from "../lib/stats";
import { tr, useI18n } from "../i18n";
import type { CatalogKey } from "../i18n/catalog/en";

/**
 * One breakdown list (top pages, referrers, countries …): label, a proportional
 * bar wash behind it, the count on the right. Clicking a row filters the
 * whole page on that value; "View all" opens the paginated table.
 */
interface Props {
  title: string;
  dimension: Dimension;
  rows: BreakdownRow[];
  metric: Metric;
  active?: string;
  onSelect$?: QRL<(dimension: Dimension, value: string) => void>;
  onViewAll$?: QRL<(dimension: Dimension) => void>;
  emptyKey?: CatalogKey;
}

export function rowLabel(dimension: Dimension, value: string, lang: string, i18n: Parameters<typeof tr>[0]): string {
  if (dimension === "referrer" && value === DIRECT) return tr(i18n, "dim.direct");
  if (dimension === "country") return `${flag(value)} ${countryName(value, lang)}`;
  if (dimension === "device") return `${DEVICE_ICON[value] ?? ""} ${tr(i18n, DEVICE_LABEL[value as keyof typeof DEVICE_LABEL] ?? "device.desktop")}`;
  if (dimension === "lang") return languageName(value, lang) || value;
  return value;
}

export const BreakdownCard = component$<Props>(({ title, dimension, rows, metric, active, onSelect$, onViewAll$, emptyKey }) => {
  const i18n = useI18n();
  const max = Math.max(...rows.map((r) => r[metric]), 1);
  return (
    <section class="card flex flex-col p-4" data-breakdown={dimension}>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">{title}</h3>
        <span class="text-xs text-slate-400">{tr(i18n, metric === "pageviews" ? "metric.pageviews" : metric === "events" ? "metric.events" : "metric.visitors")}</span>
      </div>
      {rows.length === 0 ? (
        <p class="mt-4 text-sm text-slate-400">{tr(i18n, emptyKey ?? "overview.noData")}</p>
      ) : (
        <ul class="mt-3 space-y-1">
          {rows.map((r) => {
            const label = rowLabel(dimension, r.value, i18n.lang, i18n);
            const pct = Math.round((r[metric] / max) * 100);
            const isActive = active === r.value;
            return (
              <li key={r.value}>
                <button
                  type="button"
                  class={["relative flex w-full items-center justify-between gap-3 rounded px-2 py-1 text-left text-sm hover:bg-slate-50", isActive ? "ring-1 ring-primary-400" : ""]}
                  title={label}
                  onClick$={() => onSelect$?.(dimension, r.value)}
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
      {onViewAll$ && rows.length > 0 && (
        <button type="button" class="mt-3 self-start text-xs font-medium text-primary-600 hover:underline" onClick$={() => onViewAll$(dimension)}>
          {tr(i18n, "overview.viewAll")} →
        </button>
      )}
    </section>
  );
});
