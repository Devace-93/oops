/**
 * Wait for the stack and warm the SSR server before the suite: the API must
 * answer /api/healthz, the web service must serve the SDK at /o.js, and the
 * first requests after a container (re)build are slow enough to race the
 * sign-up flow, so each entry page gets one GET.
 */
import { BASE_URL } from "./playwright.config";

async function waitFor(path: string, ok: (res: Response) => Promise<boolean>, attempts = 30): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(BASE_URL + path);
      if (await ok(res)) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${BASE_URL}${path} did not come up`);
}

export default async function globalSetup(): Promise<void> {
  await waitFor("/api/healthz", async (res) => res.ok && (await res.json()).status === "ok");
  await waitFor("/o.js", async (res) => res.ok && (await res.text()).includes("oops-js/"));
  for (const path of ["/", "/signup/", "/login/", "/dashboard/"]) {
    await waitFor(path, async (res) => res.ok, 10).catch(() => {});
  }
}
