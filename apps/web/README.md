# oops — Web (Qwik City)

The marketing site **and** dashboard for [oops](https://oops.3m4.net), an
open-source error-tracking service. One Qwik City app, SSR'd by a standalone
Node-compatible HTTP server on **port 3000** (run with Bun). Same chrome,
toolchain and code style as the sibling [3m4](https://github.com/Devace-93/3m4)
app; brand colour is Tailwind fuchsia (level badges use red / amber / blue).

- Marketing: `/`, `/info` (+ `/info/pricing`, `/info/docs`), `/blog/*`, `/sponsors`.
- Auth: `/login`, `/signup` (hidden while the `signups` feature is off).
- Dashboard: `/dashboard` (projects with open issues, events 24h / 30d, usage),
  `/dashboard/projects/[id]` (issues inbox: status tabs with counts, filters,
  sort, paging, bulk resolve / ignore / reopen, KPI strip + events chart +
  click-to-filter breakdowns), `/dashboard/projects/[id]/issues/[issue]`
  (issue page: status actions, counters, latest or any occurrence with stack
  frames, context, tags, extra and breadcrumbs), `/dashboard/projects/[id]/events`
  (raw event log with a detail drawer), `/dashboard/projects/[id]/settings`
  (public key, SDK / curl / Python / Node snippets, ingest and store-IP
  switches, time zone, allowed hostnames, purge, delete), `/dashboard/settings`
  (API keys, audit log), `/dashboard/billing` (hidden in early access).
- Static: `/o.js` and `/o/v1.js`, the browser SDK built from `packages/sdk`.

Vocabulary: **events** are the error occurrences a project receives and
**issues** their groups by fingerprint; **features** are oops' own switches
from `packages/shared/feature_flags.json`.

Toolchain: **Bun** (do not use npm/pnpm). Stack: Qwik + Qwik City + Vite +
TypeScript + Tailwind CSS, with the official `@builder.io/qwik-city/adapters/node-server`.

## Develop

```bash
cd packages/sdk && bun install && bun run build   # once, writes apps/web/public/o.js + o/v1.js
cd apps/web
bun install
bun run dev          # Vite dev server (SSR), http://localhost:5173
```

## Build & serve (production)

```bash
bun install
bun run build        # check:i18n + types + client + SSR server → dist/ + server/entry.node-server.js
bun run serve        # starts the SSR server on 0.0.0.0:3000
```

`bun run check:i18n` verifies that every base-language catalog has every
English key (same placeholders, nothing extra) and that every locale in
`src/i18n/langs.ts` has a base catalog. After changing the English catalogs run
`bun scripts/sync-i18n.ts`: it strips keys that no longer exist in English from
the other catalogs and appends the new English strings as `TODO(translate)`
fallbacks (nothing is translated; a later translation pass regenerates them).

## Charts

`src/components/chart.tsx` is a hand-rolled SVG column chart (events or
affected users, ≤ 24px columns with a rounded cap, hairline grid, compact tick
labels, per-column hover / focus tooltip, hidden table for assistive tech). No
chart library: the page must stay light and SSR-safe.

## Environment (build-time, `VITE_*`)

See the repo `.env.example`: `VITE_API_URL`, `VITE_APP_URL`, `VITE_POSTHOG_KEY`,
`VITE_POSTHOG_HOST`, `VITE_REVENUECAT_PUBLIC_KEY`, `VITE_BILLING_ENABLED`,
`VITE_INFO_URL`, plus `VITE_METRICS_PROJECT_KEY` / `VITE_METRICS_TRACKER_URL`
(oops itself is tracked by metrics.3m4.net). At runtime the SSR server reads
`API_INTERNAL_URL` to resolve features before the first paint.
