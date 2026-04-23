import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { AdminNav } from "./_components/admin-nav";
import { AdminSessionProvider } from "./_components/admin-session-provider";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <AdminSessionProvider session={session}>
      <div className="flex min-h-screen">
        <AdminNav user={session.user} />
        <main className="flex-1 overflow-auto bg-gradient-to-b from-gray-50 to-white">
          <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
        </main>
      </div>
    </AdminSessionProvider>
  );
}
