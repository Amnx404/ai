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
        params: ({ prepare: parsed.data } as unknown) as Prisma.InputJsonValue,
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

  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}

