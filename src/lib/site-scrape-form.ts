import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";

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
  scrapeSeedUrls: string;
  scrapeAllowedPrefixes: string;
  scrapeCoverage: string;
  scrapeSpeed: string;
  plan: ScrapePlan;
}) {
  const { scrapeSeedUrls, scrapeAllowedPrefixes, scrapeCoverage, scrapeSpeed, plan } = opts;
  return normalizeScrapeConfigObject({
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
    respect_allowed_prefixes: true,
  });
}
