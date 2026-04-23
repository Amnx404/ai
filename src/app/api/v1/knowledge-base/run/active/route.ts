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

  // Only ever consider the newest pipeline run. If a newer run exists, older
  // incomplete runs are ignored by design.
  const latestPipeline = await db.knowledgeBaseRun.findFirst({
    where: { siteId: site.id, step: "pipeline" },
    orderBy: { startedAt: "desc" },
    select: { runId: true, finishedAt: true, startedAt: true, message: true },
  });

  if (!latestPipeline) {
    return jsonNoStore({ active: false });
  }

  // Ignore placeholder rows that were replaced by canonical run ids.
  if (typeof latestPipeline.message === "string" && latestPipeline.message.startsWith("replaced_by:")) {
    return jsonNoStore({ active: false });
  }

  // If the newest run is already marked finished, we are not active,
  // even if older runs were left incomplete.
  if (latestPipeline.finishedAt) {
    return jsonNoStore({ active: false, runId: latestPipeline.runId, pipelineStatus: latestPipeline.message ?? "" });
  }

  const latestStatus = await db.knowledgeBaseRun.findFirst({
    where: { siteId: site.id, runId: latestPipeline.runId, step: "status" },
    orderBy: { updatedAt: "desc" },
    select: { message: true, finishedAt: true },
  });

  const pipelineStatus = (latestStatus?.message ?? "") as string;
  const done =
    pipelineStatus === "succeeded" || pipelineStatus === "failed" || pipelineStatus === "aborted";

  if (done) {
    // Safety: ensure the newest pipeline row is closed so it won't be resumed.
    await db.knowledgeBaseRun.update({
      where: { runId_step: { runId: latestPipeline.runId, step: "pipeline" } },
      data: { finishedAt: new Date(), message: pipelineStatus || undefined },
    }).catch(() => null);
    return jsonNoStore({ active: false, runId: latestPipeline.runId, pipelineStatus });
  }

  return jsonNoStore({
    active: true,
    runId: latestPipeline.runId,
    pipelineStatus,
  });
}

