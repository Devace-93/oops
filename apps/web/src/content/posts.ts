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
    slug: "what-paid-plans-will-include",
    title: "Launching oops in early access: everything is free for now. Here is what paid plans will include later.",
    date: "2026-10-15",
    summary:
      "oops counts the visits to your apps — page views, visitors, pages, referrers, countries, devices and browsers — from one script tag, a pixel or an API call, without cookies and without storing anyone's IP address. It is in early access: every account gets the full product at no cost. This post explains what will eventually sit behind paid plans, and what stays free.",
    sections: [
      {
        paragraphs: [
          "oops is the fourth app in the 3m4 family, after the URL shortener, the feature-flag service and the user-feedback inbox. It answers one question: who is visiting my apps, from where, on what? Each project gets a public key; drop one script tag in your site and page views start flowing into a dashboard with a time series, top pages, referrers, countries and cities, devices, browsers, operating systems, languages and UTM campaigns. No JavaScript possible (an email, a README)? Use the tracking pixel. Server-side? Post to the collect API.",
          "It is deliberately privacy-friendly: the tracker sets no cookie and stores nothing in the browser, the server hashes the IP address with a salt that rotates every day and keeps only the derived country, region and city, and raw user agents are discarded once device, browser and OS have been read. There is nothing to put in a cookie banner.",
          "The hosted version at oops.3m4.net is in early access. During early access every account gets the full product: unlimited projects, unlimited events, full data retention, the management API and the MCP server. No card, no trial clock.",
        ],
      },
      {
        heading: "What stays free",
        bullets: [
          "Self-hosting. The whole stack is MIT licensed and always will be; a self-hosted instance has no limits beyond the ones you configure.",
          "A free hosted tier with a few projects, a monthly budget of events and a sensible retention window.",
          "The tracker, the pixel, the collect API, every breakdown in the dashboard, custom events and the live counter.",
          "Basic API access with scoped API keys, and the MCP server for AI agents.",
        ],
      },
      {
        heading: "What will move under paid plans",
        paragraphs: ["The things that cost money to run at scale, or that mostly matter to teams and businesses:"],
        bullets: [
          "Higher counts: more projects and more API keys.",
          "Bigger monthly event budgets. Past the budget the tracker keeps answering (your site never sees an error), but the extra hits are counted and not stored, and the dashboard tells you.",
          "Longer data retention (a year or two of raw events instead of 90 days).",
          "Longer audit-log retention (a year or more instead of a rolling week).",
          "Team seats, roles and priority support.",
          "Enterprise: SSO, SLA and custom limits.",
        ],
      },
      {
        heading: "What happens when plans arrive",
        paragraphs: [
          "The tracker and the collect API never answer with an error. Whatever plan you end up on, every public key you shipped keeps working.",
          "We will announce the change here and by email before any limit applies to an existing account, with enough notice to export your data or pick a plan.",
          "The planned tiers are already listed on the pricing page so there are no surprises. Prices and limits there are our current intent, not a contract, and may still change before launch.",
        ],
      },
      {
        heading: "Questions or opinions?",
        paragraphs: [
          "Early access exists to collect them — and yes, oops uses oops: this very site is tracked with its own script. Tell us which of the items above you would pay for, and which you would not; it directly shapes the final plans.",
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
