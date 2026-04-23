import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { env } from "~/env.js";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { SiteConfigForm } from "./_components/site-config-form";
import { EmbedSnippet } from "./_components/embed-snippet";
import { SiteMonitorView } from "./_components/site-monitor-view";
import { SiteActiveToggle } from "./_components/site-active-toggle";

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
  const view = viewRaw === "monitor" ? "monitor" : "setup";
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab =
    tabRaw === "branding" || tabRaw === "behavior" || tabRaw === "knowledge"
      ? tabRaw
      : undefined;
  const session = await getServerSession(authOptions);
  const user = await db.user.findUnique({
    where: { id: session!.user.id },
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

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
            style={{ backgroundColor: site.primaryColor }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{site.name}</h1>
            <p className="text-sm text-gray-500">Site ID: {site.id}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              <span>Primary URL:</span>
              {site.primaryUrl ? (
                <a
                  href={site.primaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-gray-700 underline underline-offset-2"
                >
                  {site.primaryUrl}
                </a>
              ) : (
                <span className="text-gray-400">(not set)</span>
              )}
            </div>
          </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                  site.isActive
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
                title={site.isActive ? "This site is live" : "This site is not live"}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    site.isActive ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                {site.isActive ? "Live" : "Not live"}
              </span>
              <SiteActiveToggle siteId={site.id} isActive={site.isActive} />
            </div>
            <a
              href={`/widget-demo?siteId=${site.id}&url=${encodeURIComponent(primaryOrigin || "https://example.com/")}`}
              className="inline-flex w-full min-w-[10rem] items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
            >
              Preview widget
            </a>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
          <a
            href={`/sites/${site.id}?view=setup${initialTab ? `&tab=${initialTab}` : ""}`}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              view === "setup"
                ? "bg-indigo-600 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Setup
          </a>
          <a
            href={`/sites/${site.id}?view=monitor`}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
              view === "monitor"
                ? "bg-indigo-600 text-white"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            Monitor
          </a>
        </div>
      </div>

      {view === "setup" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-3">
              <SiteConfigForm
                site={site}
                defaultPineconeIndex={env.PINECONE_INDEX}
                defaultPineconeIndexHost={env.PINECONE_INDEX_HOST ?? ""}
                initialTab={initialTab}
              />
            </div>
          </div>
        </>
      ) : (
        <SiteMonitorView
          siteId={site.id}
          livePineconeNs={site.livePineconeNs}
          totalSessions={totalSessions}
          totalMessages={totalMessages}
          outOfScope={outOfScope}
        />
      )}

      <div className="mt-6" id="embed">
        <EmbedSnippet siteId={site.id} />
      </div>
    </div>
  );
}
