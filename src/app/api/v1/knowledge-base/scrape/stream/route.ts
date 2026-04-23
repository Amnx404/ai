import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";

const bodySchema = z.object({
  siteId: z.string().min(1),
  scrape: z.record(z.unknown()),
});

function baseUrl() {
  const raw = env.SCRAPER_PIPELINE_BASE_URL?.trim();
  if (!raw) throw new Error("SCRAPER_PIPELINE_BASE_URL is not set");
  return raw.replace(/\/+$/, "");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return NextResponse.json(
      { error: "SCRAPER_PIPELINE_BASE_URL not configured" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId: user?.orgId ?? "", isActive: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const scrapePayload = normalizeScrapeConfigObject(parsed.data.scrape) as Record<string, unknown>;

  // Persist scrapeConfig for the site (so it's visible/editable in UI)
  await db.site.update({
    where: { id: site.id },
    data: {
      scrapeConfig: scrapePayload as Prisma.InputJsonValue,
    },
  });

  const upstream = await fetch(`${baseUrl()}/scrape/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scrapePayload),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: `Scraper pipeline error ${upstream.status} ${upstream.statusText}: ${text}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Proxy the stream to the browser. This keeps the connection active and
  // avoids long "silent" requests that can trigger CDN timeouts.
  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

