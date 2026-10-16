import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

/** Wordmark for oops (fuchsia tile with a bug glyph + "oops") — links home. */
export const Logo = component$<{ href?: string }>(({ href = "/" }) => {
  return (
    <Link href={href} class="flex items-center gap-2 font-bold tracking-tight">
      <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary-600" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {/* a small bug: body, head, legs and antennae */}
          <ellipse cx="10" cy="11.5" rx="4.5" ry="5.5" fill="#ffffff" />
          <circle cx="10" cy="4.5" r="2.4" fill="#ffffff" />
          <path d="M8.6 2.8L7.2 1M11.4 2.8L12.8 1" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />
          <path d="M5.5 9H3M5.5 12.5H3M5.8 15.5L3.8 17M14.5 9H17M14.5 12.5H17M14.2 15.5L16.2 17" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" />
          <path d="M10 7v9" stroke="#c026d3" stroke-width="1.2" stroke-linecap="round" />
        </svg>
      </span>
      <span class="text-lg text-slate-900">
        <span class="text-primary-600">oops</span>
      </span>
    </Link>
  );
});
