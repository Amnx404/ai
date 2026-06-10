import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { signWidgetToken } from "~/lib/widget-jwt";
import { getRealIp, rateLimit } from "~/lib/rate-limit";
import { checkOriginAllowed } from "~/lib/allowed-domains";

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
  const origin = (req.headers.get("origin") ?? "").trim();

  const site = await db.site.findFirst({
    where: { id: siteId, isActive: true },
    select: { id: true, allowedDomains: true },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const originGate = checkOriginAllowed(origin, site.allowedDomains, {
    allowOpaqueOrigin: process.env.NODE_ENV === "development",
  });
  if (!originGate.ok) {
    return NextResponse.json(
      { error: originGate.error },
      {
        status: originGate.status,
        headers: { "Access-Control-Allow-Origin": originGate.corsOrigin },
      },
    );
  }

  const session = await db.chatSession.create({
    data: { siteId: site.id, ipHash: ip.replace(/\d+$/, "0") },
  });

  const token = await signWidgetToken({ siteId: site.id, sessionId: session.id });

  await db.analyticsEvent.create({
    data: { siteId: site.id, type: "chat_start" },
  });

  const allowOrigin = originGate.corsOrigin;
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
  };
  // `*` cannot be combined with `Access-Control-Allow-Credentials: true`
  if (allowOrigin !== "*") {
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  return NextResponse.json(
    { token, sessionId: session.id },
    { headers: corsHeaders },
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
