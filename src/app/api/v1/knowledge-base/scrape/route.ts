import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { scraperScrape } from "~/lib/scraper-pipeline";
import { env } from "~/env.js";
import { Prisma } from "@prisma/client";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";

const bodySchema = z.object({
  siteId: z.string().min(1),
  scrape: z.record(z.unknown()),
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

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    });

    const site = await db.site.findFirst({
      where: { id: parsed.data.siteId, orgId: user?.orgId ?? "", isActive: true },
    });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const step = "scrape" as const;

    const scrapePayload = normalizeScrapeConfigObject(parsed.data.scrape) as Record<string, unknown>;

    // Persist scrapeConfig for the site (so it's visible/editable in UI)
    await db.site.update({
      where: { id: site.id },
      data: {
        scrapeConfig: scrapePayload as Prisma.InputJsonValue,
      },
    });

    let status: Awaited<ReturnType<typeof scraperScrape>>;
    try {
      status = await scraperScrape(scrapePayload as never);
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : typeof e === "string" ? e : "Scrape failed";
      const now = new Date();
      const failureRunId = `fail-${randomUUID()}`;
      await (db.knowledgeBaseRun.create as unknown as (args: any) => Promise<unknown>)({
          data: {
            siteId: site.id,
            runId: failureRunId,
            ok: false,
            step,
            startedAt: now,
            finishedAt: now,
            message,
            params: ({ scrape: scrapePayload } as unknown) as Prisma.InputJsonValue,
            response: ({ error: message } as unknown) as Prisma.InputJsonValue,
          },
        }).catch(() => null);
      return NextResponse.json(
        { error: message },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

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
          params: ({ scrape: scrapePayload } as unknown) as Prisma.InputJsonValue,
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

    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : typeof e === "string" ? e : "Scrape failed";
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

