import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { SiteConfigForm } from "./_components/site-config-form";
import { EmbedSnippet } from "./_components/embed-snippet";
import { SiteAnalytics } from "./_components/site-analytics";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
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

  return (
    <div>
      <div className="mb-8">
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
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats */}
        <SiteAnalytics
          totalSessions={totalSessions}
          totalMessages={totalMessages}
          outOfScope={outOfScope}
        />

        {/* Config form */}
        <div className="lg:col-span-2">
          <SiteConfigForm site={site} />
        </div>
      </div>

      {/* Embed snippet */}
      <div className="mt-6">
        <EmbedSnippet siteId={site.id} />
      </div>
    </div>
  );
}
