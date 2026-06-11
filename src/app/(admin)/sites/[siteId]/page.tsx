import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  BookOpenCheck,
  ArrowRight,
  Globe2,
  MessageCircle,
  MessageSquareText,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { SiteConfigForm } from "./_components/site-config-form";
import { EmbedSnippet } from "./_components/embed-snippet";
import { GettingStarted } from "./_components/getting-started";
import { SiteMonitorView } from "./_components/site-monitor-view";

function hostLabel(value: string) {
  if (!value.trim()) return "Not set";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteId } = await params;
  const sp = (await searchParams) ?? {};
  const viewRaw = Array.isArray(sp.view) ? sp.view[0] : sp.view;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const focusRaw = Array.isArray(sp.focus) ? sp.focus[0] : sp.focus;
  const view = viewRaw === "monitor" || tabRaw === "monitor" ? "monitor" : "setup";
  const initialTab =
    tabRaw === "branding" || tabRaw === "appearance"
      ? "branding"
      : tabRaw === "behavior"
        ? "behavior"
        : tabRaw === "knowledge" || tabRaw === "sources"
          ? "knowledge"
          : undefined;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: siteId, orgId: user?.orgId ?? "" },
  });

  if (!site) notFound();

  const [totalSessions, totalMessages, outOfScope] = await Promise.all([
    db.chatSession.count({ where: { siteId: site.id } }),
    db.message.count({ where: { session: { siteId: site.id }, role: "user" } }),
    db.analyticsEvent.count({ where: { siteId: site.id, type: "out_of_scope" } }),
  ]);

  const primaryOrigin = (() => {
    try {
      if (!site.primaryUrl) return "";
      const u = new URL(site.primaryUrl);
      return `${u.origin}/`;
    } catch {
      return "";
    }
  })();
  const allowedDomainsCount = getUserFacingAllowedDomains(
    site.allowedDomains,
    env.NEXTAUTH_URL,
  ).length;
  const hasWebsite = Boolean(site.primaryUrl.trim());
  const hasDomains = allowedDomainsCount > 0;
  const hasKnowledge = Boolean(site.livePineconeNs);
  const focusInstallPanel =
    view === "setup" &&
    (focusRaw === "embed" || tabRaw === "install" || tabRaw === "publish");
  const sourcePanelOpen = view === "setup" && initialTab === "knowledge";
  const sourceEditorWide = sourcePanelOpen && !focusInstallPanel;
  const prioritizeSetupPanel = view === "setup" && (Boolean(initialTab) || focusInstallPanel);
  const showSetupOverview = view === "setup" && !prioritizeSetupPanel;
  const nextAction = !hasWebsite
    ? {
        title: "Set the website URL",
        body: "Start by saving the public site this widget represents.",
        href: `/sites/${site.id}?view=setup&tab=branding`,
        label: "Open branding",
        tone: "amber" as const,
        icon: Globe2,
      }
    : !hasDomains
      ? {
          title: "Add allowed domains",
          body: "Choose where the published widget is allowed to load.",
          href: `/sites/${site.id}?view=setup&tab=behavior`,
          label: "Open behavior",
          tone: "amber" as const,
          icon: ShieldCheck,
        }
      : !hasKnowledge
        ? {
            title: "Add knowledge sources",
            body: "Build searchable knowledge before answer testing or publishing.",
            href: `/sites/${site.id}?view=setup&tab=knowledge#source-pages`,
            label: sourcePanelOpen ? "Review knowledge" : "Open knowledge",
            tone: "amber" as const,
            icon: BookOpenCheck,
          }
        : !site.isActive
          ? {
              title: "Preview and publish",
              body: "Knowledge is ready. Review the widget and publish when the install looks right.",
              href: `/sites/${site.id}?view=setup&focus=embed#embed`,
              label: "Open install",
              tone: "blue" as const,
              icon: Rocket,
            }
          : {
              title: "Monitor live conversations",
              body: "The widget is live. Review visitor questions, answers, and citation coverage.",
              href: `/sites/${site.id}?view=monitor`,
              label: "Open monitor",
              tone: "green" as const,
              icon: MessageSquareText,
            };
  const NextActionIcon = nextAction.icon;
  const readinessItems = [
    {
      label: "Website",
      value: hasWebsite ? hostLabel(site.primaryUrl) : "Needed",
      detail: hasWebsite ? "Primary URL saved" : "Add the public site URL",
      tone: hasWebsite ? "ready" : "warn",
      icon: Globe2,
    },
    {
      label: "Allowed domains",
      value:
        allowedDomainsCount === 0
          ? "Needed"
          : allowedDomainsCount === 1
            ? "1 domain"
          : `${allowedDomainsCount} domains`,
      detail: hasDomains ? "Widget can load there" : "Add visitor-facing domains",
      tone: hasDomains ? "ready" : "warn",
      icon: ShieldCheck,
    },
    {
      label: "Knowledge",
      value: hasKnowledge ? "Ready" : "Needed",
      detail: hasKnowledge ? "Answers can cite trusted pages" : "Import content before publishing",
      tone: hasKnowledge ? "ready" : "warn",
      icon: BookOpenCheck,
    },
    {
      label: "Conversations",
      value: totalSessions === 0 ? "0 chats" : `${totalSessions} chats`,
      detail:
        totalMessages === 1
          ? "1 visitor message"
          : `${totalMessages} visitor messages`,
      tone: totalSessions > 0 ? "ready" : "neutral",
      icon: MessageSquareText,
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: site.primaryColor }}
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold text-gray-900">{site.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                <span>Website URL:</span>
                {site.primaryUrl ? (
                  <a
                    href={site.primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-8 max-w-full items-center break-all rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    {site.primaryUrl}
                  </a>
                ) : (
                  <span className="text-gray-400">(not set)</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                  site.isActive
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
                title={site.isActive ? "Widget is live" : "Widget is preview only"}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    site.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {site.isActive ? "Live" : "Preview only"}
              </span>
            </div>
            {view === "setup" ? (
              <a
                href={`/widget-demo?siteId=${site.id}&url=${encodeURIComponent(primaryOrigin || "https://example.com/")}`}
                className="inline-flex w-full min-w-[10rem] items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:ring-offset-2 sm:w-auto"
              >
                Preview widget
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {showSetupOverview ? (
        <>
          <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="grid divide-y divide-gray-100 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {readinessItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex min-w-0 items-start gap-3 px-4 py-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        item.tone === "ready"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : item.tone === "warn"
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase text-gray-400">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-semibold text-gray-900">
                        {item.value}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-gray-500">
                        {item.detail}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className={`mb-6 rounded-lg border px-4 py-3 shadow-sm ${
              nextAction.tone === "green"
                ? "border-emerald-200 bg-emerald-50"
                : nextAction.tone === "blue"
                  ? "border-blue-200 bg-blue-50"
                  : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/85 ${
                    nextAction.tone === "green"
                      ? "text-emerald-700"
                      : nextAction.tone === "blue"
                        ? "text-blue-700"
                        : "text-amber-700"
                  }`}
                >
                  <NextActionIcon className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-semibold ${
                      nextAction.tone === "green"
                        ? "text-emerald-950"
                        : nextAction.tone === "blue"
                          ? "text-blue-950"
                          : "text-amber-950"
                    }`}
                  >
                    Next best action: {nextAction.title}
                  </p>
                  <p
                    className={`mt-1 text-sm leading-6 ${
                      nextAction.tone === "green"
                        ? "text-emerald-900/80"
                        : nextAction.tone === "blue"
                          ? "text-blue-900/80"
                          : "text-amber-900/85"
                    }`}
                  >
                    {nextAction.body}
                  </p>
                </div>
              </div>
              <a
                href={nextAction.href}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-gray-950 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
              >
                {nextAction.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
        </>
      ) : null}

      <div className="mb-6">
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-1.5 shadow-sm">
          <a
            href={`/sites/${site.id}?view=setup${initialTab ? `&tab=${initialTab}` : ""}`}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              view === "setup"
                ? "bg-gray-950 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Setup
          </a>
          <a
            href={`/sites/${site.id}?view=monitor`}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              view === "monitor"
                ? "bg-gray-950 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Monitor
          </a>
        </div>
      </div>

      {view === "setup" ? (
        <div
          className={
            sourceEditorWide
              ? "flex flex-col gap-6"
              : "flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start"
          }
        >
          <div
            className={
              prioritizeSetupPanel ? "order-1 min-w-0 xl:order-1" : "order-2 min-w-0 xl:order-1"
            }
          >
            {focusInstallPanel ? (
              <div id="embed" className="mb-6 scroll-mt-6">
                <EmbedSnippet
                  siteId={site.id}
                  primaryUrl={site.primaryUrl ?? ""}
                  allowedDomainsCount={allowedDomainsCount}
                  livePineconeNamespace={site.livePineconeNs}
                  isActive={site.isActive}
                />
              </div>
            ) : null}
            {focusInstallPanel ? (
              <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900">Change setup settings</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      Update the saved website, domains, or knowledge sources before publishing.
                    </p>
                  </div>
                  <a
                    href={`/sites/${site.id}?view=setup&tab=knowledge#source-pages`}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-gray-950 px-3 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    Open knowledge
                  </a>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  {[
                    {
                      href: `/sites/${site.id}?view=setup&tab=branding`,
                      label: "Branding",
                      value: hasWebsite ? hostLabel(site.primaryUrl) : "Website URL needed",
                      icon: Globe2,
                      ready: hasWebsite,
                    },
                    {
                      href: `/sites/${site.id}?view=setup&tab=behavior`,
                      label: "Allowed domains",
                      value:
                        allowedDomainsCount === 0
                          ? "Domains needed"
                          : allowedDomainsCount === 1
                            ? "1 domain"
                            : `${allowedDomainsCount} domains`,
                      icon: ShieldCheck,
                      ready: hasDomains,
                    },
                    {
                      href: `/sites/${site.id}?view=setup&tab=knowledge#source-pages`,
                      label: "Knowledge",
                      value: hasKnowledge ? "Ready" : "Needs import",
                      icon: BookOpenCheck,
                      ready: hasKnowledge,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <a
                        key={item.label}
                        href={item.href}
                        className="flex min-w-0 items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 hover:bg-white"
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                            item.ready
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold uppercase text-gray-500">
                            {item.label}
                          </span>
                          <span className="mt-1 block truncate text-sm font-semibold text-gray-900">
                            {item.value}
                          </span>
                        </span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ) : (
              <SiteConfigForm
                site={site}
                defaultPineconeIndex=""
                defaultPineconeIndexHost={env.PINECONE_INDEX_HOST ?? ""}
                internalAppHost={new URL(env.NEXTAUTH_URL).host}
                initialTab={initialTab}
                plan={session.user.plan}
              />
            )}
          </div>
          <aside
            className={`space-y-6 ${
              sourceEditorWide
                ? "order-2"
                : `xl:sticky xl:top-6 ${
                    prioritizeSetupPanel ? "order-2 xl:order-2" : "order-1 xl:order-2"
                  }`
            }`}
          >
            <GettingStarted
              siteId={site.id}
              primaryUrl={site.primaryUrl ?? ""}
              allowedDomainsCount={allowedDomainsCount}
              livePineconeNamespace={site.livePineconeNs}
              isActive={site.isActive}
              compact
            />
            {!focusInstallPanel ? (
              <div id="embed">
                <EmbedSnippet
                  siteId={site.id}
                  primaryUrl={site.primaryUrl ?? ""}
                  allowedDomainsCount={allowedDomainsCount}
                  livePineconeNamespace={site.livePineconeNs}
                  isActive={site.isActive}
                  compact
                />
              </div>
            ) : null}
          </aside>
        </div>
      ) : (
        <SiteMonitorView
          siteId={site.id}
          totalSessions={totalSessions}
          totalMessages={totalMessages}
          outOfScope={outOfScope}
          isActive={site.isActive}
          livePineconeNamespace={site.livePineconeNs}
        />
      )}
    </div>
  );
}
