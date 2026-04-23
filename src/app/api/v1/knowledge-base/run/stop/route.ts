import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { scraperStopRun } from "~/lib/scraper-pipeline";

const bodySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().min(1),
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

  const stopped = await scraperStopRun(parsed.data.runId);

  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: parsed.data.runId, step: "pipeline" } },
    create: {
      siteId: site.id,
      runId: parsed.data.runId,
      step: "pipeline",
      ok: false,
      message: "stop_requested",
      response: (stopped as unknown) as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
    update: {
      ok: false,
      message: "stop_requested",
      response: (stopped as unknown) as Prisma.InputJsonValue,
      finishedAt: new Date(),
    },
  }).catch(() => null);

  return jsonNoStore(stopped);
}

