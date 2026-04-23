import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

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
    select: { id: true, isActive: true, livePineconeNs: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = ((user as any)?.plan ?? "FREE") as "FREE" | "PRO" | "MAX";
  const limit = plan === "MAX" ? 10 : plan === "PRO" ? 3 : 1;
  const activeCount = await db.site.count({
    where: { orgId, isActive: true },
  });

  const hasKnowledgeBase = Boolean(site.livePineconeNs);
  const canDeploy = site.isActive ? true : hasKnowledgeBase && activeCount < limit;

  return NextResponse.json({
    ok: true,
    siteId: site.id,
    plan,
    limit,
    activeCount,
    hasKnowledgeBase,
    canDeploy,
    reason: canDeploy
      ? null
      : !hasKnowledgeBase
        ? "Scrape your knowledge base before deploying."
      : plan === "FREE"
        ? "Free tier can only have 1 active site."
        : plan === "PRO"
          ? "Pro tier can only have 3 active sites."
          : "Max tier can only have 10 active sites.",
  });
}

