import { component$ } from "@builder.io/qwik";
import type { IssueStatus, Level } from "../lib/types";
import { LEVEL_CLASS, LEVEL_LABEL, STATUS_CLASS, STATUS_LABEL } from "../lib/stats";
import { tr, useI18n } from "../i18n";

/** Level badge: fatal / error dark red, warning amber, info blue. Fuchsia is the brand only. */
export const LevelBadge = component$<{ level: Level; small?: boolean }>(({ level, small }) => {
  const i18n = useI18n();
  const label = LEVEL_LABEL[level] ? tr(i18n, LEVEL_LABEL[level]) : level;
  return (
    <span class={["badge uppercase tracking-wide", small ? "px-1.5 text-[10px]" : "", LEVEL_CLASS[level] ?? "bg-slate-100 text-slate-700"]} data-level={level}>
      {label}
    </span>
  );
});

/** Status badge: open (brand), resolved (green), ignored (muted). */
export const StatusBadge = component$<{ status: IssueStatus }>(({ status }) => {
  const i18n = useI18n();
  return (
    <span class={["badge", STATUS_CLASS[status] ?? "bg-slate-100 text-slate-700"]} data-status={status}>
      {tr(i18n, STATUS_LABEL[status])}
    </span>
  );
});
