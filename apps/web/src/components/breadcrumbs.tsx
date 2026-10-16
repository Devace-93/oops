import { component$ } from "@builder.io/qwik";
import type { Breadcrumb } from "../lib/types";
import { breadcrumbIcon, crumbOffset, fmtJson } from "../lib/stats";
import { tr, useI18n } from "../i18n";

/**
 * What the user did before the error, oldest first: category glyph + label,
 * message, time relative to the event. Crumb `data` (already scrubbed by the
 * server) expands inline.
 */
export const Breadcrumbs = component$<{ crumbs: Breadcrumb[]; eventTs: string }>(({ crumbs, eventTs }) => {
  const i18n = useI18n();
  if (!crumbs.length) return <p class="text-sm text-slate-400">{tr(i18n, "issue.noBreadcrumbs")}</p>;
  const levelClass = (l?: string | null) =>
    l === "error" || l === "fatal" ? "text-red-700" : l === "warning" ? "text-amber-700" : "text-slate-500";
  return (
    <ol class="relative ml-3 border-l border-slate-200 text-sm" data-testid="breadcrumbs">
      {crumbs.map((c, i) => (
        <li key={i} class="relative pb-3 pl-5">
          <span class="absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-white text-[11px] leading-none ring-1 ring-slate-300" aria-hidden="true">
            {breadcrumbIcon(c.category)}
          </span>
          <div class="flex flex-wrap items-baseline gap-x-2">
            <span class={["text-xs font-semibold uppercase tracking-wide", levelClass(c.level)]}>{c.category}</span>
            {c.ts && (
              <span class="font-mono text-xs text-slate-400" title={c.ts}>
                {crumbOffset(c, eventTs, i18n.lang)}
              </span>
            )}
          </div>
          {c.message && <div class="mt-0.5 break-words text-slate-800">{c.message}</div>}
          {c.data && Object.keys(c.data).length > 0 && (
            <details class="mt-1">
              <summary class="cursor-pointer text-xs text-slate-500 hover:text-primary-700">{tr(i18n, "issue.crumbData")}</summary>
              <pre class="mt-1 overflow-x-auto rounded bg-slate-100 p-2 text-xs">{fmtJson(c.data)}</pre>
            </details>
          )}
        </li>
      ))}
      <li class="relative pl-5">
        <span class="absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-red-600 text-[10px] leading-none text-white" aria-hidden="true">
          !
        </span>
        <span class="text-xs font-semibold uppercase tracking-wide text-red-700">{tr(i18n, "issue.crumbError")}</span>
      </li>
    </ol>
  );
});
