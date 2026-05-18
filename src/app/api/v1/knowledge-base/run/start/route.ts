import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { startKnowledgeBaseRun } from "~/lib/knowledge-base-run";

const bodySchema = z.object({
  siteId: z.string().min(1),
  // Optional debugging overrides for upload
  livePrefix: z.string().min(1).optional(),
  maxRecords: z.number().int().min(0).optional(),
  groupId: z.string().min(1).optional(),
});

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonNoStore({ error: "Unauthorized" }, 401);
  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return jsonNoStore({ error: "SCRAPER_PIPELINE_BASE_URL not configured" }, 500);
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return jsonNoStore({ error: parsed.error.flatten() }, 400);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId: user?.orgId ?? "" },
  });
  if (!site) return jsonNoStore({ error: "Site not found" }, 404);

  try {
    const started = await startKnowledgeBaseRun({
      site,
      livePrefix: parsed.data.livePrefix,
      maxRecords: parsed.data.maxRecords,
      groupId: parsed.data.groupId,
    });
    if (started.skipped) {
      return jsonNoStore({ ok: false, error: "Run already in progress" }, 409);
    }
    return jsonNoStore(started.enqueue);
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Failed to start run";
    return jsonNoStore({ ok: false, error: message }, 502);
  }
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

