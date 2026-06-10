"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  DatabaseZap,
  MessageCircle,
  RadioTower,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { SiteActiveSwitch } from "./site-active-switch";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

function modelLabel(modelId: string) {
  return modelId.split("/").pop()?.replace(/-/g, " ") ?? modelId;
}

function domainSummary(domains: string[]) {
  if (domains.length === 0) return "No domains set";
  if (domains.length <= 2) return domains.join(", ");
  return `${domains.slice(0, 2).join(", ")} +${domains.length - 2}`;
}

function needsSetupLabel(count: number) {
  return count === 1 ? "1 widget needs setup" : `${count} widgets need setup`;
}

function hostLabel(value: string) {
  if (!value.trim()) return "No website URL";
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
}

type SiteStatus = "all" | "needs-setup" | "ready" | "live";

export function SitesGrid({
  sites,
  activeCount,
  activeLimit,
  limitLabel,
}: {
  sites: Array<{
    id: string;
    name: string;
    title: string;
    primaryUrl: string;
    primaryColor: string;
    modelId: string;
    allowedDomains: string[];
    isActive: boolean;
    livePineconeNs: string | null;
  }>;
  activeCount: number;
  activeLimit: number;
  limitLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SiteStatus>("all");

  const counts = useMemo(() => {
    const live = sites.filter((site) => site.isActive).length;
    const ready = sites.filter(
      (site) =>
        !site.isActive &&
        Boolean(site.primaryUrl.trim()) &&
        site.allowedDomains.length > 0 &&
        Boolean(site.livePineconeNs),
    ).length;
    const needsSetup = sites.filter(
      (site) =>
        !site.isActive &&
        (!site.primaryUrl.trim() || site.allowedDomains.length === 0 || !site.livePineconeNs),
    ).length;
    return {
      all: sites.length,
      live,
      ready,
      "needs-setup": needsSetup,
    };
  }, [sites]);

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sites.filter((site) => {
      const status: SiteStatus = site.isActive
        ? "live"
        : site.primaryUrl.trim() && site.allowedDomains.length > 0 && site.livePineconeNs
          ? "ready"
          : "needs-setup";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return [
        site.name,
        site.title,
        site.primaryUrl,
        hostLabel(site.primaryUrl),
        site.modelId,
        ...site.allowedDomains,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [query, sites, statusFilter]);
  const activeSlotsRemaining = Math.max(0, activeLimit - activeCount);
  const firstNeedsSetup = sites.find(
    (site) =>
      !site.isActive &&
      (!site.primaryUrl.trim() || site.allowedDomains.length === 0 || !site.livePineconeNs),
  );
  const firstReady = sites.find(
    (site) =>
      !site.isActive &&
      site.primaryUrl.trim() &&
      site.allowedDomains.length > 0 &&
      site.livePineconeNs,
  );
  const firstLive = sites.find((site) => site.isActive);
  const listAction = firstNeedsSetup
    ? {
        title: needsSetupLabel(counts["needs-setup"]),
        body: `${firstNeedsSetup.name} is closest to your next setup step. Finish missing fields before it can publish.`,
        href: !firstNeedsSetup.primaryUrl.trim()
          ? `/sites/${firstNeedsSetup.id}?view=setup&tab=branding`
          : firstNeedsSetup.allowedDomains.length === 0
            ? `/sites/${firstNeedsSetup.id}?view=setup&tab=behavior`
            : `/sites/${firstNeedsSetup.id}?view=setup&tab=knowledge`,
        label: !firstNeedsSetup.primaryUrl.trim()
          ? "Set URL"
          : firstNeedsSetup.allowedDomains.length === 0
            ? "Add domains"
            : "Add knowledge",
        tone: "amber" as const,
        icon: AlertCircle,
      }
    : firstReady && activeSlotsRemaining === 0
      ? {
          title: "Ready widgets are waiting",
          body: `${firstReady.name} can publish after you free an active slot or change plan limits.`,
          href: "/subscription",
          label: "View capacity",
          tone: "amber" as const,
          icon: RadioTower,
        }
      : firstReady
        ? {
            title: `${counts.ready} widget${counts.ready === 1 ? "" : "s"} ready to publish`,
            body: `${firstReady.name} has a URL, domains, and knowledge ready. Preview it before going live.`,
            href: `/sites/${firstReady.id}?view=setup&focus=embed#embed`,
            label: "Open install",
            tone: "blue" as const,
            icon: CheckCircle2,
          }
        : firstLive
          ? {
              title: "Live widgets are collecting chats",
              body: `Open ${firstLive.name} to review visitor questions, answers, and citation coverage.`,
              href: `/sites/${firstLive.id}?view=monitor`,
              label: "Open monitor",
              tone: "green" as const,
              icon: RadioTower,
            }
          : {
              title: "Create a widget to start",
              body: "Add a website URL, choose domains, import knowledge, then publish after previewing the install.",
              href: "/sites",
              label: "Create widget",
              tone: "gray" as const,
              icon: MessageCircle,
            };
  const ListActionIcon = listAction.icon;

  const filters: Array<{
    id: SiteStatus;
    label: string;
    count: number;
    icon: typeof SlidersHorizontal;
  }> = [
    { id: "all", label: "All", count: counts.all, icon: SlidersHorizontal },
    {
      id: "needs-setup",
      label: "Needs setup",
      count: counts["needs-setup"],
      icon: DatabaseZap,
    },
    { id: "ready", label: "Ready", count: counts.ready, icon: CheckCircle2 },
    { id: "live", label: "Live", count: counts.live, icon: RadioTower },
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div
        className={cn(
          "rounded-lg border px-4 py-3 shadow-sm",
          listAction.tone === "green"
            ? "border-emerald-200 bg-emerald-50"
            : listAction.tone === "blue"
              ? "border-blue-200 bg-blue-50"
              : listAction.tone === "amber"
                ? "border-amber-200 bg-amber-50"
                : "border-gray-200 bg-white",
        )}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/85",
                listAction.tone === "green"
                  ? "text-emerald-700"
                  : listAction.tone === "blue"
                    ? "text-blue-700"
                    : listAction.tone === "amber"
                      ? "text-amber-700"
                      : "text-gray-700",
              )}
            >
              <ListActionIcon className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  "text-sm font-semibold",
                  listAction.tone === "green"
                    ? "text-emerald-950"
                    : listAction.tone === "blue"
                      ? "text-blue-950"
                      : listAction.tone === "amber"
                        ? "text-amber-950"
                        : "text-gray-950",
                )}
              >
                {listAction.title}
              </p>
              <p
                className={cn(
                  "mt-1 text-sm leading-6",
                  listAction.tone === "green"
                    ? "text-emerald-900/80"
                    : listAction.tone === "blue"
                      ? "text-blue-900/80"
                      : listAction.tone === "amber"
                        ? "text-amber-900/85"
                        : "text-gray-600",
                )}
              >
                {listAction.body}
              </p>
            </div>
          </div>
          <Link
            href={listAction.href}
            className="inline-flex h-10 w-fit shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-semibold text-gray-950 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
          >
            {listAction.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search widgets, domains, or models"
              className="pl-9"
              aria-label="Search widgets"
            />
          </div>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto"
            role="group"
            aria-label="Filter widgets by status"
          >
            {filters.map((filter) => {
              const active = statusFilter === filter.id;
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setStatusFilter(filter.id)}
                  aria-pressed={active}
                  aria-label={`${filter.label}: ${filter.count} ${
                    filter.count === 1 ? "widget" : "widgets"
                  }`}
                  className={cn(
                    "inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors",
                    active
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="whitespace-nowrap">{filter.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                      active ? "bg-white/15 text-white" : "bg-white text-gray-500",
                    )}
                  >
                    {filter.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 font-semibold text-gray-700">
            Showing {filteredSites.length} of {sites.length}
          </span>
          <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-700">
            Active slots: {limitLabel}
          </span>
          {query || statusFilter !== "all" ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setStatusFilter("all");
              }}
              className="font-semibold text-gray-700 hover:text-gray-950"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {filteredSites.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
            <Search className="h-5 w-5" aria-hidden />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">No matching widgets</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try a different search or clear the status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="mt-4 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Clear filters
          </button>
        </div>
      ) : null}

      <div className="grid gap-3">
        {filteredSites.map((site) => {
          const hasWebsite = Boolean(site.primaryUrl.trim());
          const hasDomains = site.allowedDomains.length > 0;
          const hasKnowledge = Boolean(site.livePineconeNs);
          const isReady = hasWebsite && hasDomains && hasKnowledge;
          const missingItems = [
            !hasWebsite ? "website URL" : null,
            !hasDomains ? "allowed domains" : null,
            !hasKnowledge ? "knowledge" : null,
          ].filter((item): item is string => Boolean(item));
          const activationBlockedByLimit =
            !site.isActive && isReady && activeCount >= activeLimit;
          const activationBlockedReason = !hasWebsite
            ? "Set website URL first"
            : !hasDomains
              ? "Set allowed domains first"
              : !hasKnowledge
                ? "Add knowledge first"
            : activationBlockedByLimit
              ? `Limit reached (${limitLabel})`
              : undefined;
          const canActivate =
            site.isActive || (isReady && activeCount < activeLimit);
          const status = site.isActive
            ? {
                label: "Live",
                className: "border-emerald-200 bg-emerald-50 text-emerald-800",
                title: "The widget is active.",
              }
            : isReady
              ? {
                  label: "Ready",
                  className: "border-blue-200 bg-blue-50 text-blue-800",
                  title: "Website URL, allowed domains, and knowledge are ready.",
                }
              : {
                  label:
                    missingItems.length === 1
                      ? `Needs ${missingItems[0]}`
                      : "Needs setup",
                  className: "border-amber-200 bg-amber-50 text-amber-800",
                  title: `Missing ${missingItems.join(", ")}.`,
                };
          const nextAction = site.isActive
              ? "Open monitor"
            : isReady
              ? "Review setup"
            : !hasWebsite
              ? "Set website URL"
            : !hasDomains
              ? "Set allowed domains"
              : "Add knowledge";
          const cardHref = `/sites/${site.id}${
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
          const helperText = site.isActive
            ? "Review live conversations and questions outside coverage."
            : activationBlockedByLimit
              ? `Active-widget limit reached (${limitLabel}). Stop another live widget or upgrade.`
              : isReady
                ? "Knowledge is ready. Review setup, preview, then publish when the widget looks good."
                : `Finish ${missingItems.join(", ")} before this widget can go live.`;

          return (
            <article
              key={site.id}
              className="grid min-w-0 gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md lg:grid-cols-[minmax(16rem,0.85fr)_minmax(0,1.35fr)_12rem] lg:items-start"
            >
              <div className="min-w-0">
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
                    style={{ backgroundColor: site.primaryColor }}
                  >
                    <MessageCircle className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words font-semibold leading-5 text-gray-900">
                      {site.name}
                    </h3>
                    <p className="mt-0.5 break-words text-[11px] leading-4 text-gray-500">
                      {site.title}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}
                    title={status.title}
                  >
                    {status.label}
                  </span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                    {modelLabel(site.modelId)}
                  </span>
                </div>
              </div>

              <div className="min-w-0 space-y-2 text-[11px] text-gray-500">
                <div>
                  <p className="font-semibold uppercase tracking-wide text-gray-400">Website</p>
                  <p className="mt-0.5 break-words font-medium text-gray-700">
                    {hostLabel(site.primaryUrl)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-gray-400">
                    Allowed domains
                  </p>
                  <p className="mt-0.5 break-words font-medium text-gray-700">
                    {domainSummary(site.allowedDomains)}
                  </p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-wide text-gray-400">Knowledge</p>
                  <p className="mt-0.5 font-medium text-gray-700">
                    {hasKnowledge ? "Ready for answers" : "No content imported yet"}
                  </p>
                </div>
                <p
                  className={`rounded-lg px-2.5 py-2 text-xs leading-5 ${
                    activationBlockedByLimit
                      ? "border border-amber-200 bg-amber-50 text-amber-800"
                      : "bg-gray-50 text-gray-600"
                  }`}
                >
                  {helperText}
                </p>
              </div>

              <div className="grid gap-3 border-t border-gray-100 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <SiteActiveSwitch
                  siteId={site.id}
                  siteName={site.name}
                  isActive={site.isActive}
                  canActivate={canActivate}
                  limitLabel={limitLabel}
                  disabledReason={activationBlockedReason}
                />
                <Link
                  href={cardHref}
                  className="inline-flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10"
                >
                  <span>{nextAction}</span>
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
