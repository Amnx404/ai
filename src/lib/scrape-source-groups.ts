export type ScrapeSourceGroup = {
  id?: string;
  label?: string;
  enabled?: boolean;
  live?: boolean;
  seed_urls?: string[];
  allowed_prefixes?: string[];
  max_pages?: number;
  max_depth?: number | null;
  refresh_interval_minutes?: number | null;
  delay?: number;
  url_whitelist_patterns?: string[];
  url_blacklist_patterns?: string[];
  scrape_provider?: "firecrawl" | "cloudflare";
  cloudflare_render_mode?: "auto" | "static" | "browser";
  cloudflare_discovery_mode?: "crawl" | "static";
  cloudflare_per_seed_limit?: number | null;
  cloudflare_stall_timeout_ms?: number | null;
};

export function normalizeSourceGroups(value: unknown): ScrapeSourceGroup[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const raw = item as Record<string, unknown>;
      const group: ScrapeSourceGroup = {
        id: stringValue(raw.id),
        label: stringValue(raw.label),
        enabled: booleanValue(raw.enabled),
        live: booleanValue(raw.live),
        seed_urls: stringArray(raw.seed_urls),
        allowed_prefixes: stringArray(raw.allowed_prefixes),
        max_pages: integerValue(raw.max_pages, 1),
        max_depth: raw.max_depth === null ? null : integerValue(raw.max_depth, 0),
        refresh_interval_minutes:
          raw.refresh_interval_minutes === null
            ? null
            : integerValue(raw.refresh_interval_minutes, 1),
        delay: numberValue(raw.delay, 0),
        url_whitelist_patterns: stringArray(raw.url_whitelist_patterns),
        url_blacklist_patterns: stringArray(raw.url_blacklist_patterns),
        scrape_provider: scrapeProvider(raw.scrape_provider),
        cloudflare_render_mode: cloudflareRenderMode(raw.cloudflare_render_mode),
        cloudflare_discovery_mode: cloudflareDiscoveryMode(raw.cloudflare_discovery_mode),
        cloudflare_per_seed_limit:
          raw.cloudflare_per_seed_limit === null
            ? null
            : integerValue(raw.cloudflare_per_seed_limit, 1),
        cloudflare_stall_timeout_ms:
          raw.cloudflare_stall_timeout_ms === null
            ? null
            : integerValue(raw.cloudflare_stall_timeout_ms, 0),
      };

      if ((group.seed_urls?.length ?? 0) === 0 && (group.allowed_prefixes?.length ?? 0) === 0) {
        return null;
      }

      return stripUndefined(group);
    })
    .filter((group): group is ScrapeSourceGroup => Boolean(group));
}

export function resolveScrapeConfigSourceGroups(input: Record<string, unknown>): Record<string, unknown> {
  const groups = normalizeSourceGroups(input.source_groups);
  if (groups.length === 0) return input;

  const selectedIds = new Set(stringArray(input.source_group_ids));
  const liveOnly = input.source_group_mode === "live";
  const coreOnly = input.source_group_mode === "core";
  const selectedGroups = groups.filter((group) => {
    if (group.enabled === false) return false;
    if (selectedIds.size > 0 && (!group.id || !selectedIds.has(group.id))) return false;
    if (liveOnly && group.live !== true) return false;
    if (coreOnly && group.live === true) return false;
    return true;
  });

  if (selectedGroups.length === 0) return input;

  const seedUrls = uniqueStrings(
    selectedGroups.flatMap((group) => {
      const seeds = group.seed_urls ?? [];
      return seeds.length > 0 ? seeds : group.allowed_prefixes ?? [];
    }),
  );
  const allowedPrefixes = uniqueStrings([
    ...selectedGroups.flatMap((group) => group.allowed_prefixes ?? []),
    ...selectedGroups.flatMap((group) => group.seed_urls ?? []),
  ]);
  const whitelist = uniqueStrings([
    ...stringArray(input.url_whitelist_patterns),
    ...selectedGroups.flatMap((group) => group.url_whitelist_patterns ?? []),
  ]);
  const blacklist = uniqueStrings([
    ...stringArray(input.url_blacklist_patterns),
    ...selectedGroups.flatMap((group) => group.url_blacklist_patterns ?? []),
  ]);
  const maxDepths = selectedGroups
    .map((group) => group.max_depth)
    .filter((value): value is number => typeof value === "number");
  const maxPages = selectedGroups.reduce(
    (sum, group) => sum + (typeof group.max_pages === "number" ? group.max_pages : 0),
    0,
  );
  const providers = uniqueStrings(selectedGroups.map((group) => group.scrape_provider).filter(Boolean));
  const renderModes = uniqueStrings(selectedGroups.map((group) => group.cloudflare_render_mode).filter(Boolean));
  const discoveryModes = uniqueStrings(
    selectedGroups.map((group) => group.cloudflare_discovery_mode).filter(Boolean),
  );
  const delays = selectedGroups
    .map((group) => group.delay)
    .filter((value): value is number => typeof value === "number");
  const perSeedLimits = selectedGroups
    .map((group) => group.cloudflare_per_seed_limit)
    .filter((value): value is number => typeof value === "number");
  const stallTimeouts = selectedGroups
    .map((group) => group.cloudflare_stall_timeout_ms)
    .filter((value): value is number => typeof value === "number");

  return stripUndefined({
    ...input,
    seed_urls: seedUrls,
    allowed_prefixes: allowedPrefixes,
    url_whitelist_patterns: whitelist,
    url_blacklist_patterns: blacklist,
    ...(maxDepths.length > 0 ? { max_depth: Math.max(...maxDepths) } : {}),
    ...(maxPages > 0 ? { max_pages: maxPages } : {}),
    ...(providers.length === 1 ? { scrape_provider: providers[0] } : {}),
    ...(renderModes.length === 1 ? { cloudflare_render_mode: renderModes[0] } : {}),
    ...(discoveryModes.length === 1 ? { cloudflare_discovery_mode: discoveryModes[0] } : {}),
    ...(delays.length > 0 ? { delay: Math.max(...delays) } : {}),
    ...(perSeedLimits.length > 0 ? { cloudflare_per_seed_limit: Math.min(...perSeedLimits) } : {}),
    ...(stallTimeouts.length > 0 ? { cloudflare_stall_timeout_ms: Math.min(...stallTimeouts) } : {}),
    source_groups: groups,
  });
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return undefined;
}

function integerValue(value: unknown, min: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min) return undefined;
  return Math.trunc(n);
}

function numberValue(value: unknown, min: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < min) return undefined;
  return n;
}

function scrapeProvider(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "cloudflare" || normalized === "firecrawl" ? normalized : undefined;
}

function cloudflareRenderMode(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "auto" || normalized === "static" || normalized === "browser" ? normalized : undefined;
}

function cloudflareDiscoveryMode(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "crawl" || normalized === "static" ? normalized : undefined;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
