import type { FirecrawlMapLink } from "./types.js";

export type UrlCandidate = FirecrawlMapLink & {
  source: "seed" | "map";
};

export function canonicalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function defaultAllowedPrefixes(seedUrls: string[]) {
  const prefixes = new Set<string>();
  for (const seedUrl of seedUrls) {
    try {
      const url = new URL(seedUrl);
      prefixes.add(`${url.origin}/`);
    } catch {
      // Ignore invalid URLs; they were filtered earlier.
    }
  }
  return [...prefixes];
}

export function normalizeAllowedPrefixes(rawPrefixes: string[], seedUrls: string[]) {
  const normalized = rawPrefixes
    .map((prefix) => canonicalizeUrl(prefix))
    .filter((prefix): prefix is string => Boolean(prefix));

  return normalized.length > 0 ? normalized : defaultAllowedPrefixes(seedUrls);
}

export function isAllowedByPrefix(url: string, allowedPrefixes: string[]) {
  if (allowedPrefixes.length === 0) return true;
  return allowedPrefixes.some((prefix) => url.startsWith(prefix));
}

export function applyRegexFilters(
  urls: UrlCandidate[],
  opts: {
    whitelist?: string[];
    blacklist?: string[];
  },
) {
  const whitelist = compileRegexes(opts.whitelist);
  const blacklist = compileRegexes(opts.blacklist);

  return urls.filter((candidate) => {
    if (blacklist.some((re) => re.test(candidate.url))) return false;
    if (whitelist.length > 0 && !whitelist.some((re) => re.test(candidate.url))) {
      return false;
    }
    return true;
  });
}

export function dedupeCandidates(candidates: UrlCandidate[]) {
  const seen = new Set<string>();
  const deduped: UrlCandidate[] = [];

  for (const candidate of candidates) {
    const url = canonicalizeUrl(candidate.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    deduped.push({ ...candidate, url });
  }

  return deduped;
}

function compileRegexes(patterns: string[] | undefined) {
  if (!Array.isArray(patterns)) return [];

  return patterns
    .map((pattern) => {
      try {
        return new RegExp(pattern);
      } catch {
        return null;
      }
    })
    .filter((re): re is RegExp => Boolean(re));
}
