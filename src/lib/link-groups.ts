export const LINK_GROUP_FREQUENCIES = [
  "manual",
  "daily",
  "every_3_days",
  "weekly",
  "every_2_weeks",
  "monthly",
] as const;

export type LinkGroupFrequency = (typeof LINK_GROUP_FREQUENCIES)[number];
export type LinkGroupPlan = "FREE" | "PRO" | "MAX";

export type LinkGroupLink = {
  url: string;
  depth: number;
  followExternalDomains: boolean;
  pageWildcardPostfixes: string[];
};

export type LinkGroupConfig = {
  id: string;
  name: string;
  frequency: LinkGroupFrequency;
  allowedDomains: string[];
  links: LinkGroupLink[];
  lastRunAt?: string | null;
};

const DEFAULT_LINK_DEPTH = 1;

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

function normalizeFrequency(v: unknown): LinkGroupFrequency {
  if (typeof v === "string" && LINK_GROUP_FREQUENCIES.includes(v as LinkGroupFrequency)) {
    return v as LinkGroupFrequency;
  }
  return "manual";
}

function normalizeDepth(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return Math.max(0, Math.trunc(v));
  }
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  }
  return DEFAULT_LINK_DEPTH;
}

function normalizeLinks(input: unknown): LinkGroupLink[] {
  if (!Array.isArray(input)) return [];
  const out: LinkGroupLink[] = [];
  for (const item of input) {
    if (!isRecord(item)) continue;
    const url = asNonEmptyString(item.url);
    if (!url) continue;
    out.push({
      url,
      depth: normalizeDepth(item.depth),
      followExternalDomains: Boolean(item.followExternalDomains),
      pageWildcardPostfixes: Array.isArray(item.pageWildcardPostfixes)
        ? item.pageWildcardPostfixes
            .filter((v): v is string => typeof v === "string")
            .map((v) => v.trim())
            .filter(Boolean)
        : [],
    });
  }
  return out;
}

function normalizeDomains(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .map((v) => {
          // Match existing allow-domain parsing used in widget auth routes:
          // supports full URLs and strips any path segment.
          const withoutScheme = v.replace(/^https?:\/\//, "");
          const hostOnly = withoutScheme.split("/")[0]?.trim().toLowerCase() ?? "";
          return hostOnly;
        }),
    ),
  );
}

export function normalizeLinkGroups(input: unknown): LinkGroupConfig[] {
  if (!Array.isArray(input)) return [];
  const out: LinkGroupConfig[] = [];
  for (const item of input) {
    if (!isRecord(item)) continue;
    const id = asNonEmptyString(item.id);
    const name = asNonEmptyString(item.name);
    const links = normalizeLinks(item.links);
    if (!id || !name || links.length === 0) continue;
    out.push({
      id,
      name,
      frequency: normalizeFrequency(item.frequency),
      allowedDomains: normalizeDomains(item.allowedDomains),
      links,
      lastRunAt: asNonEmptyString(item.lastRunAt),
    });
  }
  return out;
}

export function isScheduleEnabledForPlan(plan: LinkGroupPlan): boolean {
  return plan === "PRO" || plan === "MAX";
}

export function allowedFrequenciesForPlan(plan: LinkGroupPlan): LinkGroupFrequency[] {
  if (plan === "MAX") return [...LINK_GROUP_FREQUENCIES];
  if (plan === "PRO") return ["manual", "monthly"];
  return ["manual"];
}

export function clampFrequencyForPlan(
  frequency: LinkGroupFrequency,
  plan: LinkGroupPlan,
): LinkGroupFrequency {
  const allowed = allowedFrequenciesForPlan(plan);
  if (allowed.includes(frequency)) return frequency;
  if (plan === "PRO") return "monthly";
  return "manual";
}

export function frequencyToIntervalMs(freq: LinkGroupFrequency): number {
  switch (freq) {
    case "manual":
      return Number.POSITIVE_INFINITY;
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "every_3_days":
      return 3 * 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
    case "every_2_weeks":
      return 14 * 24 * 60 * 60 * 1000;
    case "monthly":
      return 30 * 24 * 60 * 60 * 1000;
  }
}

export function isLinkGroupDue(group: LinkGroupConfig, now = new Date()): boolean {
  if (group.frequency === "manual") return false;
  if (!group.lastRunAt) return true;
  const last = Date.parse(group.lastRunAt);
  if (!Number.isFinite(last)) return true;
  return now.getTime() - last >= frequencyToIntervalMs(group.frequency);
}
