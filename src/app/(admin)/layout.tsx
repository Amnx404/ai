import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { AdminNav } from "./_components/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AdminNav user={session.user} />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="mx-auto max-w-[88rem] px-4 py-6 sm:px-6 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
