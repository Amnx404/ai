import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { db } from "~/server/db";

const querySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().optional(),
  clientRequestId: z.string().optional(),
});

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function topLevelLiveNamespace(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const v = (body as Record<string, unknown>).live_namespace;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

export async function POST(req: NextRequest) {
  // Callback is called by the scraper service; no auth.
  const url = new URL(req.url);

  const rawBody = await req.text().catch(() => "");
  let parsedBody: unknown = rawBody;
  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // leave as raw string
  }

  console.log("[scraper-callback] received", {
    method: req.method,
    url: url.toString(),
    query: Object.fromEntries(url.searchParams.entries()),
    headers: Object.fromEntries(req.headers.entries()),
    body: parsedBody,
  });

  const parsedQuery = querySchema.safeParse({
    siteId: url.searchParams.get("siteId"),
    runId: url.searchParams.get("runId") ?? undefined,
    clientRequestId: url.searchParams.get("clientRequestId") ?? undefined,
  });
  if (!parsedQuery.success) {
    return jsonNoStore({ error: parsedQuery.error.flatten() }, 400);
  }

  const runIdFromBody =
    parsedBody && typeof parsedBody === "object" && typeof (parsedBody as { run_id?: unknown }).run_id === "string"
      ? String((parsedBody as { run_id: string }).run_id)
      : null;

  const effectiveRunId = runIdFromBody ?? parsedQuery.data.runId ?? null;
  if (!effectiveRunId) return jsonNoStore({ error: "Missing run_id" }, 400);

  await (db.knowledgeBaseRun.upsert as unknown as (args: unknown) => Promise<unknown>)({
    where: { runId_step: { runId: effectiveRunId, step: "callback" } },
    create: {
      siteId: parsedQuery.data.siteId,
      runId: effectiveRunId,
      step: "callback",
      ok: true,
      startedAt: new Date(),
      finishedAt: new Date(),
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
      message: parsedQuery.data.clientRequestId
        ? `callback_received:${parsedQuery.data.clientRequestId}`
        : "callback_received",
    },
    update: {
      ok: true,
      finishedAt: new Date(),
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
      message: parsedQuery.data.clientRequestId
        ? `callback_received:${parsedQuery.data.clientRequestId}`
        : "callback_received",
    },
  }).catch(() => null);

  const liveNs = topLevelLiveNamespace(parsedBody);
  if (!liveNs) {
    return jsonNoStore({ ok: true });
  }

  await (db.knowledgeBaseRun.upsert as unknown as (args: unknown) => Promise<unknown>)({
    where: { runId_step: { runId: effectiveRunId, step: "pipeline" } },
    create: {
      siteId: parsedQuery.data.siteId,
      runId: effectiveRunId,
      step: "pipeline",
      ok: true,
      pineconeNamespace: liveNs,
      finishedAt: new Date(),
      message: `callback_live_namespace:${liveNs}`,
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
    },
    update: {
      ok: true,
      pineconeNamespace: liveNs,
      finishedAt: new Date(),
      message: `callback_live_namespace:${liveNs}`,
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
    },
  }).catch(() => null);

  await (db.knowledgeBaseRun.upsert as unknown as (args: unknown) => Promise<unknown>)({
    where: { runId_step: { runId: effectiveRunId, step: "status" } },
    create: {
      siteId: parsedQuery.data.siteId,
      runId: effectiveRunId,
      step: "status",
      ok: true,
      pineconeNamespace: liveNs,
      startedAt: new Date(),
      finishedAt: new Date(),
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
      message: "succeeded",
    },
    update: {
      ok: true,
      pineconeNamespace: liveNs,
      finishedAt: new Date(),
      response: (parsedBody as unknown) as Prisma.InputJsonValue,
      message: "succeeded",
    },
  }).catch(() => null);

  await db.site
    .update({
      where: { id: parsedQuery.data.siteId },
      data: { livePineconeNs: liveNs },
    })
    .catch(() => null);

  return jsonNoStore({ ok: true });
}
