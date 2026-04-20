import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { signWidgetToken } from "~/lib/widget-jwt";
import { getRealIp, rateLimit } from "~/lib/rate-limit";

const bodySchema = z.object({
  siteId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const ip = getRealIp(req);

  if (!rateLimit(`session:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { siteId } = parsed.data;
  const origin = req.headers.get("origin") ?? "";

  const site = await db.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true, allowedDomains: true },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Domain allowlist check
  if (site.allowedDomains.length > 0) {
    const originHost = new URL(origin.startsWith("http") ? origin : `https://${origin}`).hostname;
    const allowed = site.allowedDomains.some((d) => {
      const domain = d.replace(/^https?:\/\//, "").split("/")[0];
      return originHost === domain || originHost.endsWith(`.${domain}`);
    });
    if (!allowed && process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Domain not allowed" }, { status: 403 });
    }
  }

  const session = await db.chatSession.create({
    data: { siteId: site.id, ipHash: ip.replace(/\d+$/, "0") },
  });

  const token = await signWidgetToken({ siteId: site.id, sessionId: session.id });

  await db.analyticsEvent.create({
    data: { siteId: site.id, type: "chat_start" },
  });

  return NextResponse.json(
    { token, sessionId: session.id },
    {
      headers: {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Credentials": "true",
      },
    }
  );
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
