import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { env } from "~/env.js";
import { scraperPrepare } from "~/lib/scraper-pipeline";

const bodySchema = z.object({
  siteId: z.string().min(1),
  runId: z.string().min(1),
  // Optional overrides for debugging
  minChars: z.number().int().min(0).optional(),
  finetuneConcurrency: z.number().int().min(1).max(16).optional(),
  finetuneMaxInputChars: z.number().int().min(1000).optional(),
});

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

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });
  const site = await db.site.findFirst({
    where: { id: parsed.data.siteId, orgId: user?.orgId ?? "", isActive: true },
  });
  if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

  const step = "prepare" as const;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (obj: unknown, event?: string) => {
        const payload = typeof obj === "string" ? obj : JSON.stringify(obj);
        const prefix = event ? `event: ${event}\n` : "";
        controller.enqueue(encoder.encode(`${prefix}data: ${payload}\n\n`));
      };

      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      };

      const promise = (async () => {
        try {
          send({ message: "prepare_started" }, "status");
          const status = await scraperPrepare({
            run_id: parsed.data.runId,
            finetune: true,
            finetune_model: env.SCRAPER_FINETUNE_MODEL ?? null,
            finetune_prompt: env.FINETUNE_PROMPT ?? "",
            openrouter_api_key: env.OPENROUTER_API_KEY,
            min_chars: parsed.data.minChars ?? 80,
            finetune_concurrency: parsed.data.finetuneConcurrency ?? 4,
            finetune_max_input_chars: parsed.data.finetuneMaxInputChars ?? 120000,
          });

          await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
            where: { runId_step: { runId: status.run_id, step } },
            create: {
              siteId: site.id,
              runId: status.run_id,
              ok: status.ok,
              step,
              startedAt: status.started_at ? new Date(status.started_at) : null,
              finishedAt: status.finished_at ? new Date(status.finished_at) : null,
              message: status.message ?? null,
              params: ({ prepare: parsed.data } as unknown) as Prisma.InputJsonValue,
              response: (status as unknown) as Prisma.InputJsonValue,
              outputs: (status.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
              logs: (status.logs ?? undefined) as Prisma.InputJsonValue | undefined,
            },
            update: {
              ok: status.ok,
              step,
              startedAt: status.started_at ? new Date(status.started_at) : undefined,
              finishedAt: status.finished_at ? new Date(status.finished_at) : undefined,
              message: status.message ?? undefined,
              response: (status as unknown) as Prisma.InputJsonValue,
              outputs: (status.outputs ?? undefined) as Prisma.InputJsonValue | undefined,
              logs: (status.logs ?? undefined) as Prisma.InputJsonValue | undefined,
            },
          }).catch(() => null);

          send(status, "final");
        } catch (e: unknown) {
          const message =
            e instanceof Error ? e.message : typeof e === "string" ? e : "Prepare failed";
          const now = new Date();
          await (db.knowledgeBaseRun.upsert as unknown as (args: any) => Promise<unknown>)({
            where: { runId_step: { runId: parsed.data.runId, step } },
            create: {
              siteId: site.id,
              runId: parsed.data.runId,
              ok: false,
              step,
              startedAt: now,
              finishedAt: now,
              message,
              params: ({ prepare: parsed.data } as unknown) as Prisma.InputJsonValue,
              response: ({ error: message } as unknown) as Prisma.InputJsonValue,
            },
            update: {
              ok: false,
              step,
              startedAt: now,
              finishedAt: now,
              message,
              params: ({ prepare: parsed.data } as unknown) as Prisma.InputJsonValue,
              response: ({ error: message } as unknown) as Prisma.InputJsonValue,
            },
          }).catch(() => null);

          send({ error: message }, "error");
        } finally {
          close();
        }
      })();

      // Heartbeat to keep CF / proxies from timing out.
      const interval = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          // ignore
        }
      }, 10_000);

      promise.finally(() => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
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

