import { NextRequest, NextResponse } from "next/server";

import { env } from "~/env.js";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";
import {
  clampFrequencyForPlan,
  isLinkGroupDue,
  isScheduleEnabledForPlan,
  normalizeLinkGroups,
  type LinkGroupPlan,
} from "~/lib/link-groups";
import { startKnowledgeBaseRun } from "~/lib/knowledge-base-run";
import { db } from "~/server/db";

function isAuthorized(req: NextRequest): boolean {
  const secret = env.KB_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const querySecret = new URL(req.url).searchParams.get("secret")?.trim() ?? "";
  return bearer === secret || querySecret === secret;
}

function jsonNoStore(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

const PLAN_RANK: Record<LinkGroupPlan, number> = {
  FREE: 0,
  PRO: 1,
  MAX: 2,
};

function highestOrgPlan(
  members: Array<{
    plan: "FREE" | "PRO" | "MAX";
  }>,
): LinkGroupPlan {
  let best: LinkGroupPlan = "FREE";
  for (const member of members) {
    if (PLAN_RANK[member.plan] > PLAN_RANK[best]) best = member.plan;
  }
  return best;
}

function isWithinConfiguredHour(now = new Date()): boolean {
  if (typeof env.KB_CRON_UTC_HOUR !== "number") return true;
  return now.getUTCHours() === env.KB_CRON_UTC_HOUR;
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]!);
    }
  });
  await Promise.all(runners);
}

async function handleCron(req: NextRequest) {
  if (!isAuthorized(req)) return jsonNoStore({ error: "Unauthorized" }, 401);
  if (!env.SCRAPER_PIPELINE_BASE_URL) {
    return jsonNoStore({ error: "SCRAPER_PIPELINE_BASE_URL not configured" }, 500);
  }
  if (!isWithinConfiguredHour()) {
    return jsonNoStore({
      ok: true,
      skipped: [],
      started: [],
      errors: [],
      message: "Outside configured cron hour",
      configuredUtcHour: env.KB_CRON_UTC_HOUR ?? null,
    });
  }

  const [sites, orgUsers] = await Promise.all([
    db.site.findMany(),
    db.user.findMany({
      select: {
        orgId: true,
        plan: true,
      },
      where: {
        orgId: { not: null },
      },
    }),
  ]);

  const orgMembersByOrgId = new Map<string, Array<{ plan: "FREE" | "PRO" | "MAX" }>>();
  for (const user of orgUsers) {
    const orgId = user.orgId;
    if (!orgId) continue;
    const prev = orgMembersByOrgId.get(orgId) ?? [];
    prev.push({ plan: user.plan });
    orgMembersByOrgId.set(orgId, prev);
  }

  const started: Array<{ siteId: string; groupId: string; runId: string }> = [];
  const skipped: Array<{ siteId: string; groupId: string; reason: string }> = [];
  const errors: Array<{ siteId: string; groupId: string; error: string }> = [];

  const batchSize = env.KB_CRON_BATCH_SIZE ?? 3;

  await runWithConcurrency(sites, batchSize, async (site) => {
    if (!site.scrapeConfig) return;
    const plan = highestOrgPlan(orgMembersByOrgId.get(site.orgId) ?? []);
    const normalized = normalizeScrapeConfigObject(site.scrapeConfig ?? {});
    const groups = normalizeLinkGroups((normalized as Record<string, unknown>).link_groups);
    if (groups.length === 0) return;

    if (!isScheduleEnabledForPlan(plan)) {
      for (const group of groups) {
        skipped.push({ siteId: site.id, groupId: group.id, reason: "schedule_not_enabled_for_plan" });
      }
      return;
    }

    for (const rawGroup of groups) {
      const group = {
        ...rawGroup,
        frequency: clampFrequencyForPlan(rawGroup.frequency, plan),
      };
      if (group.frequency === "manual") {
        skipped.push({ siteId: site.id, groupId: group.id, reason: "manual_frequency" });
        continue;
      }
      if (!isLinkGroupDue(group)) {
        skipped.push({ siteId: site.id, groupId: group.id, reason: "not_due" });
        continue;
      }

      try {
        const result = await startKnowledgeBaseRun({
          site,
          groupId: group.id,
          skipIfRunning: true,
        });
        if (result.skipped) {
          skipped.push({ siteId: site.id, groupId: group.id, reason: result.reason });
          continue;
        }
        started.push({ siteId: site.id, groupId: group.id, runId: result.runId });
      } catch (e: unknown) {
        errors.push({
          siteId: site.id,
          groupId: group.id,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }
  });

  return jsonNoStore({
    ok: errors.length === 0,
    started,
    skipped,
    errors,
    configuredUtcHour: env.KB_CRON_UTC_HOUR ?? null,
    batchSize,
  });
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}
