import { randomUUID } from "crypto";
import { type Prisma, type Site } from "@prisma/client";

import { env } from "~/env.js";
import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";
import { normalizeLinkGroups } from "~/lib/link-groups";
import { type PipelineRunRequest, scraperEnqueueRun, scraperStopRun } from "~/lib/scraper-pipeline";
import { db } from "~/server/db";

function jsonClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function escapeRegex(source: string): string {
  return source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function domainToRegexPattern(domainRaw: string): string | null {
  const domain = domainRaw.trim().toLowerCase();
  if (!domain) return null;
  // Reuse existing allowed-domain normalization semantics:
  // remove scheme and any path/query fragments.
  const withoutScheme = domain.replace(/^https?:\/\//, "");
  const hostOnly = withoutScheme.split("/")[0]?.trim().toLowerCase() ?? "";
  const normalized = hostOnly.replace(/^\*\./, "");
  if (!normalized) return null;
  // Allow exact domain or any subdomain.
  return `^https?://(?:[^/]*\\.)?${escapeRegex(normalized)}(?::\\d+)?(?:/|$)`;
}

function wildcardPostfixToRegexPattern(baseUrlRaw: string, postfixRaw: string): string | null {
  const postfix = postfixRaw.trim();
  if (!postfix) return null;
  try {
    const base = new URL(baseUrlRaw);
    const basePrefix = `${base.origin}${base.pathname.replace(/\/+$/, "")}`;
    const normalizedPostfix = postfix.startsWith("/") ? postfix : `/${postfix}`;
    const escaped = escapeRegex(normalizedPostfix).replace(/\\\*/g, ".*");
    return `^${escapeRegex(basePrefix)}${escaped}(?:$|[?#])`;
  } catch {
    return null;
  }
}

function buildScrapePayloadForGroup(site: Site, groupId?: string) {
  const scrapeConfig = normalizeScrapeConfigObject(site.scrapeConfig ?? {});
  const groups = normalizeLinkGroups((scrapeConfig as Record<string, unknown>).link_groups);
  const selected = groupId ? groups.find((g) => g.id === groupId) ?? null : groups[0] ?? null;
  const validGroupCount = Math.max(
    1,
    groups.filter((group) => group.links.some((link) => link.url.trim().length > 0)).length,
  );

  const seedUrls = selected
    ? selected.links.map((link) => link.url)
    : Array.isArray(scrapeConfig.seed_urls)
      ? (scrapeConfig.seed_urls as unknown[]).filter((v): v is string => typeof v === "string")
      : site.primaryUrl
        ? [site.primaryUrl]
        : [];

  const depth = selected
    ? Math.max(...selected.links.map((link) => Math.max(0, Math.trunc(link.depth))), 1)
    : typeof scrapeConfig.max_depth === "number"
      ? Math.max(0, Math.trunc(scrapeConfig.max_depth))
      : 1;

  const groupAllowedDomains = selected?.allowedDomains ?? [];
  const domainPatterns = groupAllowedDomains
    .map(domainToRegexPattern)
    .filter((v): v is string => typeof v === "string");
  const linkWildcardPatterns = selected
    ? selected.links
        .flatMap((link) =>
          link.pageWildcardPostfixes.map((postfix) =>
            wildcardPostfixToRegexPattern(link.url, postfix),
          ),
        )
        .filter((v): v is string => typeof v === "string")
    : [];
  const hasDomainFilter = domainPatterns.length > 0;
  const whitelistPatterns = hasDomainFilter
    ? Array.from(new Set([...domainPatterns, ...linkWildcardPatterns]))
    : [];
  const configuredMaxPages =
    typeof scrapeConfig.max_pages === "number" ? Math.max(1, Math.trunc(scrapeConfig.max_pages)) : 10;
  // Coverage tiers represent the total budget for the site; split across groups
  // so adding groups doesn't multiply total crawl volume.
  const perGroupMaxPages = Math.max(1, Math.floor(configuredMaxPages / validGroupCount));

  return {
    selectedGroupId: selected?.id ?? null,
    scrapePayload: {
      seed_urls: seedUrls,
      // Domain constraints are enforced through whitelist patterns; keep prefixes empty
      // so domain filtering can span multiple allowed hosts.
      allowed_prefixes: [],
      max_pages: perGroupMaxPages,
      delay: typeof scrapeConfig.delay === "number" ? scrapeConfig.delay : 0.5,
      parallel_workers: typeof scrapeConfig.parallel_workers === "number" ? scrapeConfig.parallel_workers : 4,
      use_selenium:
        typeof scrapeConfig.use_selenium === "boolean" ? Boolean(scrapeConfig.use_selenium) : true,
      // If no domain list is configured, crawl is depth-driven only.
      respect_allowed_prefixes: false,
      max_depth: depth,
      url_whitelist_patterns: whitelistPatterns.length > 0 ? whitelistPatterns : undefined,
    },
    normalizedConfig: scrapeConfig as Record<string, unknown>,
  };
}

export async function startKnowledgeBaseRun(opts: {
  site: Site;
  maxRecords?: number;
  livePrefix?: string;
  groupId?: string;
  skipIfRunning?: boolean;
}) {
  const { site, maxRecords, livePrefix, groupId, skipIfRunning = false } = opts;

  const previousRuns = await db.knowledgeBaseRun.findMany({
    where: { siteId: site.id, step: "pipeline", finishedAt: null },
    orderBy: { startedAt: "desc" },
    select: { runId: true },
    take: 10,
  });

  if (skipIfRunning && previousRuns.length > 0) {
    return { skipped: true as const, reason: "run_in_progress" as const };
  }

  for (const r of previousRuns) {
    const statusRow = await db.knowledgeBaseRun.findFirst({
      where: { siteId: site.id, runId: r.runId, step: "status" },
      orderBy: { updatedAt: "desc" },
      select: { message: true },
    });
    const st = (statusRow?.message ?? "").toLowerCase();
    if (st === "succeeded" || st === "failed") continue;

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

  const clientRequestId = `kb-${randomUUID()}`;
  const selectedLivePrefix =
    livePrefix ??
    ((site as unknown as { livePineconePrefix?: string | null }).livePineconePrefix ??
      `${site.id}-live-v-`);

  const { scrapePayload, selectedGroupId, normalizedConfig } = buildScrapePayloadForGroup(site, groupId);

  const callbackBase = env.callback_URL ?? env.NEXTAUTH_URL;
  const callbackUrl = new URL("/api/v1/knowledge-base/run/callback", callbackBase);
  callbackUrl.searchParams.set("siteId", site.id);
  callbackUrl.searchParams.set("clientRequestId", clientRequestId);

  const runReq: PipelineRunRequest = {
    scrape: scrapePayload,
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
      live_prefix: selectedLivePrefix,
      text_source: "fine",
      vector_dim: 1024,
      embed_model: "llama-text-embed-v2",
      batch_size: 200,
      embed_batch_size: 64,
      embed_workers: 1,
      pool_threads: 30,
      max_records: maxRecords ?? null,
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
      params: jsonClone({
        scrape: scrapePayload,
        groupId: selectedGroupId,
      }) as Prisma.InputJsonValue,
      message: enqueue.message ?? "enqueued",
    },
    update: {
      ok: enqueue.ok,
      response: (enqueue as unknown) as Prisma.InputJsonValue,
      params: jsonClone({
        scrape: scrapePayload,
        groupId: selectedGroupId,
      }) as Prisma.InputJsonValue,
      message: enqueue.message ?? "enqueued",
    },
  }).catch(() => null);

  if (selectedGroupId) {
    const groups = normalizeLinkGroups(normalizedConfig.link_groups);
    const updated = groups.map((g) =>
      g.id === selectedGroupId ? { ...g, lastRunAt: new Date().toISOString() } : g,
    );
    await db.site.update({
      where: { id: site.id },
      data: {
        scrapeConfig: {
          ...normalizedConfig,
          link_groups: updated,
        } as Prisma.InputJsonValue,
      },
    });
  }

  return {
    skipped: false as const,
    enqueue,
    runId: canonicalRunId,
    selectedGroupId,
  };
}
