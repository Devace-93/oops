import { component$ } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import type { Project } from "../lib/types";
import { fmtCompact, isLive } from "../lib/stats";
import { tr, useI18n } from "../i18n";
import type { CatalogKey } from "../i18n/catalog/en";

/**
 * Header shared by every project page: back link, name, open-issues count,
 * paused / live badges, site link and the Issues / Events / Settings tabs.
 */
export const ProjectNav = component$<{ project: Project | null; id: string }>(({ project, id }) => {
  const loc = useLocation();
  const i18n = useI18n();
  const base = `/dashboard/projects/${id}`;
  const path = loc.url.pathname.replace(/\/$/, "");
  const tabs: { href: string; label: CatalogKey; match: (p: string) => boolean }[] = [
    { href: base, label: "pnav.issues", match: (p) => p === base || p.startsWith(`${base}/issues`) },
    { href: `${base}/events`, label: "pnav.events", match: (p) => p === `${base}/events` },
    { href: `${base}/settings`, label: "pnav.settings", match: (p) => p === `${base}/settings` },
  ];
  const live = isLive(project?.counts.last_event_at);
  return (
    <div class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-6xl px-4 pt-6">
        <Link href="/dashboard" class="text-sm text-slate-500 hover:text-primary-600">
          {tr(i18n, "pnav.back")}
        </Link>
        <div class="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-bold text-slate-900">{project?.name ?? "…"}</h1>
            {project && <span class="font-mono text-xs text-slate-500">{project.key}</span>}
            {project && project.counts.open_issues > 0 && (
              <span class="badge bg-red-100 text-red-800" title={tr(i18n, "pnav.openIssuesHint")}>
                {tr(i18n, "pnav.openIssues", { n: fmtCompact(project.counts.open_issues, i18n.lang) })}
              </span>
            )}
            {project && !project.ingest_enabled && (
              <span class="badge bg-amber-100 text-amber-800">{tr(i18n, "pnav.paused")}</span>
            )}
            {live && (
              <span class="badge bg-green-100 text-green-800" title={tr(i18n, "pnav.liveEvents")}>
                <span class="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-green-600" aria-hidden="true" />
                {tr(i18n, "pnav.live")}
              </span>
            )}
          </div>
          {project?.url && (
            <a href={project.url} target="_blank" rel="noreferrer" class="btn-secondary text-xs">
              {tr(i18n, "pnav.openSite")} ↗
            </a>
          )}
        </div>
        <nav class="mt-4 flex gap-1 overflow-x-auto" aria-label={tr(i18n, "pnav.issues")}>
          {tabs.map((t) => {
            const active = t.match(path);
            return (
              <Link
                key={t.href}
                href={t.href}
                class={[
                  "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                  active ? "border-primary-600 text-primary-700" : "border-transparent text-slate-600 hover:text-slate-900",
                ]}
              >
                {tr(i18n, t.label)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
});
