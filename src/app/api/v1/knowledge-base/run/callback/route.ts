import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "~/server/db";
import { env } from "~/env.js";
import { scraperRunStatus, type RunStatusResponse } from "~/lib/scraper-pipeline";

const querySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().optional(),
  clientRequestId: z.string().optional(),
});

function pickLiveNamespaceFromRun(status: RunStatusResponse) {
  const upload = status.step_responses?.upload;
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

export async function POST(req: NextRequest) {
  // Callback is called by the scraper service; no auth.
  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return NextResponse.json({ error: "SCRAPER_PIPELINE_BASE_URL not configured" }, { status: 500 });
  }

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    siteId: url.searchParams.get("siteId"),
    runId: url.searchParams.get("runId") ?? undefined,
    clientRequestId: url.searchParams.get("clientRequestId") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = await req.json().catch(() => null);

  const runIdFromBody =
    body && typeof body === "object" && typeof (body as any).run_id === "string"
      ? String((body as any).run_id)
      : null;

  const effectiveRunId = runIdFromBody ?? parsed.data.runId ?? null;
  if (!effectiveRunId) {
    return NextResponse.json({ error: "Missing run_id" }, { status: 400 });
  }

  // Update callback record first (so we can debug even if status fetch fails).
  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: effectiveRunId, step: "callback" } },
    create: {
      siteId: parsed.data.siteId,
      runId: effectiveRunId,
      step: "callback",
      ok: true,
      startedAt: new Date(),
      finishedAt: new Date(),
      response: (body as unknown) as Prisma.InputJsonValue,
      message: parsed.data.clientRequestId ? `callback_received:${parsed.data.clientRequestId}` : "callback_received",
    },
    update: {
      ok: true,
      finishedAt: new Date(),
      response: (body as unknown) as Prisma.InputJsonValue,
      message: parsed.data.clientRequestId ? `callback_received:${parsed.data.clientRequestId}` : "callback_received",
    },
  }).catch(() => null);

  // Fetch canonical final status and update DB + site live namespace.
  const status = await scraperRunStatus(effectiveRunId);

  const done =
    status.pipeline_status === "succeeded" ||
    status.pipeline_status === "failed" ||
    status.pipeline_status === "aborted";

  if (done) {
    await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
      where: { runId_step: { runId: effectiveRunId, step: "pipeline" } },
      create: {
        siteId: parsed.data.siteId,
        runId: effectiveRunId,
        step: "pipeline",
        ok: status.pipeline_status === "succeeded",
        finishedAt: new Date(),
        message: status.pipeline_status ?? null,
        response: (status as unknown) as Prisma.InputJsonValue,
      },
      update: {
        ok: status.pipeline_status === "succeeded",
        finishedAt: new Date(),
        message: status.pipeline_status ?? undefined,
        response: (status as unknown) as Prisma.InputJsonValue,
      },
    }).catch(() => null);
  }

  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: effectiveRunId, step: "status" } },
    create: {
      siteId: parsed.data.siteId,
      runId: effectiveRunId,
      step: "status",
      ok: done ? status.pipeline_status === "succeeded" : false,
      startedAt: new Date(),
      finishedAt: done ? new Date() : null,
      response: (status as unknown) as Prisma.InputJsonValue,
      message: status.pipeline_status ?? null,
    },
    update: {
      ok: done ? status.pipeline_status === "succeeded" : false,
      finishedAt: done ? new Date() : undefined,
      response: (status as unknown) as Prisma.InputJsonValue,
      message: status.pipeline_status ?? undefined,
    },
  }).catch(() => null);

  if (status.pipeline_status === "succeeded") {
    const liveNs = pickLiveNamespaceFromRun(status);
    if (liveNs) {
      const liveVersion = (() => {
        const m = liveNs.match(/live-v-?(\d+)\b/i);
        if (!m) return null;
        const n = Number(m[1]);
        return Number.isFinite(n) ? n : null;
      })();

      await db.site.update({
        where: { id: parsed.data.siteId },
        data: {
          livePineconeNs: liveNs,
          liveVersion: liveVersion ?? undefined,
        },
      }).catch(() => null);
    }
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

