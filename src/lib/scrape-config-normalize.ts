/**
 * Coerce scrape-related numeric fields on Site.scrapeConfig (JSON) so values
 * round-trip as proper numbers for the scraper API (int vs float).
 */
export function normalizeScrapeConfigObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};

  const out: Record<string, unknown> = { ...(input as Record<string, unknown>) };

  const toFiniteNumber = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  if ("max_pages" in out) {
    const n = toFiniteNumber(out.max_pages);
    if (n !== null && n >= 1) out.max_pages = Math.trunc(n);
    else delete out.max_pages;
  }

  if ("delay" in out) {
    const n = toFiniteNumber(out.delay);
    if (n !== null && n >= 0) out.delay = n;
    else delete out.delay;
  }

  if ("parallel_workers" in out) {
    const n = toFiniteNumber(out.parallel_workers);
    if (n !== null && n >= 1) out.parallel_workers = Math.trunc(n);
    else delete out.parallel_workers;
  }

  if ("retry_limit" in out) {
    const n = toFiniteNumber(out.retry_limit);
    if (n !== null && n >= 0) out.retry_limit = Math.trunc(n);
    else delete out.retry_limit;
  }

  if ("max_depth" in out) {
    if (out.max_depth === null) {
      // Scraper API allows null for unlimited depth.
    } else {
      const n = toFiniteNumber(out.max_depth);
      if (n !== null && n >= 0) out.max_depth = Math.trunc(n);
      else delete out.max_depth;
    }
  }

  return out;
}
