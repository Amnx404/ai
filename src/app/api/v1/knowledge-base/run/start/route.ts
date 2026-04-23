import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import {
  scraperEnqueueRun,
  scraperStopRun,
  type PipelineRunRequest,
} from "~/lib/scraper-pipeline";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";

const bodySchema = z.object({
  siteId: z.string().min(1),
  // Optional debugging overrides for upload
  livePrefix: z.string().min(1).optional(),
  maxRecords: z.number().int().min(0).optional(),
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

  // Best-effort: stop previous unfinished runs for this site (but never touch
  // runs that are already succeeded/failed).
  const previousRuns = await db.knowledgeBaseRun.findMany({
    where: { siteId: site.id, step: "pipeline", finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: { runId: true },
    take: 10,
  });

  for (const r of previousRuns) {
    const statusRow = await db.knowledgeBaseRun.findFirst({
      where: { siteId: site.id, runId: r.runId, step: "status" },
      orderBy: { updatedAt: "desc" },
      select: { message: true },
    });
    const st = (statusRow?.message ?? "").toLowerCase();
    if (st === "succeeded" || st === "failed") continue;

    // Try to stop the run on the scraper side (ignore failures).
    try {
      await scraperStopRun(r.runId);
    } catch {
      // ignore
    }

    await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
      where: { runId_step: { runId: r.runId, step: "pipeline" } },
      create: {
        siteId: site.id,
        runId: r.runId,
        step: "pipeline",
        ok: false,
        finishedAt: new Date(),
        message: "aborted",
      },
      update: {
        ok: false,
        finishedAt: new Date(),
        message: "aborted",
      },
    }).catch(() => null);
  }

  // NOTE: The scraper service returns the canonical run_id from POST /runs.
  // We send a client request id only as a best-effort correlation token.
  const clientRequestId = `kb-${randomUUID()}`;
  const livePrefix =
    parsed.data.livePrefix ??
    ((site as unknown as { livePineconePrefix?: string | null }).livePineconePrefix ??
      `${site.id}-live-v-`);

  const scrapeConfig = normalizeScrapeConfigObject(site.scrapeConfig ?? {});
  const scrape = {
    seed_urls: Array.isArray(scrapeConfig.seed_urls)
      ? (scrapeConfig.seed_urls as unknown[]).filter((v): v is string => typeof v === "string")
      : site.primaryUrl
        ? [site.primaryUrl]
        : [],
    allowed_prefixes: Array.isArray(scrapeConfig.allowed_prefixes)
      ? (scrapeConfig.allowed_prefixes as unknown[]).filter((v): v is string => typeof v === "string")
      : [],
    max_pages: typeof scrapeConfig.max_pages === "number" ? scrapeConfig.max_pages : 10,
    delay: typeof scrapeConfig.delay === "number" ? scrapeConfig.delay : 0.5,
    parallel_workers: typeof scrapeConfig.parallel_workers === "number" ? scrapeConfig.parallel_workers : 4,
    use_selenium:
      typeof scrapeConfig.use_selenium === "boolean" ? Boolean(scrapeConfig.use_selenium) : true,
    respect_allowed_prefixes: true,
  };

  const callbackBase = env.callback_URL ?? env.NEXTAUTH_URL;
  const callbackUrl = new URL("/api/v1/knowledge-base/run/callback", callbackBase);
  callbackUrl.searchParams.set("siteId", site.id);
  // runId is intentionally NOT required here; callback handler can derive it from body/status.
  callbackUrl.searchParams.set("clientRequestId", clientRequestId);

  const runReq: PipelineRunRequest = {
    scrape,
    prepare: {
      run_id: clientRequestId,
      finetune: true,
      finetune_model: env.SCRAPER_FINETUNE_MODEL ?? null,
      finetune_prompt: env.FINETUNE_PROMPT ?? "",
      min_chars: 80,
      finetune_concurrency: 4,
      finetune_max_input_chars: 120000,
    },
    upload: {
      run_id: clientRequestId,
      live_prefix: livePrefix,
      text_source: "fine",
      vector_dim: 1024,
      embed_model: "llama-text-embed-v2",
      batch_size: 200,
      embed_batch_size: 64,
      embed_workers: 1,
      pool_threads: 30,
      max_records: parsed.data.maxRecords ?? null,
      delete_previous_live: false,
      include_sidecar_metadata: true,
    },
    callback_url: callbackUrl.toString(),
  };

  const enqueue = await scraperEnqueueRun(runReq);

  const canonicalRunId = enqueue.run_id?.trim() || clientRequestId;

  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: canonicalRunId, step: "pipeline" } },
    create: {
      siteId: site.id,
      runId: canonicalRunId,
      step: "pipeline",
      ok: enqueue.ok,
      startedAt: new Date(),
      response: (enqueue as unknown) as Prisma.InputJsonValue,
      message: enqueue.message ?? "enqueued",
    },
    update: {
      ok: enqueue.ok,
      response: (enqueue as unknown) as Prisma.InputJsonValue,
      message: enqueue.message ?? "enqueued",
    },
  }).catch(() => null);

  return jsonNoStore(enqueue);
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

