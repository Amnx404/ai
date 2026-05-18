import { normalizeScrapeConfigObject } from "~/lib/scrape-config-normalize";
import { clampFrequencyForPlan, type LinkGroupFrequency } from "~/lib/link-groups";

export type ScrapePlan = "FREE" | "PRO" | "MAX";
export type ScrapeLinkGroupForm = {
  id: string;
  name: string;
  frequency: LinkGroupFrequency;
  allowedDomains: string[];
  lastRunAt?: string | null;
  links: Array<{
    url: string;
    depth: number;
    followExternalDomains: boolean;
    pageWildcardPostfixes: string[];
  }>;
};

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
  linkGroups: ScrapeLinkGroupForm[];
  plan: ScrapePlan;
}) {
  const { scrapeSeedUrls, scrapeAllowedPrefixes, scrapeCoverage, scrapeSpeed, plan, linkGroups } = opts;
  const normalizedGroups = linkGroups
    .map((group) => ({
      id: group.id.trim(),
      name: group.name.trim(),
      frequency: clampFrequencyForPlan(group.frequency, plan),
      allowedDomains: group.allowedDomains
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
      lastRunAt: group.lastRunAt ?? null,
      links: group.links
        .map((link) => ({
          url: link.url.trim(),
          depth: Math.max(0, Math.trunc(link.depth)),
          followExternalDomains: Boolean(link.followExternalDomains),
          pageWildcardPostfixes: link.pageWildcardPostfixes
            .map((pattern) => pattern.trim())
            .filter(Boolean),
        }))
        .filter((link) => link.url.length > 0),
    }))
    .filter((group) => group.id.length > 0 && group.name.length > 0 && group.links.length > 0);
  const firstGroupLinks = normalizedGroups[0]?.links ?? [];
  const derivedSeedUrls = firstGroupLinks.map((link) => link.url).filter(Boolean);
  const derivedAllowedPrefixes = Array.from(
    new Set(
      firstGroupLinks
        .filter((link) => !link.followExternalDomains)
        .map((link) => {
          try {
            const u = new URL(link.url);
            return `${u.origin}/`;
          } catch {
            return "";
          }
        })
        .filter(Boolean),
    ),
  );

  return normalizeScrapeConfigObject({
    seed_urls:
      derivedSeedUrls.length > 0
        ? derivedSeedUrls
        : scrapeSeedUrls
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
    allowed_prefixes:
      derivedAllowedPrefixes.length > 0
        ? derivedAllowedPrefixes
        : scrapeAllowedPrefixes
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
    max_pages: Math.trunc(maxPagesByCoverage(scrapeCoverage, plan)),
    delay: 0.5,
    parallel_workers: Math.trunc(workersBySpeed(scrapeSpeed)),
    respect_allowed_prefixes: true,
    link_groups: normalizedGroups,
  });
}
