import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { CreateSiteButton } from "./_components/create-site-button";

export default async function SitesPage() {
  const session = await getServerSession(authOptions);
  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { orgId: true },
  });

  const sites = user?.orgId
    ? await db.site.findMany({
        where: { orgId: user.orgId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="mt-1 text-sm text-gray-500">
            Each site gets its own embeddable widget and knowledge base.
          </p>
        </div>
        <CreateSiteButton />
      </div>

      {sites.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-10 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Create your first site</h2>
          <p className="mt-2 text-sm text-gray-600">
            You’ll add your website URL, set security domains, scrape your docs, and get an embed
            snippet.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs">
            {["1) Primary URL", "2) Allowed domains", "3) Scrape knowledge base", "4) Embed"].map(
              (s) => (
                <span
                  key={s}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-gray-700"
                >
                  {s}
                </span>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/sites/${site.id}`}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: site.primaryColor }}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold text-gray-900 group-hover:text-indigo-700">
                    {site.name}
                  </h3>
                  <p className="truncate text-xs text-gray-500">{site.title}</p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    site.isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {site.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="space-y-1 text-xs text-gray-500">
                <p>
                  <span className="font-medium">Model:</span>{" "}
                  {site.modelId.split("/").pop()}
                </p>
                <p>
                  <span className="font-medium">Domains:</span>{" "}
                  {site.allowedDomains.length > 0
                    ? site.allowedDomains.slice(0, 2).join(", ") +
                      (site.allowedDomains.length > 2
                        ? ` +${site.allowedDomains.length - 2}`
                        : "")
                    : "Any domain"}
                </p>
              </div>

              <div className="mt-4 text-xs text-indigo-600 font-medium group-hover:text-indigo-800">
                Configure →
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
