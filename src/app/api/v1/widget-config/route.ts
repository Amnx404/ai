import { NextRequest, NextResponse } from "next/server";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { checkOriginAllowed, getUserFacingAllowedDomains } from "~/lib/allowed-domains";

export async function GET(req: NextRequest) {
  const siteId = req.nextUrl.searchParams.get("siteId");
  const isPreview = req.nextUrl.searchParams.get("preview") === "1";
  if (!siteId) {
    return NextResponse.json({ error: "siteId required" }, { status: 400 });
  }

  const site = await db.site.findFirst({
    where: { id: siteId, ...(isPreview ? {} : { isActive: true }) },
    select: {
      id: true,
      isActive: true,
      primaryColor: true,
      title: true,
      greeting: true,
      primaryUrl: true,
      logoUrl: true,
      allowedDomains: true,
      allowedTopics: true,
      livePineconeNs: true,
    },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const origin = (req.headers.get("origin") ?? "").trim();
  const originGate = checkOriginAllowed(origin, site.allowedDomains, {
    allowOpaqueOrigin: process.env.NODE_ENV === "development" || isPreview,
  });
  if (!isPreview && !originGate.ok) {
    return NextResponse.json(
      { error: originGate.error },
      {
        status: originGate.status,
        headers: { "Access-Control-Allow-Origin": originGate.corsOrigin },
      },
    );
  }

  const { allowedDomains, livePineconeNs, ...publicSite } = site;
  const readiness = {
    hasWebsite: Boolean(site.primaryUrl.trim()),
    hasAllowedDomains: getUserFacingAllowedDomains(allowedDomains, env.NEXTAUTH_URL).length > 0,
    hasKnowledgeBase: Boolean(livePineconeNs),
  };

  return NextResponse.json(
    { ...publicSite, readiness, appUrl: env.NEXTAUTH_URL, preview: isPreview },
    {
      headers: {
        "Access-Control-Allow-Origin": originGate.corsOrigin,
        "Cache-Control": isPreview ? "private, no-store" : "public, max-age=60",
      },
    }
  );
}
