/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** Public origin of this app (e.g. https://oops.3m4.net); used in docs snippets. */
  readonly VITE_APP_URL?: string;
  /** Apps index (info.3m4.net); footer link shared by every 3m4 app. */
  readonly VITE_INFO_URL?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_REVENUECAT_PUBLIC_KEY?: string;
  readonly VITE_BILLING_ENABLED?: string;
  /** metrics.3m4.net project public key for tracking oops itself; the tracker is rendered only when set. */
  readonly VITE_METRICS_PROJECT_KEY?: string;
  readonly VITE_METRICS_TRACKER_URL?: string;
  /** oops project public key for reporting oops' own front-end errors to itself; the SDK is rendered only when set. */
  readonly VITE_OOPS_PROJECT_KEY?: string;
  /** SDK script URL; defaults to this app's own /o.js. */
  readonly VITE_OOPS_SDK_URL?: string;
  /** Environment tag sent with every event; defaults to "production". */
  readonly VITE_OOPS_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
