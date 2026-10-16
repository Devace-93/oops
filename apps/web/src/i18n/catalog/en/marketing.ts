/**
 * Marketing pages: landing, blog (chrome only, post bodies stay in
 * src/content/posts.ts), pricing/info/docs, sponsors, early-access banner.
 * Prefix keys by page: `landing.*`, `blog.*`, `pricing.*`, `info.*`,
 * `docs.*`, `sponsors.*`, `early.*`, `building.*`. Strings that wrap markup
 * are split into parts.
 */
export const marketing = {
  // Landing — hero
  "landing.badge": "Open source · MIT · Self-hostable · No cookies",
  "landing.heroTitle": "Know who visits your apps,",
  "landing.heroTitleAccent": "without tracking anyone",
  "landing.heroBody":
    "oops counts page views and visitors for every project you register: top pages, referrers, countries and cities, devices, browsers and custom events — from one script tag, a pixel or an API call. No cookies, no stored IP addresses, nothing to put in a consent banner.",
  "landing.getStarted": "Get started free",
  "landing.whyFree": "Why it's free right now",
  "landing.seePricing": "See pricing",
  "landing.readDocs": "Read the docs",
  "landing.earlyNote": "Early access: every account gets full access, free. Plans come later, with notice.",
  "landing.freeNote": "Free plan: {projects} projects & {events} events / month. No card required.",

  // Landing — three paths
  "landing.pathsTitle": "Three ways to count",
  "landing.pathsBody": "Pick the one that fits each app. They all land in the same dashboard.",
  "landing.pathScriptTitle": "One script tag",
  "landing.pathScriptBody":
    "Under 3 KB, no dependencies. Counts every page view, follows single-page-app route changes, and exposes oops.track() for custom events. Works in Qwik, Astro, React, jQuery pages and Phaser games alike.",
  "landing.pathPixelTitle": "Tracking pixel",
  "landing.pathPixelBody":
    "A 1×1 image for places where JavaScript can't run: emails, READMEs, documentation hosted elsewhere. The URL says which page or event it stands for.",
  "landing.pathApiTitle": "Collect API",
  "landing.pathApiBody":
    "A single POST with the project's public key, from your backend, a CLI, a game server or a cron job. Perfect for apps without a DOM.",

  // Landing — how it works
  "landing.howTitle": "How it works",
  "landing.step1Title": "1. Create a project",
  "landing.step1Body": "One project per site or app. You get a public key for the script, the pixel and the API, and you pick its time zone.",
  "landing.step2Title": "2. Paste the snippet",
  "landing.step2Body": "Copy it from the project settings into your layout. The first page views show up within seconds.",
  "landing.step3Title": "3. Read the dashboard",
  "landing.step3Body": "Pick a range, click any page, country or device to filter everything by it, watch the live counter, or let an AI agent read the numbers through MCP.",

  // Landing — what you see
  "landing.seeTitle": "Everything you want to know, nothing you don't",
  "landing.seeBody": "The dashboard answers the questions people actually ask about a site, and stops there.",
  "landing.seeWhereTitle": "Where from.",
  "landing.seeWhereBody": "Referrers, UTM source / medium / campaign, countries, regions and cities.",
  "landing.seeWhoTitle": "On what.",
  "landing.seeWhoBody": "Desktop, mobile or tablet; browser and operating system; screen size and language.",
  "landing.seeWhatTitle": "Doing what.",
  "landing.seeWhatBody": "Top pages, entry paths, and the custom events you send (signups, purchases, clicks) with their properties.",
  "landing.seeLiveTitle": "Right now.",
  "landing.seeLiveBody": "Visitors in the last five minutes and the pages they are on.",

  // Landing — privacy
  "landing.privacyTitle": "Privacy-friendly by construction",
  "landing.privacyBody":
    "The tracker sets no cookie and writes nothing to the browser. The server hashes each visitor's IP address with a salt that changes every day, keeps only the derived country, region and city, and throws the user agent away once device, browser and OS are known.",
  "landing.privacy1": "No cookies, no localStorage, no fingerprinting across sites or days",
  "landing.privacy2": "Raw IP addresses are not stored by default — only a daily salted hash (a per-project switch keeps them if you need to)",
  "landing.privacy3": "Query strings are dropped from page URLs (except UTM tags), so tokens and emails never reach the dashboard",
  "landing.privacy4": "Optional Do Not Track support, and bots are filtered out",
  "landing.apiNote": "Public keys can only send hits. They can never read anything.",
  "landing.panelRequest": "Request",
  "landing.panelResponse": "Response",

  // Landing — MCP section
  "landing.mcpBadge": "Model Context Protocol",
  "landing.mcpTitle": "Ask your AI agent how the site is doing",
  "landing.mcpIntro": "oops ships an MCP server. Connect it to Claude Code, Claude Desktop, Cursor or any MCP host and ask things like",
  "landing.mcpExample1": "“how did traffic to the docs change this week?”",
  "landing.mcpOr": "or",
  "landing.mcpExample2": "“which countries visit the pricing page most?”",
  "landing.mcpBullet1Title": "Role-scoped keys.",
  "landing.mcpBullet1Body": "A viewer key never even sees the delete tools; editor and admin unlock more. Enforced by the API too.",
  "landing.mcpBullet2Title": "Human in the loop.",
  "landing.mcpBullet2Body": "Destructive actions (delete a project, purge its events) ask you to confirm before anything happens.",
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
  "landing.selfhostBody1":
    "The entire stack — Flask API, tracker, MCP server and this Qwik app — is MIT-licensed. Run it on your own VPS with one",
  "landing.selfhostBody2": ". No billing code, no limits beyond what you configure.",
  "landing.viewGithub": "View on GitHub",
  "landing.ctaTitle": "See your first visitor in a minute",
  "landing.ctaBody": "Create a project, paste one script tag and watch the live counter move.",

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
  "info.docsBody": "Tracker install guide, pixel, collect API, stats API reference and MCP setup.",
  "info.termsTitle": "Terms",
  "info.termsBody": "Terms of service (coming soon).",
  "info.privacyTitle": "Privacy",
  "info.privacyBody": "What we store and what we never store (coming soon).",
  "info.comingSoon": "This page is coming soon.",
  "info.backToInfo": "Back to Info",

  // Pricing page
  "pricing.title": "Simple, honest pricing",
  "pricing.titlePlanned": "Planned pricing",
  "pricing.intro":
    "Start free. Upgrade when you need more projects, more events per month or longer retention. Self-host for unlimited everything.",
  "pricing.introPlanned": "These are the tiers we intend to introduce after early access. Nothing here applies yet.",
  "pricing.earlyTitle": "Right now every account has full access, free.",
  "pricing.earlyBody":
    "Unlimited projects, events and retention, the API and the MCP server. When plans arrive we will announce it on the blog and by email before any limit applies to an existing account. Prices and limits below may still change.",
  "pricing.earlyCta": "Read what paid plans will include",
  "pricing.enterpriseTitle": "Need custom limits, SSO or an SLA?",
  "pricing.enterpriseBody": "Enterprise plans are tailored to your team.",
  "pricing.contactUs": "Contact us",
  "pricing.footnote":
    "All prices in USD. Annual billing saves ~20%. Project and key counts are hard limits; events over the monthly budget are counted but not stored, and your site never sees an error. Events older than the retention window are pruned.",
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
  "docs.intro":
    "How to put oops in your app, send hits from anywhere, and read the numbers through the REST API or an AI agent. The full contract — every endpoint, object and error — lives in the repository.",
  "docs.fullContract": "Read the full contract (CONTRACT.md)",
  "docs.baseUrl": "Base URL",
  "docs.trackerTitle": "Tracker script",
  "docs.trackerBody":
    "A zero-dependency script under 3 KB served from this host. Add it once in your layout; it sends one hit per page view and per single-page-app route change, with no cookies and nothing stored in the browser.",
  "docs.trackerAttrsTitle": "Attributes (defaults shown)",
  "docs.attrKey": "the project's public key (required).",
  "docs.attrSpa": "hook the History API and send a page view on every route change. Set to false to call oops.pageview() yourself.",
  "docs.attrHash": "hash routing: keep the #fragment in the URL and listen to hashchange.",
  "docs.attrDnt": "honour the browser's Do Not Track signal.",
  "docs.attrLocal": "also track on localhost, raw IPs, file: and *.local (ignored by default).",
  "docs.attrApi": "override the collect endpoint (self-hosted instances behind another host).",
  "docs.trackerJsTitle": "JavaScript API",
  "docs.trackerJsBody":
    "window.oops exposes track(name, props) for custom events and pageview() for manual page views. Calls queued before the script loads are replayed.",
  "docs.trackerDeclarative": "Clicks on elements with data-oops-event are tracked automatically, with optional JSON props:",
  "docs.trackerWhat":
    "What is sent: the page URL without its query string (UTM tags are read and then dropped), the referrer, the title, the screen size and the browser language. Device, browser, OS and location are derived on the server from the request and never stored raw.",
  "docs.pixelTitle": "Tracking pixel",
  "docs.pixelBody":
    "For places where no JavaScript runs — newsletters, README files, documentation on another host. The image is a 43-byte transparent GIF, never cached. Pass the page as u and, optionally, an event name as n.",
  "docs.collectTitle": "Collect API",
  "docs.collectBody":
    "POST /api/collect with the project's public key in the X-Project-Key header (or a k field). JSON, form-encoded and text/plain bodies are accepted, CORS is open, and the answer is always 202 so a tracked site never sees an error.",
  "docs.collectField1": "n: event name (defaults to pageview). 1-60 letters, digits, spaces, _ . : / or -.",
  "docs.collectField2": "u: the page URL or path (required for anything meaningful). Query strings are only read for UTM tags.",
  "docs.collectField3": "r: referrer URL; t: page title (≤ 200); l: language (≤ 16); w / h: screen size.",
  "docs.collectField4": "p: a JSON object of properties for custom events (≤ 2 KB).",
  "docs.collectField5": "s: source — script (default), pixel or api. Device, browser, OS and location come from the request's own headers and address.",
  "docs.collectResponses":
    "The body says what happened: { ok: true } when stored, or { ok: false, reason } with reason = paused (tracking off for the project), origin (hostname not in the allowed list), bot (crawler or headless browser) or limit (over the monthly budget — counted, not stored).",
  "docs.authTitle": "Authentication",
  "docs.authBody": "Three kinds of credentials, each for one job:",
  "docs.authDashboard": "Dashboard sessions: JWT bearer tokens issued by /auth/login. Hold every scope.",
  "docs.authApiKey": "Management API: API keys with a role (viewer / editor / admin). Header X-API-Key: oops_live_… (or Authorization: Bearer).",
  "docs.authPublicKey":
    "Collect API, tracker and pixel: project public keys. Header X-Project-Key: oops_pub_… (or the k field). They identify one project and can only send hits.",
  "docs.projectsTitle": "Projects",
  "docs.projectsBody":
    "A project is one site or app. It owns a public key, a time zone (used to bucket days), an optional list of allowed hostnames, and the collect / bot switches.",
  "docs.statsTitle": "Stats",
  "docs.statsBody":
    "Ranges are inclusive local dates in the tz parameter (default: the project's zone), as period=today|yesterday|7d|30d|90d|12mo or from/to. Any dimension can be passed as a filter (e.g. country=ES&device=mobile) and everything in the answer is scoped to it. Visitors are counted with a daily hash, so across several days they are daily uniques, summed.",
  "docs.dimensionsTitle": "Dimensions",
  "docs.dimensionsBody": "Usable as breakdown (by=) and as filters on every stats and events endpoint. referrer=(direct) selects hits with no referrer.",
  "docs.errorsTitle": "Errors & limits",
  "docs.errorsBody":
    "Errors are JSON: { \"error\": { \"code\", \"message\" } }. Creating past a plan limit answers 402 limit_reached with error.which = projects | api_keys. Hits over the monthly event budget are accepted (202) but not stored.",
  "docs.privacyBody":
    "Privacy: by default oops stores no raw IP addresses or user agents — only a salted daily hash and the derived device / browser / OS / location fields. A per-project switch (store_ip) keeps the raw address on each hit. Page URLs lose their query string before storage.",
  "docs.mcpTitle": "MCP (AI agents)",
  "docs.mcpBody":
    "The MCP server exposes the management API as tools, filtered by the role of the key you connect with. Destructive tools ask for confirmation. A weekly_report prompt walks a model through a project's numbers.",
  "docs.mcpLocal": "Local (stdio, npm)",
  "docs.mcpRemote": "Remote (Streamable HTTP)",
  "docs.mcpTools":
    "Tools: list_projects, get_project, create_project, update_project, rotate_project_key, delete_project, project_summary, get_stats, get_breakdown, list_events, get_live, purge_events, get_usage, get_audit_log.",
  "docs.colMethod": "Method",
  "docs.colPath": "Path",
  "docs.colScope": "Scope",
  "docs.colNotes": "Notes",

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
  "building.body":
    "Privacy-friendly analytics for your apps. The site isn't open yet — but the tracker, the collect API and the MCP server keep answering just fine.",
  "building.footer": "oops.3m4.net · coming soon",
} as const;
