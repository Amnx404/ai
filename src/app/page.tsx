import { getServerSession } from "next-auth";

import { HomePageClient } from "./_components/home-page-client";
import { authOptions } from "~/server/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return <HomePageClient initialAuthenticated={Boolean(session?.user)} />;
}
