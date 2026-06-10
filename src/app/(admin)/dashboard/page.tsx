import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Globe2,
  MessageCircle,
  PlusCircle,
  RadioTower,
} from "lucide-react";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { Card, CardContent } from "~/components/ui/card";
import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { CreateSiteButton } from "../sites/_components/create-site-button";

function hostLabel(value: string) {
  if (!value.trim()) return "No website URL";
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

function formatUpdatedAt(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function countNeedsSetupLabel(count: number) {
  return count === 1 ? "1 widget needs setup" : `${count} widgets need setup`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const [
    readinessSites,
    totalSessions,
    totalMessages,
    recentSites,
  ] = await Promise.all([
    user?.orgId
      ? db.site.findMany({
          where: { orgId: user.orgId },
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
      : [],
    user?.orgId
      ? db.chatSession.count({ where: { site: { orgId: user.orgId } } })
      : 0,
    user?.orgId
      ? db.message.count({
          where: { session: { site: { orgId: user.orgId } }, role: "user" },
        })
      : 0,
    user?.orgId
      ? db.site.findMany({
          where: { orgId: user.orgId },
          select: {
            id: true,
            name: true,
            title: true,
            primaryColor: true,
            primaryUrl: true,
            allowedDomains: true,
            isActive: true,
            livePineconeNs: true,
            updatedAt: true,
            _count: { select: { chatSessions: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
        })
      : [],
  ]);

  const isReady = (site: {
    primaryUrl: string;
    allowedDomains: string[];
    livePineconeNs: string | null;
  }) =>
    Boolean(site.primaryUrl.trim()) &&
    getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length > 0 &&
    Boolean(site.livePineconeNs);
  const siteCount = readinessSites.length;
  const activeSiteCount = readinessSites.filter((site) => site.isActive).length;
  const readySiteCount = readinessSites.filter(isReady).length;
  const pendingSetupSite = readinessSites.find((site) => !isReady(site)) ?? null;
  const readyInactiveSite = readinessSites.find((site) => !site.isActive && isReady(site)) ?? null;
  const activeSite = readinessSites.find((site) => site.isActive) ?? null;
  const needsSetupCount = Math.max(0, siteCount - readySiteCount);
  const readyInactiveCount = readinessSites.filter((site) => !site.isActive && isReady(site)).length;
  const pendingSetupHref = pendingSetupSite
    ? `/sites/${pendingSetupSite.id}?view=setup&tab=${
        !pendingSetupSite.primaryUrl.trim()
          ? "branding"
          : getUserFacingAllowedDomains(pendingSetupSite.allowedDomains, env.NEXTAUTH_URL)
                .length === 0
            ? "behavior"
            : "knowledge"
      }`
    : "/sites";

  const stats = [
    {
      label: "Widgets",
      value: siteCount,
      detail: countNeedsSetupLabel(needsSetupCount),
      href: "/sites",
      icon: Globe2,
    },
    {
      label: "Live widgets",
      value: activeSiteCount,
      detail: `${readyInactiveCount} ready for launch`,
      href: "/sites",
      icon: RadioTower,
    },
    {
      label: "Conversations",
      value: totalSessions,
      detail: "Across all widgets",
      href: null,
      icon: MessageCircle,
    },
    {
      label: "Visitor questions",
      value: totalMessages,
      detail: "Questions captured by widgets",
      href: null,
      icon: BarChart3,
    },
  ];

  const actionQueue =
    siteCount === 0
      ? [
          {
            title: "Create your first widget",
            body: "Start with a public URL, then the setup checklist will walk you through knowledge sources and publishing the widget.",
            href: "/sites",
            tone: "blue" as const,
          },
        ]
      : [
          ...(needsSetupCount > 0
            ? [
                {
                  title:
                    needsSetupCount === 1
                      ? "1 widget needs setup"
                      : `${needsSetupCount} widgets need setup`,
                  body: pendingSetupSite
                    ? `Continue with ${pendingSetupSite.name}: finish the URL, domains, or knowledge sources before publishing.`
                    : "Finish website URLs, domains, and knowledge sources before publishing.",
                  href: pendingSetupHref,
                  tone: "amber" as const,
                },
              ]
            : []),
          ...(readyInactiveCount > 0
            ? [
                {
                  title: `${readyInactiveCount} widget${readyInactiveCount === 1 ? "" : "s"} ready to publish`,
                  body: readyInactiveSite
                    ? `Preview ${readyInactiveSite.name}, then publish it on approved domains.`
                    : "Preview the widget, then publish it on approved domains.",
                  href: readyInactiveSite
                    ? `/sites/${readyInactiveSite.id}?view=setup&focus=embed#embed`
                    : "/sites",
                  tone: "blue" as const,
                },
              ]
            : []),
          ...(activeSiteCount > 0
            ? [
                {
                  title: "Monitor live widgets",
                  body: activeSite
                    ? `Review conversations and questions outside coverage for ${activeSite.name}.`
                    : "Review conversations and questions outside coverage from active widgets.",
                  href: activeSite ? `/sites/${activeSite.id}?view=monitor` : "/sites",
                  tone: "green" as const,
                },
              ]
            : []),
        ];

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back, {session?.user.email}
          </p>
        </div>
        <CreateSiteButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-gray-500">{s.label}</p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-600">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900">{s.value}</p>
                <p className="mt-1 text-xs font-medium text-gray-500">{s.detail}</p>
                {s.href && (
                  <Link
                    href={s.href}
                    className="mt-3 inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950"
                  >
                    View widgets
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {siteCount === 0 && (
        <div className="mt-8 rounded-lg border-2 border-dashed border-gray-200 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100">
            <PlusCircle className="h-6 w-6 text-gray-700" aria-hidden />
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Create your first widget
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add a public URL, refresh knowledge from trusted sources, preview the widget, then publish it.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateSiteButton />
          </div>
        </div>
      )}

      {siteCount > 0 ? (
        <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Next steps</h2>
                <p className="mt-1 text-sm text-gray-500">
                  What to finish before visitors rely on each widget.
                </p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
            </div>
            <div className="mt-4 space-y-2">
              {actionQueue.length ? (
                actionQueue.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`block rounded-lg border px-3 py-3 transition-colors hover:bg-gray-50 ${
                      item.tone === "amber"
                        ? "border-amber-200 bg-amber-50/60"
                        : item.tone === "green"
                          ? "border-emerald-200 bg-emerald-50/60"
                          : "border-blue-200 bg-blue-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                      <ArrowRight className="h-4 w-4 text-gray-500" aria-hidden />
                    </div>
                    <p className="mt-1 text-xs leading-5 text-gray-600">{item.body}</p>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                  <p className="text-sm font-semibold text-green-900">All widgets are ready</p>
                  <p className="mt-1 text-xs leading-5 text-green-800">
                    Published widgets can now be monitored from each widget's conversation history.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Recent widgets</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Last updated widgets and their readiness.
                </p>
              </div>
              <Link
                href="/sites"
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                All widgets
              </Link>
            </div>
            <div className="mt-4 divide-y divide-gray-100">
              {recentSites.map((site) => {
                const hasWebsite = Boolean(site.primaryUrl.trim());
                const hasDomains =
                  getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length > 0;
                const hasKnowledge = Boolean(site.livePineconeNs);
                const isReady = hasWebsite && hasDomains && hasKnowledge;
                      const status = site.isActive
                        ? { label: "Live", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" }
                        : isReady
                          ? { label: "Ready", cls: "border-blue-200 bg-blue-50 text-blue-700" }
                          : {
                              label: !hasWebsite
                                ? "Needs URL"
                                : !hasDomains
                                  ? "Needs domains"
                                  : "Needs knowledge",
                              cls: "border-amber-200 bg-amber-50 text-amber-700",
                            };
                const href = `/sites/${site.id}${
                  site.isActive
                    ? "?view=monitor"
                    : isReady
                      ? "?view=setup"
                      : !hasWebsite
                        ? "?view=setup&tab=branding"
                        : !hasDomains
                          ? "?view=setup&tab=behavior"
                          : "?view=setup&tab=knowledge"
                }`;
                return (
                  <Link
                    key={site.id}
                    href={href}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-gray-50/70"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: site.primaryColor }}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {site.name}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {hostLabel(site.primaryUrl)} · {site._count.chatSessions} chats · updated{" "}
                        {formatUpdatedAt(site.updatedAt)}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}
                    >
                      {status.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
