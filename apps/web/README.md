# oops — Web (Qwik City)

The marketing site **and** dashboard for [oops](https://oops.3m4.net), an
open-source privacy-friendly web-analytics service. One Qwik City app, SSR'd by
a standalone Node-compatible HTTP server on **port 3000** (run with Bun). Same
chrome, toolchain and code style as the sibling
[3m4](https://github.com/Devace-93/3m4) app; brand colour is Tailwind fuchsia.

- Marketing: `/`, `/info` (+ `/info/pricing`, `/info/docs`), `/blog/*`, `/sponsors`.
- Auth: `/login`, `/signup` (hidden while the `signups` feature is off).
- Dashboard: `/dashboard` (projects with 30-day counts and usage),
  `/dashboard/projects/[id]` (overview: filter row, KPI tiles, column chart,
  click-to-filter breakdowns, live counter), `/dashboard/projects/[id]/events`
  (raw event log), `/dashboard/projects/[id]/settings` (public key, install
  snippets, tracking switches, time zone, allowed hostnames, purge, delete),
  `/dashboard/settings` (API keys, audit log), `/dashboard/billing` (hidden in
  early access).
- Static: `/m.js` and `/m/v1.js`, the tracker built from `packages/tracker`.

Vocabulary: **hits / events** are what projects collect; **features** are
oops' own switches from `packages/shared/feature_flags.json`.

Toolchain: **Bun** (do not use npm/pnpm). Stack: Qwik + Qwik City + Vite +
TypeScript + Tailwind CSS, with the official `@builder.io/qwik-city/adapters/node-server`.

## Develop

```bash
cd packages/tracker && bun install && bun run build   # once, writes apps/web/public/m.js
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
`src/i18n/langs.ts` has a base catalog.

## Charts

`src/components/chart.tsx` is a hand-rolled SVG column chart (one metric at a
time, ≤ 24px columns with a rounded cap, hairline grid, compact tick labels,
per-column hover / focus tooltip, hidden table for assistive tech). No chart
library: the page must stay light and SSR-safe.

## Environment (build-time, `VITE_*`)

See the repo `.env.example`: `VITE_API_URL`, `VITE_APP_URL`, `VITE_POSTHOG_KEY`,
`VITE_POSTHOG_HOST`, `VITE_REVENUECAT_PUBLIC_KEY`, `VITE_BILLING_ENABLED`,
`VITE_INFO_URL`. At runtime the SSR server reads `API_INTERNAL_URL` to resolve
features before the first paint.
