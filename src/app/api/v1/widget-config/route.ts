import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { env } from "~/env.js";

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const site = await db.site.findFirst({
    where: { id: siteId, isActive: true },
    select: {
      id: true,
      primaryColor: true,
      title: true,
      greeting: true,
      primaryUrl: true,
      logoUrl: true,
      allowedTopics: true,
    },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  return NextResponse.json(
    { ...site, appUrl: env.NEXTAUTH_URL },
    {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=60",
    },
    }
  );
}
