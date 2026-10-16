import { component$, useStore } from "@builder.io/qwik";
import type { Interval, Metric, SeriesPoint } from "../lib/types";
import { bucketLabel, fmtCompact, fmtNumber } from "../lib/stats";
import { tr, useI18n } from "../i18n";
import { METRIC_LABEL } from "../lib/stats";

/**
 * Single-series column chart (SVG, responsive via viewBox). One metric at a
 * time: columns ≤ 24px wide with a 4px rounded cap, hairline gridlines with
 * compact tick labels, a per-column hover / focus tooltip and a hidden table
 * for assistive tech. No legend: the title names the one series.
 */
interface Props {
  points: SeriesPoint[];
  metric: Metric;
  interval: Interval;
}

const W = 960;
const H = 260;
const PAD = { top: 12, right: 8, bottom: 28, left: 40 };

function niceMax(max: number): number {
  if (max <= 0) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 5 ? 5 : 10;
  return step * pow;
}

export const Chart = component$<Props>(({ points, metric, interval }) => {
  const i18n = useI18n();
  const hover = useStore({ i: -1 });
  const n = points.length;
  const values = points.map((p) => p[metric]);
  const top = niceMax(Math.max(...values, 0));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = n ? plotW / n : plotW;
  const bw = Math.max(2, Math.min(24, band * 0.7));
  // Integer ticks: split the nice max into 4, 5 or 2 steps, whichever divides it.
  const divisions = top % 4 === 0 ? 4 : top % 5 === 0 ? 5 : 2;
  const ticks = Array.from({ length: divisions + 1 }, (_, k) => (k * top) / divisions);
  const labelEvery = Math.max(1, Math.ceil(n / (interval === "hour" ? 8 : 10)));
  const h = hover.i >= 0 ? points[hover.i] : null;
  const metricLabel = tr(i18n, METRIC_LABEL[metric]);

  return (
    <div class="relative">
      <svg viewBox={`0 0 ${W} ${H}`} class="h-auto w-full" role="img" aria-label={metricLabel}>
        {ticks.map((t) => {
          const y = PAD.top + plotH - (t / top) * plotH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} class="stroke-slate-200" stroke-width="1" />
              <text x={PAD.left - 8} y={y + 4} text-anchor="end" class="fill-slate-400" font-size="11" font-variant-numeric="tabular-nums">
                {fmtCompact(t, i18n.lang)}
              </text>
            </g>
          );
        })}
        {points.map((p, i) => {
          const v = p[metric];
          const x = PAD.left + i * band + (band - bw) / 2;
          const barH = top ? (v / top) * plotH : 0;
          const y = PAD.top + plotH - barH;
          const r = Math.min(4, bw / 2, barH);
          const base = PAD.top + plotH;
          const d = barH > 0
            ? `M${x},${base} V${y + r} a${r},${r} 0 0 1 ${r},-${r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} V${base} Z`
            : "";
          const active = hover.i === i;
          return (
            <g
              key={p.bucket}
              tabindex={0}
              role="listitem"
              aria-label={`${bucketLabel(p.bucket, interval, i18n.lang, true)}: ${fmtNumber(v, i18n.lang)} ${metricLabel}`}
              class="outline-none"
              onMouseEnter$={() => (hover.i = i)}
              onFocus$={() => (hover.i = i)}
              onMouseLeave$={() => (hover.i = -1)}
              onBlur$={() => (hover.i = -1)}
            >
              {/* hit target: the whole band */}
              <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent" />
              {d && <path d={d} class={active ? "fill-primary-500" : "fill-primary-600"} />}
              {barH === 0 && <rect x={x} y={base - 1} width={bw} height={1} class="fill-slate-300" />}
              {i % labelEvery === 0 && (
                <text x={PAD.left + i * band + band / 2} y={H - 8} text-anchor="middle" class="fill-slate-400" font-size="11">
                  {bucketLabel(p.bucket, interval, i18n.lang)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && (
        <div
          class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: `${((PAD.left + hover.i * band + band / 2) / W) * 100}%` }}
        >
          <div class="text-base font-semibold text-slate-900">{fmtNumber(h[metric], i18n.lang)}</div>
          <div class="text-slate-500">
            {metricLabel} · {bucketLabel(h.bucket, interval, i18n.lang, true)}
          </div>
        </div>
      )}
      <table class="sr-only">
        <caption>{metricLabel}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.bucket}>
              <th scope="row">{p.bucket}</th>
              <td>{p[metric]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
