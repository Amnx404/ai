import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";
import { normalizeSourceGroups } from "~/lib/scrape-source-groups";

export type ScrapePlan = "FREE" | "PRO" | "MAX";

export function maxPagesByCoverage(coverage: string, plan: ScrapePlan): number {
  if (coverage === "basic") return 10;
  if (coverage === "wide") return 50;
  return plan === "MAX" ? 1000 : 200;
}

export function workersBySpeed(speed: string): number {
  if (speed === "quick") return 3;
  if (speed === "fastest") return 10;
  return 7;
}

/** Payload written to `Site.scrapeConfig` from knowledge-tab fields. */
export function buildScrapeConfigFromKnowledgeFields(opts: {
  scrapeProvider?: "firecrawl" | "cloudflare";
  scrapeCloudflareRenderMode?: "auto" | "static" | "browser";
  scrapeCloudflareDiscoveryMode?: "crawl" | "static";
  scrapeCloudflarePerSeedLimit?: string;
  scrapeSourceGroupsJson?: string;
  scrapeSeedUrls: string;
  scrapeAllowedPrefixes: string;
  scrapeCoverage: string;
  scrapeSpeed: string;
  scrapeMaxDepth?: string;
  scrapeSkipMap?: boolean;
  scrapeFinetune?: boolean;
  scrapeUrlWhitelistPatterns?: string;
  scrapeUrlBlacklistPatterns?: string;
  plan: ScrapePlan;
}) {
  const {
    scrapeProvider,
    scrapeCloudflareRenderMode,
    scrapeCloudflareDiscoveryMode,
    scrapeCloudflarePerSeedLimit,
    scrapeSourceGroupsJson,
    scrapeSeedUrls,
    scrapeAllowedPrefixes,
    scrapeCoverage,
    scrapeSpeed,
    scrapeMaxDepth,
    scrapeSkipMap,
    scrapeFinetune,
    scrapeUrlWhitelistPatterns,
    scrapeUrlBlacklistPatterns,
    plan,
  } = opts;
  const maxDepth = parseIntegerField(scrapeMaxDepth);
  const cloudflarePerSeedLimit = parseIntegerField(scrapeCloudflarePerSeedLimit);
  const sourceGroups = parseSourceGroups(scrapeSourceGroupsJson);
  return normalizeScrapeConfigObject({
    scrape_provider: scrapeProvider,
    cloudflare_render_mode: scrapeCloudflareRenderMode,
    cloudflare_discovery_mode: scrapeCloudflareDiscoveryMode,
    ...(cloudflarePerSeedLimit === null ? {} : { cloudflare_per_seed_limit: cloudflarePerSeedLimit }),
    ...(sourceGroups.length > 0 ? { source_groups: sourceGroups } : {}),
    seed_urls: scrapeSeedUrls
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    allowed_prefixes: scrapeAllowedPrefixes
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    max_pages: Math.trunc(maxPagesByCoverage(scrapeCoverage, plan)),
    delay: 0.5,
    parallel_workers: Math.trunc(workersBySpeed(scrapeSpeed)),
    ...(maxDepth === null ? {} : { max_depth: maxDepth }),
    skip_map: Boolean(scrapeSkipMap),
    finetune: Boolean(scrapeFinetune),
    url_whitelist_patterns: lines(scrapeUrlWhitelistPatterns),
    url_blacklist_patterns: lines(scrapeUrlBlacklistPatterns),
    respect_allowed_prefixes: true,
  });
}

function parseSourceGroups(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return [];
  try {
    return normalizeSourceGroups(JSON.parse(raw));
  } catch {
    return [];
  }
}

function lines(value: string | undefined) {
  return (value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntegerField(value: string | undefined) {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}
