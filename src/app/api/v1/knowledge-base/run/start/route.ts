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
import { resolveScrapeConfigSourceGroups } from "~/lib/scrape-source-groups";

const bodySchema = z.object({
  siteId: z.string().min(1),
  // Optional debugging overrides for upload
  livePrefix: z.string().min(1).optional(),
  maxRecords: z.number().int().min(0).optional(),
  sourceGroupMode: z.enum(["all", "core", "live"]).optional(),
  sourceGroupIds: z.array(z.string().min(1)).optional(),
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

  const rawScrapeConfig = normalizeScrapeConfigObject(site.scrapeConfig ?? {});
  if (parsed.data.sourceGroupMode) rawScrapeConfig.source_group_mode = parsed.data.sourceGroupMode;
  if (parsed.data.sourceGroupIds?.length) rawScrapeConfig.source_group_ids = parsed.data.sourceGroupIds;
  const scrapeConfig = resolveScrapeConfigSourceGroups(rawScrapeConfig);
  const stringArray = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
  const objectRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
  const cloudflareCrawlPurposes = stringArray(scrapeConfig.cloudflare_crawl_purposes).filter(
    (value): value is "search" | "ai-input" | "ai-train" =>
      value === "search" || value === "ai-input" || value === "ai-train",
  );
  const cloudflareRenderMode: "auto" | "static" | "browser" | undefined =
    scrapeConfig.cloudflare_render_mode === "auto" ||
    scrapeConfig.cloudflare_render_mode === "static" ||
    scrapeConfig.cloudflare_render_mode === "browser"
      ? scrapeConfig.cloudflare_render_mode
      : undefined;
  const cloudflareDiscoveryMode: "crawl" | "static" | undefined =
    scrapeConfig.cloudflare_discovery_mode === "crawl" || scrapeConfig.cloudflare_discovery_mode === "static"
      ? scrapeConfig.cloudflare_discovery_mode
      : undefined;
  const scrape = {
    scrape_provider:
      scrapeConfig.scrape_provider === "cloudflare" || scrapeConfig.scrape_provider === "firecrawl"
        ? scrapeConfig.scrape_provider
        : env.SCRAPER_SCRAPE_PROVIDER ?? "cloudflare",
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
    max_depth: typeof scrapeConfig.max_depth === "number" ? scrapeConfig.max_depth : 1,
    skip_map: scrapeConfig.skip_map === true,
    url_whitelist_patterns: stringArray(scrapeConfig.url_whitelist_patterns),
    url_blacklist_patterns: stringArray(scrapeConfig.url_blacklist_patterns),
    use_selenium:
      typeof scrapeConfig.use_selenium === "boolean" ? Boolean(scrapeConfig.use_selenium) : true,
    respect_allowed_prefixes: true,
    cloudflare_render:
      typeof scrapeConfig.cloudflare_render === "boolean"
        ? scrapeConfig.cloudflare_render
        : undefined,
    cloudflare_render_mode: cloudflareRenderMode,
    cloudflare_discovery_mode: cloudflareDiscoveryMode,
    cloudflare_job_retries:
      typeof scrapeConfig.cloudflare_job_retries === "number"
        ? scrapeConfig.cloudflare_job_retries
        : undefined,
    cloudflare_per_seed_limit:
      typeof scrapeConfig.cloudflare_per_seed_limit === "number"
        ? scrapeConfig.cloudflare_per_seed_limit
        : undefined,
    cloudflare_stall_timeout_ms:
      typeof scrapeConfig.cloudflare_stall_timeout_ms === "number"
        ? scrapeConfig.cloudflare_stall_timeout_ms
        : undefined,
    cloudflare_discovery_timeout_ms:
      typeof scrapeConfig.cloudflare_discovery_timeout_ms === "number"
        ? scrapeConfig.cloudflare_discovery_timeout_ms
        : undefined,
    cloudflare_discovery_delay_seconds:
      typeof scrapeConfig.cloudflare_discovery_delay_seconds === "number"
        ? scrapeConfig.cloudflare_discovery_delay_seconds
        : undefined,
    cloudflare_markdown_retries:
      typeof scrapeConfig.cloudflare_markdown_retries === "number"
        ? scrapeConfig.cloudflare_markdown_retries
        : undefined,
    cloudflare_markdown_retry_delay_ms:
      typeof scrapeConfig.cloudflare_markdown_retry_delay_ms === "number"
        ? scrapeConfig.cloudflare_markdown_retry_delay_ms
        : undefined,
    cloudflare_crawl_options: objectRecord(scrapeConfig.cloudflare_crawl_options),
    cloudflare_markdown_options: objectRecord(scrapeConfig.cloudflare_markdown_options),
    cloudflare_crawl_purposes:
      cloudflareCrawlPurposes.length > 0
        ? cloudflareCrawlPurposes
        : (["search", "ai-input"] as Array<"search" | "ai-input">),
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
      finetune: scrapeConfig.finetune === true,
      finetune_model: env.SCRAPER_FINETUNE_MODEL ?? null,
      finetune_prompt: env.FINETUNE_PROMPT ?? "",
      min_chars: 80,
      finetune_concurrency: 4,
      finetune_max_input_chars: 120000,
    },
    upload: {
      run_id: clientRequestId,
      site_id: site.id,
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
