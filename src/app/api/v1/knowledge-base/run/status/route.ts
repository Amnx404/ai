import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { scraperRunStatus } from "~/lib/scraper-pipeline";

const querySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().min(1),
  // When true, return cached DB response if available and do not hit scraper.
  cached: z.enum(["1", "true", "yes"]).optional(),
});

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function pickLiveNamespaceFromStatus(status: any) {
  const upload = status?.step_responses?.upload;
  const candidates = [
    upload?.live_namespace,
    upload?.outputs?.live_namespace,
    upload?.outputs?.liveNamespace,
    upload?.outputs?.namespace,
    upload?.outputs?.pinecone_namespace,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return jsonNoStore({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    siteId: url.searchParams.get("siteId"),
    runId: url.searchParams.get("runId"),
    cached: url.searchParams.get("cached") ?? undefined,
  });
  if (!parsed.success) return jsonNoStore({ error: parsed.error.flatten() }, 400);

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId: user?.orgId ?? "" },
  });
  if (!site) return jsonNoStore({ error: "Site not found" }, 404);

  // Prefer returning cached status from Postgres (especially for completed runs).
  const cachedRow = await db.knowledgeBaseRun.findFirst({
    where: { siteId: site.id, runId: parsed.data.runId, step: "status" },
    orderBy: { updatedAt: "desc" },
    select: { response: true, message: true, finishedAt: true },
  });

  const isCachedOnly = Boolean(parsed.data.cached);
  if (cachedRow?.response && (isCachedOnly || cachedRow.finishedAt)) {
    // Return cached scraper response as-is.
    return jsonNoStore(cachedRow.response);
  }

  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return jsonNoStore({ error: "SCRAPER_PIPELINE_BASE_URL not configured" }, 500);
  }

  const status = await scraperRunStatus(parsed.data.runId);

  const done =
    status.pipeline_status === "succeeded" ||
    status.pipeline_status === "failed" ||
    status.pipeline_status === "aborted";

  const liveNs =
    status.pipeline_status === "succeeded" ? pickLiveNamespaceFromStatus(status) : null;

  if (done) {
    await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
      where: { runId_step: { runId: parsed.data.runId, step: "pipeline" } },
      create: {
        siteId: site.id,
        runId: parsed.data.runId,
        step: "pipeline",
        ok: status.pipeline_status === "succeeded",
        pineconeNamespace: liveNs ?? undefined,
        finishedAt: new Date(),
        message: status.pipeline_status ?? null,
        response: (status as unknown) as Prisma.InputJsonValue,
      },
      update: {
        ok: status.pipeline_status === "succeeded",
        pineconeNamespace: liveNs ?? undefined,
        finishedAt: new Date(),
        message: status.pipeline_status ?? undefined,
        response: (status as unknown) as Prisma.InputJsonValue,
      },
    }).catch(() => null);
  }

  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: parsed.data.runId, step: "status" } },
    create: {
      siteId: site.id,
      runId: parsed.data.runId,
      ok: done ? status.pipeline_status === "succeeded" : false,
      step: "status",
      pineconeNamespace: liveNs ?? undefined,
      startedAt: new Date(),
      finishedAt: done ? new Date() : null,
      response: (status as unknown) as Prisma.InputJsonValue,
      message: status.pipeline_status ?? null,
    },
    update: {
      ok: done ? status.pipeline_status === "succeeded" : false,
      pineconeNamespace: liveNs ?? undefined,
      finishedAt: done ? new Date() : undefined,
      response: (status as unknown) as Prisma.InputJsonValue,
      message: status.pipeline_status ?? undefined,
    },
  }).catch(() => null);

  return jsonNoStore(status);
}

