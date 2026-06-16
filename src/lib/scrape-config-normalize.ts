import { normalizeSourceGroups } from "~/lib/scrape-source-groups";

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

  if ("cloudflare_per_seed_limit" in out) {
    const n = toFiniteNumber(out.cloudflare_per_seed_limit);
    if (n !== null && n >= 1) out.cloudflare_per_seed_limit = Math.trunc(n);
    else delete out.cloudflare_per_seed_limit;
  }

  if ("cloudflare_job_retries" in out) {
    const n = toFiniteNumber(out.cloudflare_job_retries);
    if (n !== null && n >= 0) out.cloudflare_job_retries = Math.trunc(n);
    else delete out.cloudflare_job_retries;
  }

  if ("cloudflare_stall_timeout_ms" in out) {
    const n = toFiniteNumber(out.cloudflare_stall_timeout_ms);
    if (n !== null && n >= 0) out.cloudflare_stall_timeout_ms = Math.trunc(n);
    else delete out.cloudflare_stall_timeout_ms;
  }

  for (const key of [
    "cloudflare_discovery_timeout_ms",
    "cloudflare_discovery_delay_seconds",
    "cloudflare_markdown_retries",
    "cloudflare_markdown_retry_delay_ms",
    "cloudflare_markdown_timeout_ms",
  ]) {
    if (!(key in out)) continue;
    const n = toFiniteNumber(out[key]);
    if (n !== null && n >= 0) out[key] = Math.trunc(n);
    else delete out[key];
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

  if ("scrape_provider" in out) {
    const value = typeof out.scrape_provider === "string" ? out.scrape_provider.trim().toLowerCase() : "";
    if (value === "firecrawl" || value === "cloudflare") out.scrape_provider = value;
    else delete out.scrape_provider;
  }

  if ("cloudflare_render_mode" in out) {
    const value = typeof out.cloudflare_render_mode === "string" ? out.cloudflare_render_mode.trim().toLowerCase() : "";
    if (value === "auto" || value === "static" || value === "browser") out.cloudflare_render_mode = value;
    else delete out.cloudflare_render_mode;
  }

  if ("cloudflare_discovery_mode" in out) {
    const value =
      typeof out.cloudflare_discovery_mode === "string"
        ? out.cloudflare_discovery_mode.trim().toLowerCase()
        : "";
    if (value === "crawl" || value === "static") out.cloudflare_discovery_mode = value;
    else delete out.cloudflare_discovery_mode;
  }

  if ("cloudflare_static_discovery_scope" in out) {
    const value =
      typeof out.cloudflare_static_discovery_scope === "string"
        ? out.cloudflare_static_discovery_scope.trim().toLowerCase()
        : "";
    if (value === "seed" || value === "allowed_prefixes") out.cloudflare_static_discovery_scope = value;
    else delete out.cloudflare_static_discovery_scope;
  }

  if ("source_groups" in out) {
    const groups = normalizeSourceGroups(out.source_groups);
    if (groups.length > 0) out.source_groups = groups;
    else delete out.source_groups;
  }

  if ("source_group_ids" in out) {
    if (Array.isArray(out.source_group_ids)) {
      const ids = out.source_group_ids.filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0,
      );
      if (ids.length > 0) out.source_group_ids = ids;
      else delete out.source_group_ids;
    } else {
      delete out.source_group_ids;
    }
  }

  if ("source_group_mode" in out) {
    const value = typeof out.source_group_mode === "string" ? out.source_group_mode.trim().toLowerCase() : "";
    if (value === "all" || value === "core" || value === "live") out.source_group_mode = value;
    else delete out.source_group_mode;
  }

  for (const key of ["skip_map", "finetune", "respect_allowed_prefixes", "use_selenium", "cloudflare_render"]) {
    if (!(key in out)) continue;
    if (typeof out[key] === "boolean") continue;
    if (typeof out[key] === "string") {
      const normalized = out[key].trim().toLowerCase();
      if (normalized === "true") out[key] = true;
      else if (normalized === "false") out[key] = false;
      else delete out[key];
      continue;
    }
    delete out[key];
  }

  return out;
}
