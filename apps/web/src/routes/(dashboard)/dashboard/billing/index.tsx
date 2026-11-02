import { component$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { Link, type DocumentHead } from "@builder.io/qwik-city";
import { PLANS, fmtLimit, fmtRetention, type PlanKey } from "../../../../lib/plans";
import { api } from "../../../../lib/api";
import { capture } from "../../../../lib/analytics";
import { FeaturesContext } from "../../../../lib/features";
import { tr, useI18n } from "../../../../i18n";

// Self-host builds set VITE_BILLING_ENABLED=false → hide the billing page.
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED !== "false";

// There is no purchase flow: the RevenueCat integration was removed and the
// payments.3m4.net portal needs the accounts.3m4.net identity oops does not
// have yet. Until then this page only shows the current plan and its limits.
export default component$(() => {
  const features = useContext(FeaturesContext);
  const i18n = useI18n();
  const state = useStore({ plan: "free" });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    capture("billing_viewed");
    api
      .me()
      .then((me) => {
        state.plan = me.account.plan;
      })
      .catch(() => {});
  });

  if (!BILLING_ENABLED) {
    return (
      <div class="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "billing.title")}</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            {tr(i18n, "billing.selfHostTitle")}
          </p>
          <p class="mt-2 text-sm">
            {tr(i18n, "billing.selfHostDisabled")} (<code>VITE_BILLING_ENABLED=false</code>).{" "}
            {tr(i18n, "billing.selfHostLimits")}
          </p>
        </div>
      </div>
    );
  }

  if (features["early-access"]) {
    return (
      <div class="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "billing.title")}</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            {tr(i18n, "billing.earlyTitle")}
          </p>
          <p class="mt-2 text-sm">
            {tr(i18n, "billing.earlyBody")}
          </p>
          <Link href="/blog/what-paid-plans-will-include" class="btn-secondary mt-6">
            {tr(i18n, "billing.earlyLink")}
          </Link>
        </div>
      </div>
    );
  }

  if (!features.billing) {
    return (
      <div class="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "billing.title")}</h1>
        <div class="mt-6 card p-8 text-slate-600">
          <p class="font-medium text-slate-800">
            {tr(i18n, "billing.unavailableTitle")}
          </p>
          <p class="mt-2 text-sm">
            {tr(i18n, "billing.unavailableBody")}
          </p>
        </div>
      </div>
    );
  }

  const plan = PLANS[state.plan as PlanKey] ?? PLANS.free;

  return (
    <div class="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 class="text-2xl font-bold text-slate-900">{tr(i18n, "billing.title")}</h1>
      <p class="mt-2 text-slate-600">{tr(i18n, "billing.currentPlanIs", { plan: plan.label })}</p>

      <div class="mt-6 card p-8 text-left">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {tr(i18n, "billing.currentPlan")}
        </p>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">{plan.label}</h2>
        <ul class="mt-4 space-y-2 text-sm text-slate-600">
          <li>{tr(i18n, "billing.featProjects", { n: fmtLimit(plan.projects, i18n) })}</li>
          <li>{tr(i18n, "billing.featEvents", { n: fmtLimit(plan.events_per_month, i18n) })}</li>
          <li>{tr(i18n, "billing.featDataRetention", { n: fmtRetention(plan.retention_days, i18n) })}</li>
          <li>{tr(i18n, "billing.featKeys", { n: fmtLimit(plan.api_keys, i18n) })}</li>
          <li>{tr(i18n, "billing.featRetention", { n: fmtRetention(plan.audit_retention_days, i18n) })}</li>
          <li>{tr(i18n, "billing.featUsers", { n: fmtLimit(plan.max_users, i18n) })}</li>
        </ul>
      </div>

      <div class="mx-auto mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {tr(i18n, "billing.comingSoon")}
      </div>
      <Link href="/blog/what-paid-plans-will-include" class="btn-secondary mt-6">
        {tr(i18n, "billing.earlyLink")}
      </Link>
    </div>
  );
});

export const head: DocumentHead = { title: "Billing — oops" };
