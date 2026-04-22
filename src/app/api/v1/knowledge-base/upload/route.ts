import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { scraperUpload, scraperRunStatus } from "~/lib/scraper-pipeline";

const bodySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().min(1),
  // Editable on the site; can override in-call too
  livePrefix: z.string().min(1).optional(),
  // Debug overrides
  maxRecords: z.number().int().positive().optional(),
  batchSize: z.number().int().positive().optional(),
  embedBatchSize: z.number().int().positive().optional(),
  embedWorkers: z.number().int().positive().optional(),
});

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
  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return NextResponse.json(
      { error: "SCRAPER_PIPELINE_BASE_URL not configured" },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    });
    const site = await db.site.findFirst({
      where: { id: parsed.data.siteId, orgId: user?.orgId ?? "", isActive: true },
    });
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const siteLivePrefix = (site as unknown as { livePineconePrefix?: string | null })
      .livePineconePrefix;
    const defaultPrefix = siteLivePrefix?.trim() || `${site.id}-live-v-`;
    const livePrefix = parsed.data.livePrefix?.trim() || defaultPrefix;

    // Persist prefix (editable in UI)
    if (!siteLivePrefix || siteLivePrefix.trim() !== livePrefix) {
      await (db.site.update as unknown as (args: any) => Promise<unknown>)({
        where: { id: site.id },
        data: { livePineconePrefix: livePrefix },
      });
    }

    const status = await scraperUpload({
      run_id: parsed.data.runId,
      live_prefix: livePrefix,
      vector_dim: 1024,
      text_source: "fine",
      embed_model: env.PINECONE_EMBED_MODEL ?? "llama-text-embed-v2",
      batch_size: parsed.data.batchSize ?? 200,
      embed_batch_size: parsed.data.embedBatchSize ?? 64,
      embed_workers: parsed.data.embedWorkers ?? 1,
      max_records: parsed.data.maxRecords ?? null,
    });

    // /upload now returns these top-level fields.
    const liveNsFromTopLevel =
      typeof status.live_namespace === "string" && status.live_namespace.trim()
        ? status.live_namespace.trim()
        : null;
    const previousLiveNsFromTopLevel =
      typeof status.previous_live_namespace === "string" &&
      status.previous_live_namespace.trim()
        ? status.previous_live_namespace.trim()
        : null;

    // Best effort: fetch status to get final outputs for live namespace
    let finalOutputs: Record<string, unknown> | undefined = undefined;
    try {
      const finalStatus = await scraperRunStatus(status.run_id);
      if (finalStatus.outputs && typeof finalStatus.outputs === "object") {
        finalOutputs = finalStatus.outputs as Record<string, unknown>;
      }
    } catch {
      // ignore
    }

    const outputs =
      finalOutputs ??
      (status.outputs && typeof status.outputs === "object"
        ? (status.outputs as Record<string, unknown>)
        : undefined);

    const liveNs = liveNsFromTopLevel ?? pickLiveNamespace(outputs);
    const liveVersion = liveNs ? pickLiveVersionFromNamespace(liveNs) : null;

    if (liveNs) {
      await db.site.update({
        where: { id: site.id },
        data: {
          livePineconeNs: liveNs,
          ...(liveVersion ? { liveVersion } : {}),
        },
      });
    }

    await db.knowledgeBaseRun
      .upsert({
        where: { runId: status.run_id },
        create: {
          siteId: site.id,
          runId: status.run_id,
          ok: status.ok,
          step: status.step,
          startedAt: status.started_at ? new Date(status.started_at) : null,
          finishedAt: status.finished_at ? new Date(status.finished_at) : null,
          message: status.message ?? null,
          params: ({ upload: parsed.data } as unknown) as Prisma.InputJsonValue,
          outputs: (status.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
          logs: (status.logs ?? undefined) as Prisma.InputJsonValue | undefined,
        },
        update: {
          ok: status.ok,
          step: status.step,
          startedAt: status.started_at ? new Date(status.started_at) : undefined,
          finishedAt: status.finished_at ? new Date(status.finished_at) : undefined,
          message: status.message ?? undefined,
          outputs: (status.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
          logs: (status.logs ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      })
      .catch(() => null);

    return NextResponse.json(
      {
        ...status,
        livePrefix,
        liveNamespace: liveNs,
        previousLiveNamespace: previousLiveNsFromTopLevel,
        liveVersion,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Upload failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

