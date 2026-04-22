import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "~/server/db";
import { env } from "~/env.js";
import {
  scraperPrepare,
  scraperScrape,
  scraperUpload,
  waitForRunFinished,
  type ApiStatus,
} from "~/lib/scraper-pipeline";
import { resolvePineconeTarget } from "~/lib/pinecone";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";

const bodySchema = z.object({
  siteId: z.string().min(1),
  scrape: z.record(z.unknown()).optional(),
});

function jsonOk(data: unknown) {
  return NextResponse.json(data, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });
}

function pickLiveNamespace(outputs: Record<string, unknown> | undefined) {
  if (!outputs) return null;
  const candidates = [
    outputs.live_namespace,
    outputs.liveNamespace,
    outputs.namespace,
    outputs.pinecone_namespace,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function pickLiveVersionFromNamespace(ns: string) {
  // Example: site-<id>-live-v-12  OR site-<id>-live-v12
  const m = ns.match(/live-v-?(\d+)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { siteId, scrape } = parsed.data;

  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return NextResponse.json(
      { error: "SCRAPER_PIPELINE_BASE_URL not configured" },
      { status: 500 },
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: siteId, orgId: user?.orgId ?? "", isActive: true },
  });
  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  // Default scrape config derived from the site's primary URL.
  const primaryUrl = site.primaryUrl?.trim();
  let allowedPrefixFromPrimary = "";
  try {
    if (primaryUrl) {
      const u = new URL(primaryUrl);
      allowedPrefixFromPrimary = `${u.origin}/`;
    }
  } catch {
    // ignore
  }

  const persistedConfig =
    (site.scrapeConfig && typeof site.scrapeConfig === "object"
      ? (site.scrapeConfig as Record<string, unknown>)
      : null) ?? {};

  const seed_urls =
    (Array.isArray((scrape ?? {}).seed_urls)
      ? ((scrape ?? {}).seed_urls as unknown[])
      : Array.isArray(persistedConfig.seed_urls)
        ? (persistedConfig.seed_urls as unknown[])
        : primaryUrl
          ? [primaryUrl]
          : []) //
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  const allowed_prefixes =
    (Array.isArray((scrape ?? {}).allowed_prefixes)
      ? ((scrape ?? {}).allowed_prefixes as unknown[])
      : Array.isArray(persistedConfig.allowed_prefixes)
        ? (persistedConfig.allowed_prefixes as unknown[])
        : allowedPrefixFromPrimary
          ? [allowedPrefixFromPrimary]
          : []) //
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);

  if (seed_urls.length === 0 || allowed_prefixes.length === 0) {
    return NextResponse.json(
      {
        error:
          "Missing scrape configuration. Provide seed_urls and allowed_prefixes or set Site.primaryUrl/scrapeConfig.",
      },
      { status: 400 },
    );
  }

  // 1) Scrape
  const scrapeReq = {
    seed_urls,
    allowed_prefixes,
    ...(persistedConfig ?? {}),
    ...(scrape ?? {}),
  } as Record<string, unknown>;

  const scraped = await scraperScrape(scrapeReq as never);

  // Upsert run record (best effort)
  await (db.knowledgeBaseRun.create as unknown as (args: any) => Promise<unknown>)({
      data: {
        siteId,
        runId: scraped.run_id,
        ok: scraped.ok,
        step: scraped.step,
        startedAt: scraped.started_at ? new Date(scraped.started_at) : null,
        finishedAt: scraped.finished_at ? new Date(scraped.finished_at) : null,
        message: scraped.message ?? null,
        params: ({ scrape: scrapeReq } as unknown) as Prisma.InputJsonValue,
        response: (scraped as unknown) as Prisma.InputJsonValue,
        outputs: (scraped.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
        logs: (scraped.logs ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    }).catch(() => null);

  // 2) Prepare (finetune on)
  const prepared = await scraperPrepare({
    run_id: scraped.run_id,
    finetune: true,
    openrouter_api_key: env.OPENROUTER_API_KEY,
    finetune_model: env.SCRAPER_FINETUNE_MODEL ?? null,
    finetune_prompt: env.FINETUNE_PROMPT ?? "",
  });
  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: scraped.run_id, step: "prepare" } },
    create: {
      siteId,
      runId: scraped.run_id,
      ok: prepared.ok,
      step: "prepare",
      startedAt: prepared.started_at ? new Date(prepared.started_at) : null,
      finishedAt: prepared.finished_at ? new Date(prepared.finished_at) : null,
      message: prepared.message ?? null,
      params: ({ prepare: { runId: scraped.run_id } } as unknown) as Prisma.InputJsonValue,
      response: (prepared as unknown) as Prisma.InputJsonValue,
      outputs: (prepared.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
      logs: (prepared.logs ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      ok: prepared.ok,
      step: "prepare",
      startedAt: prepared.started_at ? new Date(prepared.started_at) : undefined,
      finishedAt: prepared.finished_at ? new Date(prepared.finished_at) : undefined,
      message: prepared.message ?? undefined,
      response: (prepared as unknown) as Prisma.InputJsonValue,
      outputs: (prepared.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
      logs: (prepared.logs ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  }).catch(() => null);

  // 3) Upload (use fine-tuned text output)
  const livePrefix =
    (
      site as unknown as {
        livePineconePrefix?: string | null;
      }
    ).livePineconePrefix?.trim() || `${siteId}-live-v-`;
  const uploaded = await scraperUpload({
    run_id: scraped.run_id,
    live_prefix: livePrefix,
    text_source: "fine",
    embed_model: env.PINECONE_EMBED_MODEL ?? "llama-text-embed-v2",
    vector_dim: 1024,
  });
  await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
    where: { runId_step: { runId: scraped.run_id, step: "upload" } },
    create: {
      siteId,
      runId: scraped.run_id,
      ok: uploaded.ok,
      step: "upload",
      startedAt: uploaded.started_at ? new Date(uploaded.started_at) : null,
      finishedAt: uploaded.finished_at ? new Date(uploaded.finished_at) : null,
      message: uploaded.message ?? null,
      params: ({ upload: { runId: scraped.run_id, livePrefix } } as unknown) as Prisma.InputJsonValue,
      response: (uploaded as unknown) as Prisma.InputJsonValue,
      outputs: (uploaded.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
      logs: (uploaded.logs ?? undefined) as Prisma.InputJsonValue | undefined,
    },
    update: {
      ok: uploaded.ok,
      step: "upload",
      startedAt: uploaded.started_at ? new Date(uploaded.started_at) : undefined,
      finishedAt: uploaded.finished_at ? new Date(uploaded.finished_at) : undefined,
      message: uploaded.message ?? undefined,
      response: (uploaded as unknown) as Prisma.InputJsonValue,
      outputs: (uploaded.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
      logs: (uploaded.logs ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  }).catch(() => null);

  // 4) Wait until finished and then update site's live namespace pointer
  let finalStatus: ApiStatus | null = null;
  try {
    finalStatus = await waitForRunFinished(scraped.run_id, { timeoutMs: 15 * 60 * 1000 });
  } catch {
    // ok: return whatever we have; run can keep processing
  }

  const outputs =
    (finalStatus?.outputs && typeof finalStatus.outputs === "object"
      ? (finalStatus.outputs as Record<string, unknown>)
      : null) ??
    (uploaded.outputs && typeof uploaded.outputs === "object"
      ? (uploaded.outputs as Record<string, unknown>)
      : null) ??
    undefined;

  const liveNs =
    (typeof uploaded.live_namespace === "string" && uploaded.live_namespace.trim()
      ? uploaded.live_namespace.trim()
      : null) ?? pickLiveNamespace(outputs ?? undefined);
  const liveVersion = liveNs ? pickLiveVersionFromNamespace(liveNs) : null;

  if (liveNs) {
    await db.site.update({
      where: { id: siteId },
      data: {
        livePineconeNs: liveNs,
        ...(liveVersion ? { liveVersion } : {}),
      },
    });
  }

  const refreshedSite = await db.site.findUnique({ where: { id: siteId } });
  const effectiveTarget = refreshedSite
    ? resolvePineconeTarget(
        refreshedSite,
        env.PINECONE_INDEX,
        env.PINECONE_INDEX_HOST,
      )
    : resolvePineconeTarget(site, env.PINECONE_INDEX, env.PINECONE_INDEX_HOST);

  return jsonOk({
    ok: true,
    runId: scraped.run_id,
    final: finalStatus ?? uploaded,
    liveNamespace: liveNs,
    liveVersion,
    effectivePineconeTarget: effectiveTarget,
  });
}

