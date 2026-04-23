import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";

const querySchema = z.object({
  siteId: z.string().min(1),
});

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonNoStore({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ siteId: url.searchParams.get("siteId") });
  if (!parsed.success) return jsonNoStore({ error: parsed.error.flatten() }, 400);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId: user?.orgId ?? "" },
    select: { id: true },
  });
  if (!site) return jsonNoStore({ error: "Site not found" }, 404);

  const latestPipeline = await db.knowledgeBaseRun.findFirst({
    where: { siteId: site.id, step: "pipeline" },
    orderBy: { startedAt: "desc" },
    select: { runId: true, startedAt: true, finishedAt: true, message: true },
  });

  if (!latestPipeline) return jsonNoStore({ ok: true, hasRun: false });

  const latestStatus = await db.knowledgeBaseRun.findFirst({
    where: { siteId: site.id, runId: latestPipeline.runId, step: "status" },
    orderBy: { updatedAt: "desc" },
    select: { message: true, finishedAt: true, response: true, updatedAt: true },
  });

  const pipelineStatus = (latestStatus?.message ?? latestPipeline.message ?? "") as string;
  const done =
    pipelineStatus === "succeeded" || pipelineStatus === "failed" || pipelineStatus === "aborted";

  return jsonNoStore({
    ok: true,
    hasRun: true,
    runId: latestPipeline.runId,
    pipelineStatus,
    done: Boolean(latestPipeline.finishedAt) || done,
    cachedStatus: latestStatus?.response ?? null,
    updatedAt: latestStatus?.updatedAt ?? null,
  });
}

