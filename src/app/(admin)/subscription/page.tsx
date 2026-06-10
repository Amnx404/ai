import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  DatabaseZap,
  Gauge,
  Mail,
  RadioTower,
  Sparkles,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

type PlanKey = "FREE" | "PRO" | "MAX";

const PLAN_DETAILS: Array<{
  key: PlanKey;
  title: string;
  activeSites: number;
  refreshPreset: string;
  workers: string;
  modelAccess: string;
  bestFor: string;
}> = [
  {
    key: "FREE",
    title: "Free",
    activeSites: 1,
    refreshPreset: "Basic reading: 10 pages",
    workers: "Quick reading: 3 workers",
    modelAccess: "Standard model",
    bestFor: "Testing one small docs or support widget.",
  },
  {
    key: "PRO",
    title: "Pro",
    activeSites: 3,
    refreshPreset: "Wide reading: 50 pages",
    workers: "Speedy reading: 7 workers",
    modelAccess: "Advanced model choices",
    bestFor: "Running a few production widgets with deeper docs.",
  },
  {
    key: "MAX",
    title: "Max",
    activeSites: 10,
    refreshPreset: "Thorough reading: 1000 pages",
    workers: "Fastest reading: 10 workers",
    modelAccess: "Full model access",
    bestFor: "Multi-property rollouts and large documentation sets.",
  },
];

function activeLimitForPlan(plan: PlanKey) {
  return PLAN_DETAILS.find((item) => item.key === plan)?.activeSites ?? 1;
}

