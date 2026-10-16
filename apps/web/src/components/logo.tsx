import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

/** Wordmark for oops (fuchsia bar-chart mark + "oops") — links home. */
export const Logo = component$<{ href?: string }>(({ href = "/" }) => {
  return (
    <Link href={href} class="flex items-center gap-2 font-bold tracking-tight">
      <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary-600" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {/* three rising columns */}
          <rect x="3" y="11" width="3.5" height="6" rx="1" fill="#ffffff" fill-opacity="0.75" />
          <rect x="8.25" y="7" width="3.5" height="10" rx="1" fill="#ffffff" fill-opacity="0.9" />
          <rect x="13.5" y="3" width="3.5" height="14" rx="1" fill="#ffffff" />
        </svg>
      </span>
      <span class="text-lg text-slate-900">
        <span class="text-primary-600">oops</span>
      </span>
    </Link>
  );
});
