import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { CreateSiteButton } from "./_components/create-site-button";
import { SitesGrid } from "./_components/sites-grid";

export default async function SitesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    // Prisma types may be temporarily stale in dev until `prisma generate`.
    select: { orgId: true, plan: true } as any,
  });

  const plan = (user as any)?.plan ?? "FREE";
  const activeLimit = plan === "MAX" ? 10 : plan === "PRO" ? 3 : 1;

  const orgId = ((user as any)?.orgId ?? null) as string | null;

  const sites = orgId
    ? await db.site.findMany({
        where: { orgId },
        select: {
          id: true,
          name: true,
          title: true,
          primaryUrl: true,
          primaryColor: true,
          modelId: true,
          allowedDomains: true,
          isActive: true,
          livePineconeNs: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const activeCount = sites.filter((s) => s.isActive).length;
  const limitLabel =
    plan === "MAX"
      ? `${activeCount}/10 active`
      : plan === "PRO"
        ? `${activeCount}/3 active`
        : `${activeCount}/1 active`;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Widgets</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each widget has its own website, knowledge sources, and install state.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold text-gray-900">
              Plan: {plan}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-semibold text-gray-700">
              {limitLabel}
            </span>
          </div>
        </div>
        <CreateSiteButton />
      </div>

      {sites.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Create your first widget</CardTitle>
            <CardDescription>
              Add your website URL, choose approved domains, add knowledge, and ship the widget.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 text-xs">
              {["1. Website URL", "2. Domains", "3. Knowledge", "4. Install"].map(
                (s) => (
                  <span
                    key={s}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-medium text-gray-700"
                  >
                    {s}
                  </span>
                ),
              )}
            </div>
            <div className="mt-6">
              <CreateSiteButton />
            </div>
          </CardContent>
        </Card>
      ) : (
        <SitesGrid
          sites={sites.map((site) => ({
            ...site,
            allowedDomains: getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL),
          }))}
          activeCount={activeCount}
          activeLimit={activeLimit}
          limitLabel={limitLabel}
        />
      )}
    </div>
  );
}