function pct(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function missingSetupLabel(site: {
  primaryUrl: string;
  allowedDomains: string[];
  livePineconeNs: string | null;
}) {
  if (!site.primaryUrl.trim()) return "website URL";
  if (getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length === 0) {
    return "allowed domains";
  }
  if (!site.livePineconeNs) return "knowledge";
  return "setup";
}

function missingSetupHref(site: {
  id: string;
  primaryUrl: string;
  allowedDomains: string[];
  livePineconeNs: string | null;
}) {
  if (!site.primaryUrl.trim()) return `/sites/${site.id}?view=setup&tab=branding`;
  if (getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length === 0) {
    return `/sites/${site.id}?view=setup&tab=behavior`;
  }
  return `/sites/${site.id}?view=setup&tab=knowledge`;
}

function hostLabel(value: string) {
  if (!value.trim()) return "No website URL";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default async function SubscriptionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true, plan: true, email: true } as any,
  });

  const plan = (((user as any)?.plan as PlanKey | undefined) ?? "FREE") as PlanKey;
  const activeLimit = activeLimitForPlan(plan);
  const orgId = ((user as any)?.orgId ?? null) as string | null;

  const readinessSites = orgId
    ? await db.site.findMany({
        where: { orgId },
        select: {
          id: true,
          name: true,
          primaryUrl: true,
          allowedDomains: true,
          isActive: true,
          livePineconeNs: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
      })
    : [];

  const isReady = (site: {
    primaryUrl: string;
    allowedDomains: string[];
    livePineconeNs: string | null;
  }) =>
    Boolean(site.primaryUrl.trim()) &&
    getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length > 0 &&
    Boolean(site.livePineconeNs);
  const siteCount = readinessSites.length;
  const activeCount = readinessSites.filter((site) => site.isActive).length;
  const readyCount = readinessSites.filter(isReady).length;
  const pendingSetupSite = readinessSites.find((site) => !isReady(site)) ?? null;

  const setupNeededCount = Math.max(0, siteCount - readyCount);
  const readyInactiveCount = Math.max(0, readyCount - activeCount);
  const activeSlotsRemaining = Math.max(0, activeLimit - activeCount);
  const activeSites = readinessSites.filter((site) => site.isActive);
  const readyInactiveSites = readinessSites.filter((site) => !site.isActive && isReady(site));
  const setupNeededSites = readinessSites.filter((site) => !isReady(site));
  const pendingMissing = pendingSetupSite ? missingSetupLabel(pendingSetupSite) : "setup";
  const pendingSetupHref = pendingSetupSite ? missingSetupHref(pendingSetupSite) : "/sites";
  const nextAction =
    setupNeededCount > 0
      ? {
          icon: AlertCircle,
          title:
            setupNeededCount === 1
              ? "1 widget needs setup"
              : `${setupNeededCount} widgets need setup`,
          body: pendingSetupSite
            ? `${pendingSetupSite.name} needs ${pendingMissing} before it can be published.`
            : "Finish website URLs, allowed domains, and knowledge before publishing.",
          href: pendingSetupHref,
          label: "Continue setup",
          className: "border-amber-200 bg-amber-50 text-amber-900",
        }
      : readyInactiveCount > 0 && activeSlotsRemaining === 0
        ? {
            icon: Gauge,
            title: "Active widget capacity is full",
            body: `${readyInactiveCount} ready widget${readyInactiveCount === 1 ? " is" : "s are"} waiting, but ${plan} already has ${activeCount}/${activeLimit} active widgets. Stop a live widget or request a plan change.`,
            href: "/sites",
            label: "Manage live widgets",
            className: "border-amber-200 bg-amber-50 text-amber-900",
          }
      : readyInactiveCount > 0
        ? {
            icon: RadioTower,
            title: `${readyInactiveCount} ready widget${readyInactiveCount === 1 ? "" : "s"} can go live`,
            body: "Preview ready widgets, then publish the ones that should appear on approved domains.",
            href: "/sites",
            label: "Review ready widgets",
            className: "border-blue-200 bg-blue-50 text-blue-900",
          }
        : activeSlotsRemaining === 0
          ? {
              icon: Gauge,
              title: "Active widget capacity is full",
              body: "Stop an unused live widget or request a plan change before publishing another one.",
              href: "/sites",
              label: "Manage live widgets",
              className: "border-amber-200 bg-amber-50 text-amber-900",
            }
          : {
              icon: CheckCircle2,
              title: "Account is ready for more widgets",
              body: `${activeSlotsRemaining} active widget slot${activeSlotsRemaining === 1 ? "" : "s"} available on ${plan}.`,
              href: "/sites",
              label: "Manage widgets",
              className: "border-emerald-200 bg-emerald-50 text-emerald-900",
            };
  const NextActionIcon = nextAction.icon;

  const to = "hello@altegolabs.com";
  const subject = "ALT EGO - Beta access";
  const body = [
    "Hi ALT EGO team,",
    "",
    `Current plan: ${plan}`,
    `Account: ${(user as any)?.email ?? session.user.email ?? ""}`,
    `Active widgets: ${activeCount}/${activeLimit}`,
    `Total widgets: ${siteCount}`,
    "",
    "I'd like beta access for:",
    "Website:",
    "Use case:",
    "Approx. pages to read:",
    "Live widgets needed:",
    "",
    "Thanks!",
  ].join("\n");
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    body,
  )}`;
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    to,
  )}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
            Beta access
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">Plans & limits</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            Your current tier controls active widgets, knowledge presets, reading speed, and model
            choices. Paid upgrades are still handled manually during beta.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <a href={mailto}>
              <Mail className="h-4 w-4" aria-hidden />
              Request plan change
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href={gmail} target="_blank" rel="noreferrer">
              Open Gmail draft
            </a>
          </Button>
        </div>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Current plan</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white">
                {plan}
              </span>
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
                {activeCount}/{activeLimit} active widgets
              </span>
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
                {readyInactiveCount} ready to publish
              </span>
              <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700">
                {activeSlotsRemaining} active slots open
              </span>
            </div>
          </div>
          <div className="min-w-0 lg:w-80">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-600">
              <span>Active widget capacity</span>
              <span>{pct(activeCount, activeLimit)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gray-900"
                style={{ width: `${pct(activeCount, activeLimit)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className={`rounded-lg border p-5 shadow-sm ${nextAction.className}`}>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80">
              <NextActionIcon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Next best action</p>
              <h2 className="mt-1 text-lg font-semibold">{nextAction.title}</h2>
              <p className="mt-1 text-sm leading-6 opacity-80">{nextAction.body}</p>
              <Link
                href={nextAction.href}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
              >
                {nextAction.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
          {[
            { label: "Total widgets", value: siteCount, icon: DatabaseZap },
            { label: "Live", value: activeCount, icon: RadioTower },
            { label: "Ready to publish", value: readyInactiveCount, icon: CheckCircle2 },
            { label: "Needs setup", value: setupNeededCount, icon: AlertCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold leading-4 text-gray-500">{item.label}</p>
                  <Icon className="h-4 w-4 text-gray-400" aria-hidden />
                </div>
                <p className="mt-2 text-2xl font-semibold text-gray-900">{item.value}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Publish capacity</h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              See what is live, what can publish next, and what still needs setup before it can use a slot.
            </p>
          </div>
          <span className="w-fit rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
            {activeSlotsRemaining} slot{activeSlotsRemaining === 1 ? "" : "s"} open
          </span>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Active slots</p>
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {activeCount}/{activeLimit}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {activeSites.length ? (
                activeSites.slice(0, 5).map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}?view=monitor`}
                    className="block rounded-lg border border-emerald-200 bg-white px-3 py-2 hover:bg-emerald-50/40"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">{site.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{hostLabel(site.primaryUrl)}</p>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                  No live widgets are using capacity yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Ready queue</p>
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {readyInactiveCount}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {readyInactiveSites.length ? (
                readyInactiveSites.slice(0, 5).map((site) => (
                  <Link
                    key={site.id}
                    href={`/sites/${site.id}?view=setup&focus=embed#embed`}
                    className={`block rounded-lg border px-3 py-2 hover:bg-blue-50/40 ${
                      activeSlotsRemaining > 0
                        ? "border-blue-200 bg-white"
                        : "border-amber-200 bg-amber-50/70"
                    }`}
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">{site.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-600">
                      {activeSlotsRemaining > 0
                        ? "Ready to preview and publish"
                        : "Ready, but active capacity is full"}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                  No ready drafts are waiting to publish.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">Setup blockers</p>
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                {setupNeededCount}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {setupNeededSites.length ? (
                setupNeededSites.slice(0, 5).map((site) => (
                  <Link
                    key={site.id}
                    href={missingSetupHref(site)}
                    className="block rounded-lg border border-amber-200 bg-white px-3 py-2 hover:bg-amber-50/40"
                  >
                    <p className="truncate text-sm font-semibold text-gray-900">{site.name}</p>
                    <p className="mt-0.5 truncate text-xs text-amber-800">
                      Needs {missingSetupLabel(site)}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white px-3 py-4 text-sm text-gray-500">
                  Every widget has the required setup.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {PLAN_DETAILS.map((item) => {
          const isCurrent = item.key === plan;
          return (
            <div
              key={item.key}
              className={`rounded-lg border bg-white p-5 shadow-sm ${
                isCurrent ? "border-gray-900 ring-1 ring-gray-900/10" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">{item.bestFor}</p>
                </div>
                {isCurrent ? (
                  <span className="rounded-lg bg-gray-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                    Current
                  </span>
                ) : null}
              </div>
              <ul className="mt-4 space-y-2 text-xs leading-5 text-gray-700">
                {[
                  `${item.activeSites} active widget${item.activeSites === 1 ? "" : "s"}`,
                  item.refreshPreset,
                  item.workers,
                  item.modelAccess,
                ].map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: RadioTower,
              title: "Active widget limit",
              body: "Only active widgets are counted. Draft widgets can still be configured and previewed.",
            },
            {
              icon: Gauge,
              title: "Reading presets",
              body: "Plan gates apply to the visible page limits and reading speed controls.",
            },
            {
              icon: Sparkles,
              title: "Manual beta upgrades",
              body: "Send your expected page count and live widget count. We will unlock the right tier.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <Icon className="h-4 w-4 text-gray-700" aria-hidden />
                <p className="mt-3 text-sm font-semibold text-gray-900">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-gray-600">{item.body}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
