import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const user = await db.user.findUnique({
    where: { id: session!.user.id },
    select: { orgId: true },
  });

  const [siteCount, totalSessions, totalMessages] = await Promise.all([
    user?.orgId
      ? db.site.count({ where: { orgId: user.orgId } })
      : 0,
    user?.orgId
      ? db.chatSession.count({ where: { site: { orgId: user.orgId } } })
      : 0,
    user?.orgId
      ? db.message.count({
          where: { session: { site: { orgId: user.orgId } }, role: "user" },
        })
      : 0,
  ]);

  const stats = [
    { label: "Sites", value: siteCount, href: "/sites" },
    { label: "Total Conversations", value: totalSessions, href: null },
    { label: "Messages Sent", value: totalMessages, href: null },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {session?.user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-500">{s.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{s.value}</p>
            {s.href && (
              <Link
                href={s.href}
                className="mt-3 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      {siteCount === 0 && (
        <div className="mt-12 rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-indigo-600">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">
            Create your first site
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add a site to get your embeddable chat widget.
          </p>
          <Link
            href="/sites"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Create site
          </Link>
        </div>
      )}
    </div>
  );
}
