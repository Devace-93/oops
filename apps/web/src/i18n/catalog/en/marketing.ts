/**
 * Marketing pages: landing, blog (chrome only, post bodies stay in
 * src/content/posts.ts), pricing/info/docs, sponsors, early-access banner.
 * Prefix keys by page: `landing.*`, `blog.*`, `pricing.*`, `info.*`,
 * `docs.*`, `sponsors.*`, `early.*`, `building.*`. Strings that wrap markup
 * are split into parts.
 */
export const marketing = {
  // Landing — hero
  "landing.badgeErrors": "Open source · MIT · Self-hostable · 4 KB SDK",
  "landing.heroTitleErrors": "Catch and fix the errors",
  "landing.heroTitleAccentErrors": "your apps throw",
  "landing.heroBodyErrors":
    "oops collects the errors from your browsers, servers, scripts and AI agents, groups them into issues, and tells you how many users each one affects, in which release and in which environment — with the stack trace and the clicks that led there. Resolve them from the dashboard, the API or an MCP client.",
  "landing.getStarted": "Get started free",
  "landing.whyFree": "Why it's free right now",
  "landing.seePricing": "See pricing",
  "landing.readDocs": "Read the docs",
  "landing.earlyNote": "Early access: every account gets full access, free. Plans come later, with notice.",
  "landing.freeNoteErrors": "Free plan: {projects} projects & {events} error events / month. No card required.",

  // Landing — three paths
  "landing.pathsTitleErrors": "Three ways to report",
  "landing.pathsBodyErrors": "Pick the one that fits each app. They all land in the same inbox.",
  "landing.pathSdkTitle": "Browser SDK",
  "landing.pathSdkBody":
    "One script tag, under 4 KB, no dependencies. Catches uncaught errors and unhandled promise rejections, records clicks, route changes and failed requests as breadcrumbs, and exposes oops.capture() for the errors you catch yourself. Never throws into your page.",
  "landing.pathIngestTitle": "Ingest API",
  "landing.pathIngestBody":
    "A single POST with the project's public key, from Python, Node, Go, a CLI or a cron job. Send frames or the raw stack string — V8, Firefox and Python tracebacks are parsed server-side. Always answers 202: a failing app never gets a second error back.",
  "landing.pathAgentTitle": "AI agents via MCP",
  "landing.pathAgentBody":
    "The MCP server lets Claude Code, Claude Desktop, Cursor or any MCP host read, triage and resolve issues — and report an agent's own failures into a project with report_error.",

  // Landing — how it works
  "landing.howTitle": "How it works",
  "landing.step1Title": "1. Create a project",
  "landing.step1BodyErrors": "One project per app, site or service. You get a public key for the SDK and the ingest API, and you pick its time zone.",
  "landing.step2TitleErrors": "2. Report an error",
  "landing.step2BodyErrors": "Paste the script tag, or POST one JSON object from your backend. The server scrubs secrets, parses the stack and groups the event into an issue by fingerprint.",
  "landing.step3TitleErrors": "3. Triage the inbox",
  "landing.step3BodyErrors": "Open issues sorted by last seen, with events, affected users, environments and releases. Resolve, ignore, reopen — one by one or in bulk, from the dashboard, the API or an AI agent.",

  // Landing — what you see
  "landing.seeTitleErrors": "Everything you need to fix it, nothing you don't",
  "landing.seeBodyErrors": "The dashboard answers the questions you actually ask when something breaks, and stops there.",
  "landing.seeGroupTitle": "Grouped by fingerprint.",
  "landing.seeGroupBody": "'User 42 not found' and 'User 43 not found' are one issue; the same error from another function is another. Send your own fingerprint to override.",
  "landing.seeUsersTitle": "Affected users.",
  "landing.seeUsersBody": "Not just how many times, but how many people — by the user id you send, or a daily cookie-less hash when you don't.",
  "landing.seeReleasesTitle": "Releases and environments.",
  "landing.seeReleasesBody": "Every issue lists where it happens. Resolved issues reopen on the next event and get a regressed badge.",
  "landing.seeCrumbsTitle": "Breadcrumbs.",
  "landing.seeCrumbsBody": "The last 30 clicks, route changes, failed requests and console messages before the error, with the stack frames and tags next to them.",

  // Landing — privacy
  "landing.privacyTitleErrors": "Careful with data by construction",
  "landing.privacyBodyErrors":
    "Error payloads carry whatever your code had in scope, so the server cleans them before storage: secret-looking keys are filtered, query strings and fragments are dropped from URLs, the user agent is reduced to browser, OS and device and thrown away, and IP addresses are hashed unless a project opts in to keep them.",
  "landing.privacyScrub": "Keys named password, token, secret, authorization, cookie, api_key, card, cvv or ssn are replaced by [Filtered] in tags, extra, breadcrumbs and user objects",
  "landing.privacyUa": "No raw user agents stored — only browser, OS and device",
  "landing.privacyIp": "Raw IP addresses are not stored by default — only a daily salted hash (a per-project switch keeps them if you need to)",
  "landing.privacyCookies": "The SDK sets no cookie and writes nothing to the browser",
  "landing.apiNoteErrors": "Public keys can only report. They can never read anything, and they can be rotated at any time.",
  "landing.panelRequest": "Request",
  "landing.panelResponse": "Response",

  // Landing — MCP section
  "landing.mcpBadge": "Model Context Protocol",
  "landing.mcpTitleErrors": "Let your AI agent triage the inbox",
  "landing.mcpIntro": "oops ships an MCP server. Connect it to Claude Code, Claude Desktop, Cursor or any MCP host and ask things like",
  "landing.mcpExampleRelease": "“what broke after the 1.4 release?”",
  "landing.mcpOr": "or",
  "landing.mcpExampleTriage": "“triage the checkout errors and resolve the ones already fixed”",
  "landing.mcpTriageTitle": "A triage prompt.",
  "landing.mcpTriageBody": "The server ships a triage prompt that summarises a project's open issues — new vs regressed, most users affected, by environment — and proposes what to fix, resolve or ignore first.",
  "landing.mcpBullet1Title": "Role-scoped keys.",
  "landing.mcpBullet1Body": "A viewer key never even sees the delete tools; editor and admin unlock more. Enforced by the API too.",
  "landing.mcpBullet2Title": "Human in the loop.",
  "landing.mcpBullet2BodyErrors": "Destructive actions (delete a project, purge its events and issues) ask you to confirm before anything happens.",
  "landing.mcpBullet3Title": "Audit trail.",
  "landing.mcpBullet3Body": "Every change and every refused call is logged, server-side and agent-side.",
  "landing.mcpBullet4Title": "Local or remote.",
  "landing.mcpBullet4Body1": "Run it over stdio with",
  "landing.mcpBullet4Npm": "npm",
  "landing.mcpBullet4Body2": "or point your host at",
  "landing.mcpBullet4Body3": "with your key.",
  "landing.mcpPanelLocal": "Claude Code · local (npm)",
  "landing.mcpPanelRemote": "Claude Code · remote (nothing to install)",
  "landing.mcpPanelJson": "Any MCP host (JSON)",
  "landing.mcpKeyNote": "Create a key with the role you want under",
  "landing.mcpKeyLink": "Dashboard → API keys",

  // Landing — self-host callout + closing CTA
  "landing.selfhostTitle": "Self-host it (MIT, open source)",
  "landing.selfhostBody1Errors":
    "The entire stack — Flask API, browser SDK, MCP server and this Qwik app — is MIT-licensed. Run it on your own VPS with one",
  "landing.selfhostBody2": ". No billing code, no limits beyond what you configure.",
  "landing.viewGithub": "View on GitHub",
  "landing.ctaTitleErrors": "See your first error in a minute",
  "landing.ctaBodyErrors": "Create a project, paste one script tag and throw something on purpose. It lands in the inbox in a second.",

  // Blog (chrome only)
  "blog.title": "Blog",
  "blog.intro": "Product updates, engineering notes and tips on reading your numbers.",
  "blog.comingSoon": "Coming soon.",
  "blog.readMore": "Read more →",
  "blog.allPosts": "← All posts",
  "blog.notFoundTitle": "Post not found",
  "blog.notFoundBody": "There is no post at",
  "blog.backToBlog": "Back to Blog",
  "blog.seeTiers": "See the planned tiers",

  // Info index
  "info.title": "Info",
  "info.intro": "Reference pages for oops. More will land here over time.",
  "info.pricingTitle": "Pricing",
  "info.pricingBody": "Plans, limits and prices.",
  "info.plannedPricingTitle": "Planned pricing",
  "info.plannedPricingBody": "The tiers we intend to introduce after early access.",
  "info.docsTitle": "Docs",
  "info.docsBodyErrors": "Browser SDK guide, ingest API fields, grouping rules, REST and MCP reference, limits.",
  "info.termsTitle": "Terms",
  "info.termsBody": "Terms of service (coming soon).",
  "info.privacyTitle": "Privacy",
  "info.privacyBody": "What we store and what we never store (coming soon).",
  "info.comingSoon": "This page is coming soon.",
  "info.backToInfo": "Back to Info",

  // Pricing page
  "pricing.title": "Simple, honest pricing",
  "pricing.titlePlanned": "Planned pricing",
  "pricing.introErrors":
    "Start free. Upgrade when you need more projects, more error events per month or longer retention. Self-host for unlimited everything.",
  "pricing.introPlanned": "These are the tiers we intend to introduce after early access. Nothing here applies yet.",
  "pricing.earlyTitle": "Right now every account has full access, free.",
  "pricing.earlyBodyErrors":
    "Unlimited projects, error events and retention, the API and the MCP server. When plans arrive we will announce it on the blog and by email before any limit applies to an existing account. Prices and limits below may still change.",
  "pricing.earlyCta": "Read what paid plans will include",
  "pricing.enterpriseTitle": "Need custom limits, SSO or an SLA?",
  "pricing.enterpriseBody": "Enterprise plans are tailored to your team.",
  "pricing.contactUs": "Contact us",
  "pricing.footnoteErrors":
    "All prices in USD. Annual billing saves ~20%. Project and key counts are hard limits; error events over the monthly budget are counted but not stored, and your app never gets an error back. Events older than the retention window are pruned.",
  "pricing.footnoteEarly": "None of this is enforced during early access.",

  // Pricing table (plan labels come from packages/shared/plan_limits.json)
  "pricing.mostPopular": "Most popular",
  "pricing.perMonth": "/mo",
  "pricing.perYear": "/yr",
  "pricing.projects": "projects",
  "pricing.eventsPerMonth": "events / mo",
  "pricing.retention": "{value} data retention",
  "pricing.apiKeys": "API keys",
  "pricing.auditRetention": "{value} audit retention",
  "pricing.user": "user",
  "pricing.users": "users",
  "pricing.api": "{api} API",
  "pricing.sponsorsBadge": "/sponsors badge",
  "pricing.teamExtras": "Roles + priority support",
  "pricing.enterpriseExtras": "SSO, SLA, custom limits",
  "pricing.getStarted": "Get started",
  "pricing.startPlan": "Start {plan}",

  // Docs
  "docs.title": "Docs",
  "docs.introErrors":
    "How to put oops in your app, report errors from anywhere, and read or triage the issues through the REST API or an AI agent. The full contract — every endpoint, object and rule — lives in the repository.",
  "docs.fullContract": "Read the full contract (CONTRACT.md)",
  "docs.baseUrl": "Base URL",
  "docs.sdkTitle": "Browser SDK",
  "docs.sdkBody":
    "A zero-dependency script under 4 KB gzipped, served from this host at /o.js (also /o/v1.js). Add it once in your layout: it captures window.onerror and unhandledrejection, keeps the last 30 breadcrumbs (clicks, SPA route changes, failed fetch / XHR calls) and posts events with sendBeacon. It never throws into your page, drops identical events within 2 s, sends at most 30 events per minute and skips localhost pages unless told otherwise.",
  "docs.sdkAttrsTitle": "Attributes (defaults shown)",
  "docs.attrKey": "the project's public key (required).",
  "docs.attrEnvRelease": "environment and release labels stamped on every event (environment defaults to production).",
  "docs.attrConsole": "also capture console.error calls as events, and console.warn / console.error as breadcrumbs.",
  "docs.attrLocalErrors": "also report from localhost, raw IPs and file: pages (skipped by default).",
  "docs.attrSample": "fraction of error events sent (0–1). Captured messages and explicit capture() calls always go through.",
  "docs.attrUser": "initial user as JSON ({ id, email, name }); same as calling oops.setUser().",
  "docs.attrApiErrors": "override the ingest endpoint (self-hosted instances behind another host).",
  "docs.sdkJsTitle": "JavaScript API",
  "docs.sdkJsBody":
    "window.oops exposes capture, message, setUser, setTag / setTags, setContext, breadcrumb and flush. Calls queued in window.oops.q before the script loads are replayed.",
  "docs.sdkWhat":
    "What is sent: type, message, the stack (parsed into frames), level, URL without its query string, release, environment, platform, the user you set, tags, extra and the breadcrumb buffer. Browser, OS and device are derived on the server from the request and the user agent is discarded.",
  "docs.ingestTitle": "Ingest API",
  "docs.ingestBody":
    "POST /api/ingest (or /api/ingest/event) with the project's public key in the X-Project-Key header or a k field. JSON, form-encoded and text/plain bodies are accepted, CORS is open, bodies are capped at 64 KB, and the answer is 202 whenever the key is valid — paused projects, blocked origins and exceeded budgets return ok:false rather than an error, so a failing app never fails a second time.",
  "docs.ingestField1": "type and message: the exception class / error name and its message. At least one is required.",
  "docs.ingestField2": "level: fatal | error | warning | info (default error). environment (default production) and release are free-text labels used as filters.",
  "docs.ingestField3": "frames (top of the stack first; filename, function, lineno, colno, in_app) or stack: a raw string parsed server-side (V8, Firefox / Safari and Python traceback formats).",
  "docs.ingestField4": "url (query and fragment dropped), platform (javascript, python, node, …), sdk, user ({ id, email, name }), tags (≤ 20 pairs), extra (≤ 8 KB JSON).",
  "docs.ingestField5": "breadcrumbs: up to 30 of { ts, category, message, level, data }; the last 30 are kept.",
  "docs.ingestField6": "fingerprint: up to 5 strings that fully replace the automatic grouping. ts: optional client timestamp (server time if missing or more than 5 minutes off).",
  "docs.ingestResponsesTitle": "Responses",
  "docs.ingestResponses":
    "Stored events return the event id and the issue they landed in. Dropped events say why: paused (ingest switched off for the project), origin (allowed hostnames set and the page / Origin host is not in them) or limit (over the monthly budget — counted, not stored). Malformed payloads are 400, a bad key is 401.",
  "docs.ingestBatchTitle": "Batches",
  "docs.groupingTitle": "Grouping rules",
  "docs.groupingBody": "Every event lands in exactly one issue, keyed by a fingerprint:",
  "docs.groupingRule1": "If the event carries a fingerprint array, that wins — use it to group by business meaning (['checkout', 'pay-failed']).",
  "docs.groupingRule2": "Otherwise the fingerprint is type + normalised message + top in-app frame (filename without query string + function). Normalisation replaces runs of digits, hex blobs ≥ 8 chars, UUIDs and quoted strings with placeholders and truncates to 200 chars.",
  "docs.groupingRule3": "A resolved issue that receives a new event reopens and is marked regressed. An ignored issue stays ignored but keeps counting.",
  "docs.groupingRule4": "Affected users = distinct user hashes: your user.id (hashed per project) when you send one, otherwise a daily cookie-less hash of IP and user agent.",
  "docs.authTitle": "Authentication",
  "docs.authBody": "Three kinds of credentials, each for one job:",
  "docs.authDashboard": "Dashboard sessions: JWT bearer tokens issued by /auth/login. Hold every scope.",
  "docs.authApiKey": "Management API and MCP: API keys with a role (viewer / editor / admin). Header X-API-Key: oops_live_… (or Authorization: Bearer).",
  "docs.authPublicKeyErrors":
    "Ingest API and SDK: project public keys. Header X-Project-Key: oops_pub_… (or the k field). They identify one project, can only report, and can be rotated at any time.",
  "docs.projectsTitle": "Projects",
  "docs.projectsBodyErrors":
    "A project is one app, site or service. It owns a public key, a time zone (used to bucket days), an optional list of allowed hostnames, the ingest switch and the store-IP switch.",
  "docs.issuesTitle": "Issues and events",
  "docs.issuesBody":
    "Issues are paged (per_page ≤ 100) and default to the open ones seen in the last 30 days, most recent first. An issue is addressed by its uuid or its per-project number. Bulk updates take up to 100 ids. Events are the raw occurrences, newest first, across one issue or the whole project.",
  "docs.statsTitle": "Stats, usage and audit",
  "docs.statsBodyErrors":
    "period=today|yesterday|24h|7d|30d|90d|12mo or from/to (dates in the project time zone); interval hour | day | month is chosen automatically. level, environment and release filter everything in the answer: totals and the previous period of the same length, the time series, and the top-10 breakdowns.",
  "docs.dimensionsTitle": "Dimensions",
  "docs.dimensionsBodyErrors": "Returned as breakdowns by GET /stats. level, environment and release are also accepted as filters on the issues, events and stats endpoints.",
  "docs.limitsTitle": "Errors, limits and privacy",
  "docs.errorsBodyErrors":
    "Errors are JSON: { \"error\": { \"code\", \"message\" } }. A missing scope is 403 insufficient_scope. Creating past a plan limit answers 402 limit_reached with error.which = projects | api_keys. Events over the monthly budget are accepted (202) but not stored, and counted as dropped in /account/usage.",
  "docs.capsBody":
    "Payload caps: type ≤ 200, message ≤ 4096, frames ≤ 50, stack ≤ 16 KB, tags ≤ 20 pairs (key ≤ 40, value ≤ 200), extra ≤ 8 KB, breadcrumbs ≤ 30 / 8 KB, fingerprint ≤ 5 × 100, environment ≤ 40, release ≤ 100. Request bodies ≤ 64 KB; a batch holds ≤ 20 events.",
  "docs.plansBody":
    "Free plan: {projects} projects, {events} events per month and {days} days of retention; events older than the plan's window are pruned, and issues left with no events disappear with them.",
  "docs.privacyBodyErrors":
    "Privacy: keys matching password, passwd, secret, token, authorization, cookie, api_key, card, cvv or ssn are replaced by [Filtered] in tags, extra, breadcrumbs and user; bearer tokens and card numbers inside the message too. URLs lose query string and fragment. The user agent is reduced to browser / OS / device and discarded. IPs are hashed with a daily salt unless the project sets store_ip.",
  "docs.mcpTitle": "MCP (AI agents)",
  "docs.mcpBodyErrors":
    "The MCP server (npm oops-errors-mcp, or Streamable HTTP at /mcp) exposes the management API as tools, filtered by the role of the key you connect with and re-checked on every call. Destructive tools ask for confirmation. report_error lets an agent post an event into a project it can see.",
  "docs.mcpLocal": "Local (stdio, npm)",
  "docs.mcpRemote": "Remote (Streamable HTTP)",
  "docs.mcpPrompt":
    "Prompt triage (project, period?): summarises the open issues of a project — new vs regressed, most users affected, by environment — and proposes what to fix, resolve or ignore first.",
  "docs.colMethod": "Method",
  "docs.colPath": "Path",
  "docs.colScope": "Scope",
  "docs.colNotes": "Notes",
  "docs.colTool": "Tool",

  // Sponsors
  "sponsors.title": "Sponsors",
  "sponsors.intro1": "oops is open source (MIT). Every",
  "sponsors.introLink": "Pro / Supporter",
  "sponsors.intro2": "subscriber helps keep it free to self-host — and gets a badge and a spot on this page.",
  "sponsors.intro2Early": "subscriber will help keep it free to self-host — and will get a badge and a spot on this page.",
  "sponsors.emptyTitle": "Your name could be the first on this page.",
  "sponsors.emptyBody": "Every Pro / Supporter subscriber gets a spot here and an embeddable badge.",
  "sponsors.emptyBodyEarly": "Supporter subscriptions open together with paid plans, after early access. Until then every account is free.",
  "sponsors.tierSupporter": "{tier} supporter",
  "sponsors.badgeTitle": "The supporter badge",
  "sponsors.badgeBody": "Pro supporters get an embeddable badge for their site or README:",
  "sponsors.badgeBodyEarly": "Pro supporters will get an embeddable badge for their site or README:",
  "sponsors.badgeLabel": "oops Supporter",
  "sponsors.readPlans": "Read about the upcoming plans",
  "sponsors.become": "Become a supporter",

  // Early-access banner
  "early.bannerTitle": "Early access.",
  "early.bannerText": "Every account has full access at no cost right now. Plans and limits will be introduced later, with notice before anything changes.",
  "early.bannerLink": "What paid plans will include",

  // Site-building curtain
  "building.title": "We're building oops",
  "building.bodyErrors":
    "Error tracking for your apps. The site isn't open yet — but the SDK, the ingest API and the MCP server keep answering just fine.",
  "building.footer": "oops.3m4.net · coming soon",
} as const;
