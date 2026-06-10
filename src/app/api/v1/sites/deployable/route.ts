import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

const QuerySchema = z.object({
  siteId: z.string().min(1),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({ siteId: url.searchParams.get("siteId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true, plan: true } as any,
  });
  const orgId = ((user as any)?.orgId ?? null) as string | null;
  if (!orgId) {
    return NextResponse.json({ error: "No org" }, { status: 403 });
  }

  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId },
    select: {
      id: true,
      primaryUrl: true,
      allowedDomains: true,
      isActive: true,
      livePineconeNs: true,
    },
  });
  if (!site) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = ((user as any)?.plan ?? "FREE") as "FREE" | "PRO" | "MAX";
  const limit = plan === "MAX" ? 10 : plan === "PRO" ? 3 : 1;
  const activeCount = await db.site.count({
    where: { orgId, isActive: true },
  });

  const hasWebsite = Boolean(site.primaryUrl.trim());
  const hasAllowedDomains =
    getUserFacingAllowedDomains(site.allowedDomains, env.NEXTAUTH_URL).length > 0;
  const hasKnowledgeBase = Boolean(site.livePineconeNs);
  const canDeploy = site.isActive
    ? true
    : hasWebsite && hasAllowedDomains && hasKnowledgeBase && activeCount < limit;

  return NextResponse.json({
    ok: true,
    siteId: site.id,
    plan,
    limit,
    activeCount,
    hasWebsite,
    hasAllowedDomains,
    hasKnowledgeBase,
    canDeploy,
    reason: canDeploy
      ? null
      : !hasWebsite
        ? "Set a website URL before publishing."
      : !hasAllowedDomains
        ? "Add at least one allowed domain before publishing."
      : !hasKnowledgeBase
        ? "Add knowledge before publishing."
      : plan === "FREE"
        ? "Free tier can only have 1 active widget."
        : plan === "PRO"
          ? "Pro tier can only have 3 active widgets."
          : "Max tier can only have 10 active widgets.",
  });
}
