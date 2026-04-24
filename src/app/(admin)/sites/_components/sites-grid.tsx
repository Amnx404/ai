"use client";

import Link from "next/link";

import { SiteActiveSwitch } from "./site-active-switch";

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
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {sites.map((site) => (
        <Link
          key={site.id}
          href={`/sites/${site.id}`}
          className="group relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md flex flex-col h-full"
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
              style={{ backgroundColor: site.primaryColor }}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-semibold text-gray-900 group-hover:text-gray-900">
                {site.name}
              </h3>
              <p className="truncate text-[11px] text-gray-500">{site.title}</p>
            </div>
            <div className="flex-shrink-0">
              <SiteActiveSwitch
                siteId={site.id}
                isActive={site.isActive}
                canActivate={site.isActive || (Boolean(site.livePineconeNs) && activeCount < activeLimit)}
                limitLabel={limitLabel}
              />
            </div>
          </div>

          <div className="space-y-1 text-[11px] text-gray-500 flex-1">
            <p>
              <span className="font-medium">Model:</span> {site.modelId.split("/").pop()}
            </p>
            <p className="truncate">
              <span className="font-medium">Domains:</span>{" "}
              {site.allowedDomains.length > 0
                ? site.allowedDomains.slice(0, 2).join(", ") +
                  (site.allowedDomains.length > 2
                    ? ` +${site.allowedDomains.length - 2}`
                    : "")
                : "Any domain"}
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900">Configure →</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                site.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : site.livePineconeNs
                    ? "border-gray-200 bg-gray-50 text-gray-700"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
              title={
                site.isActive
                  ? "This site is deployed."
                  : site.livePineconeNs
                    ? "This site is not deployed."
                    : "Scrape the knowledge base before deploying."
              }
            >
              {site.isActive ? "Deployed" : site.livePineconeNs ? "Inactive" : "Needs scrape"}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}

