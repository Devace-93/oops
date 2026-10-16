/**
 * Blog content. Plain data for now (no CMS, no markdown pipeline): a post is a
 * list of sections rendered by routes/(marketing)/blog/[...slug]. Newest first.
 */
export interface PostSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface Post {
  slug: string;
  title: string;
  date: string; // ISO date
  summary: string;
  sections: PostSection[];
}

export const POSTS: Post[] = [
  {
    slug: "launch",
    title: "oops is live: open-source error tracking with a 4 KB SDK, an ingest API and an MCP server",
    date: "2026-10-16",
    summary:
      "oops catches the errors your apps throw — in the browser, on the server, in scripts and in AI agents — groups them into issues, tells you how many users each one affects and in which release and environment it happens, and lets you resolve or ignore them from the dashboard, the REST API or an MCP client. Here is what shipped today and how it works.",
    sections: [
      {
        paragraphs: [
          "Every app throws errors its developers never see: a TypeError on a browser nobody tests on, a backend job that fails at 3 a.m., an agent whose tool call times out. oops is a small, open-source service that catches them. One project per app, a public key, and three ways to report: a browser SDK, an ingest API for anything that can send JSON, and an MCP server so AI agents can report their own failures and triage everyone else's.",
          "It is the fifth app in the 3m4 family, built on the same stack and chrome as the URL shortener, the feature-flag service, the feedback inbox and the analytics tracker: Flask + PostgreSQL + Redis behind a Qwik City frontend, with Caddy in front and Docker Compose for self-hosting. MIT licensed, as always.",
        ],
      },
      {
        heading: "What an error becomes",
        paragraphs: [
          "Each report is an event: a type and a message, the stack (as frames or as the raw string, which the server parses for V8, Firefox / Safari and Python traceback formats), the level, the release and environment, the URL, an optional user, tags, extra JSON and up to 30 breadcrumbs. The server scrubs anything that looks like a password, token, cookie or card number, drops query strings from URLs, turns the user agent into browser / OS / device and discards it, and hashes the IP unless the project opted in to keep it.",
          "Events are grouped into issues by fingerprint. If you send one, it wins. Otherwise the fingerprint is the error type, the message with numbers, hex blobs, UUIDs and quoted strings replaced by placeholders, and the top in-app frame — so 'User 42 not found' and 'User 43 not found' are one issue, and the same error thrown from a different function is another. Issues carry event and affected-user counts, first / last seen, the environments and the last releases they were seen in, and a per-project number (#12) for humans.",
          "Resolve an issue and it stays resolved until a new event arrives, at which point it reopens and gets a regressed badge. Ignore an issue and it stays quiet, but keeps counting.",
        ],
      },
      {
        heading: "The browser SDK",
        paragraphs: [
          "One script tag, under 4 KB gzipped, no dependencies. It captures window.onerror and unhandled promise rejections (and console.error if you ask), keeps a ring buffer of clicks, route changes and failed fetch / XHR calls as breadcrumbs, and sends events with sendBeacon so nothing blocks the page. Identical errors within two seconds are dropped, there is a per-minute cap, and localhost pages are skipped unless you say otherwise. The public API — oops.capture, oops.message, oops.setUser, oops.setTag, oops.setContext, oops.breadcrumb — is queued before load, so you can call it from the first line of your app.",
        ],
      },
      {
        heading: "The ingest API and MCP",
        paragraphs: [
          "Backends, CLIs and cron jobs POST to /api/ingest with the project's public key. CORS is open, text/plain bodies are accepted, batches hold up to 20 events, and the answer is always 202: a project that is paused, over budget or reporting from an unlisted origin gets { ok: false, reason } rather than an error, because a failing app must never fail a second time because of its error tracker.",
          "The MCP server exposes the whole management API as tools, filtered by the role of the API key you connect with. Ask Claude Code or any MCP host 'what broke after the 1.4 release?' or 'triage the checkout project' and it will list, inspect, resolve and ignore issues for you — or report its own failures with report_error. Destructive tools (delete a project, purge its events) ask for confirmation, and everything is audited.",
        ],
      },
      {
        heading: "Early access",
        paragraphs: [
          "The hosted version at oops.3m4.net is in early access: every account gets the enterprise limits for free — unlimited projects, events and retention, the API and the MCP server. The planned tiers are on the pricing page, and the previous post explains what will eventually sit behind them. Self-hosting is, and will stay, unlimited.",
          "Create a project, paste the script tag, throw an error on purpose. It shows up in a second.",
        ],
      },
    ],
  },
  {
    slug: "what-paid-plans-will-include",
    title: "Launching oops in early access: everything is free for now. Here is what paid plans will include later.",
    date: "2026-10-15",
    summary:
      "oops catches the errors your apps throw — from a browser SDK, a server-side ingest API or an MCP tool — groups them into issues and tells you how many users each one affects. It is in early access: every account gets the full product at no cost. This post explains what will eventually sit behind paid plans, and what stays free.",
    sections: [
      {
        paragraphs: [
          "oops is the fifth app in the 3m4 family, after the URL shortener, the feature-flag service, the user-feedback inbox and the analytics tracker. It answers one question: what is breaking in my apps, for whom, and since which release? Each project gets a public key; drop one script tag in your site and uncaught errors start flowing into an inbox of issues grouped by fingerprint, with stack traces, breadcrumbs, affected users, environments and releases. No browser? Post to the ingest API from your backend, a CLI or an AI agent.",
          "It is deliberately careful with data: secret-looking keys in tags, extra, breadcrumbs and user objects are replaced by [Filtered], query strings and fragments are dropped from URLs, raw user agents are discarded once browser, OS and device have been read, and IP addresses are hashed unless a project opts in to keep them. The SDK sets no cookie and stores nothing in the browser.",
          "The hosted version at oops.3m4.net is in early access. During early access every account gets the full product: unlimited projects, unlimited events, full data retention, the management API and the MCP server. No card, no trial clock.",
        ],
      },
      {
        heading: "What stays free",
        bullets: [
          "Self-hosting. The whole stack is MIT licensed and always will be; a self-hosted instance has no limits beyond the ones you configure.",
          "A free hosted tier with a few projects, a monthly budget of error events and a sensible retention window.",
          "The browser SDK, the ingest API, grouping, affected-user counts, releases and environments, breadcrumbs, resolve / ignore, the events log.",
          "Basic API access with role-scoped API keys, and the MCP server for AI agents.",
        ],
      },
      {
        heading: "What will move under paid plans",
        paragraphs: ["The things that cost money to run at scale, or that mostly matter to teams and businesses:"],
        bullets: [
          "Higher counts: more projects and more API keys.",
          "Bigger monthly event budgets. Past the budget the ingest API keeps answering 202 (your app never gets a second error back), but the extra events are counted and not stored, and the dashboard tells you.",
          "Longer data retention (a year of raw events instead of 30 or 90 days).",
          "Longer audit-log retention (a year or more instead of a rolling week).",
          "Team seats, roles and priority support.",
          "Enterprise: SSO, SLA and custom limits.",
        ],
      },
      {
        heading: "What happens when plans arrive",
        paragraphs: [
          "The SDK and the ingest API never answer with an error. Whatever plan you end up on, every public key you shipped keeps working.",
          "We will announce the change here and by email before any limit applies to an existing account, with enough notice to export your data or pick a plan.",
          "The planned tiers are already listed on the pricing page so there are no surprises. Prices and limits there are our current intent, not a contract, and may still change before launch.",
        ],
      },
      {
        heading: "Questions or opinions?",
        paragraphs: [
          "Early access exists to collect them — and yes, oops uses oops: this very site reports its own errors through its own SDK. Tell us which of the items above you would pay for, and which you would not; it directly shapes the final plans.",
        ],
      },
    ],
  },
];

export function findPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
