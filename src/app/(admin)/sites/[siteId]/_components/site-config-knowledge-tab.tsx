"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarClock,
  ChevronDown,
  CircleHelp,
  Copy,
  FileText,
  Globe2,
  Pencil,
  PlusCircle,
  Trash2,
  X,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

import { Field, ProgressStep, UrlListInput, inputCls } from "./site-config-form.ui";

function countLineItems(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function pluralUnit(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

function countLabel(count: number, singular: string, plural: string) {
  return `${count} ${pluralUnit(count, singular, plural)}`;
}

function labelForCoverage(value: string) {
  if (value === "thorough") return "1000 pages";
  if (value === "wide") return "50 pages";
  return "10 pages";
}

function labelForSpeed(value: string) {
  if (value === "fastest") return "10 workers";
  if (value === "speedy") return "7 workers";
  return "3 workers";
}

function labelForRenderMode(value: string) {
  if (value === "browser") return "Always render browser";
  if (value === "static") return "Static HTML only";
  return "Auto static + browser";
}

function labelForDiscoveryMode(value: string) {
  if (value === "static") return "Fetched HTML links";
  return "Crawl discovered links";
}

function templateForSourceGroupKind(kind: NewSourceGroupKind) {
  return SOURCE_GROUP_TEMPLATES.find((template) => template.kind === kind) ?? SOURCE_GROUP_TEMPLATES[1];
}

function compactUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function formatRefreshInterval(minutes: number) {
  if (minutes % 10080 === 0) {
    const weeks = minutes / 10080;
    return weeks === 1 ? "Every week" : `Every ${weeks} weeks`;
  }
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "Every day" : `Every ${days} days`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "Every hour" : `Every ${hours} hours`;
  }
  return `Every ${minutes} minutes`;
}

function sourceGroupUpdateLabel(group: SourceGroupSummary) {
  if (!group.live) return "Manual run";
  if (group.refreshMinutes !== null) return formatRefreshInterval(group.refreshMinutes);
  return "Scheduled update";
}

type SourceGroupSummary = {
  id: string;
  label: string;
  enabled: boolean;
  live: boolean;
  seeds: number;
  prefixes: number;
  seedUrls: string[];
  allowedPrefixes: string[];
  maxDepth: number | null;
  maxPages: number | null;
  refreshMinutes: number | null;
  firstSeed: string;
  renderMode: string | null;
  discoveryMode: string | null;
};

type SourceGroupRecord = Record<string, unknown>;

type NewSourceGroupKind = "static" | "dynamic" | "live";
type SourceRunScope = "all" | "core" | "live";

const SOURCE_GROUP_TEMPLATES: Array<{
  kind: NewSourceGroupKind;
  label: string;
  body: string;
  live: boolean;
  maxDepth: string;
  maxPages: string;
  refreshMinutes: string;
  renderMode: "auto" | "static" | "browser";
  discoveryMode: "crawl" | "static";
  Icon: typeof FileText;
}> = [
  {
    kind: "static",
    label: "Static docs",
    body: "Stable docs, course notes, and GitHub pages. Runs only when you start reading.",
    live: false,
    maxDepth: "7",
    maxPages: "300",
    refreshMinutes: "10080",
    renderMode: "static",
    discoveryMode: "static",
    Icon: FileText,
  },
  {
    kind: "dynamic",
    label: "Dynamic pages",
    body: "Marketing, course, or app-rendered pages. Uses browser rendering when static HTML is thin.",
    live: false,
    maxDepth: "4",
    maxPages: "100",
    refreshMinutes: "10080",
    renderMode: "auto",
    discoveryMode: "crawl",
    Icon: Globe2,
  },
  {
    kind: "live",
    label: "Live pages",
    body: "Race, registration, and event pages that should update on a schedule.",
    live: true,
    maxDepth: "3",
    maxPages: "600",
    refreshMinutes: "1440",
    renderMode: "static",
    discoveryMode: "static",
    Icon: CalendarClock,
  },
];

const EMPTY_NEW_SOURCE_GROUP = {
  kind: "dynamic" as NewSourceGroupKind,
  label: "",
  seedUrls: "",
  allowedPrefixes: "",
  live: false,
  maxDepth: "3",
  maxPages: "50",
  refreshMinutes: "10080",
};

type SourceGroupDraft = typeof EMPTY_NEW_SOURCE_GROUP;

function parseSourceGroupSummaries(raw: string): {
  error: string;
  groups: SourceGroupSummary[];
} {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "", groups: [] };

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Knowledge groups must be a JSON array.", groups: [] };
    }

    const groups = parsed.map((item, index) => {
      const group = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const seedUrls = Array.isArray(group.seed_urls)
        ? group.seed_urls.filter((url): url is string => typeof url === "string")
        : [];
      const prefixes = Array.isArray(group.allowed_prefixes)
        ? group.allowed_prefixes.filter((url): url is string => typeof url === "string")
        : [];

      return {
        id: typeof group.id === "string" && group.id.trim() ? group.id : `group-${index + 1}`,
        label:
          typeof group.label === "string" && group.label.trim()
            ? group.label
            : typeof group.id === "string" && group.id.trim()
              ? group.id
              : `Knowledge group ${index + 1}`,
        enabled: group.enabled !== false,
        live: group.live === true,
        seeds: seedUrls.length,
        prefixes: prefixes.length,
        seedUrls,
        allowedPrefixes: prefixes,
        maxDepth: typeof group.max_depth === "number" ? group.max_depth : null,
        maxPages: typeof group.max_pages === "number" ? group.max_pages : null,
        refreshMinutes:
          typeof group.refresh_interval_minutes === "number"
            ? group.refresh_interval_minutes
            : null,
        firstSeed: seedUrls[0] ?? "",
        renderMode:
          typeof group.cloudflare_render_mode === "string" ? group.cloudflare_render_mode : null,
        discoveryMode:
          typeof group.cloudflare_discovery_mode === "string"
            ? group.cloudflare_discovery_mode
            : null,
      };
    });

    return { error: "", groups };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Knowledge groups JSON is invalid.",
      groups: [],
    };
  }
}

function parseSourceGroupRecords(raw: string): {
  error: string;
  groups: SourceGroupRecord[];
} {
  const trimmed = raw.trim();
  if (!trimmed) return { error: "", groups: [] };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Knowledge groups must be a JSON array.", groups: [] };
    }
    return {
      error: "",
      groups: parsed.map((item) =>
        item && typeof item === "object" ? { ...(item as SourceGroupRecord) } : {},
      ),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Knowledge groups JSON is invalid.",
      groups: [],
    };
  }
}

function stringifySourceGroups(groups: SourceGroupRecord[]) {
  return JSON.stringify(groups, null, 2);
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseNonNegativeInt(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.trunc(parsed);
}

function slugifyGroupId(label: string, existingIds: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/https?:\/\//g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "source-group";
  let id = base;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function scopeFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/`;
  } catch {
    return url;
  }
}

function inferSourceGroupKind(group: SourceGroupRecord): NewSourceGroupKind {
  if (group.live === true) return "live";
  if (
    group.cloudflare_render_mode === "static" &&
    group.cloudflare_discovery_mode === "static"
  ) {
    return "static";
  }
  return "dynamic";
}

function stringArrayFromRecord(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function draftFromSourceGroupRecord(group: SourceGroupRecord): SourceGroupDraft {
  const kind = inferSourceGroupKind(group);
  const template = templateForSourceGroupKind(kind);
  const label =
    typeof group.label === "string" && group.label.trim()
      ? group.label.trim()
      : typeof group.id === "string" && group.id.trim()
        ? group.id.trim()
        : "";
  const maxDepth =
    typeof group.max_depth === "number" ? String(group.max_depth) : template.maxDepth;
  const maxPages =
    typeof group.max_pages === "number" ? String(group.max_pages) : template.maxPages;
  const refreshMinutes =
    typeof group.refresh_interval_minutes === "number"
      ? String(group.refresh_interval_minutes)
      : template.refreshMinutes;

  return {
    kind,
    label,
    seedUrls: stringArrayFromRecord(group.seed_urls).join("\n"),
    allowedPrefixes: stringArrayFromRecord(group.allowed_prefixes).join("\n"),
    live: template.live,
    maxDepth,
    maxPages,
    refreshMinutes,
  };
}

function isHttpSourceUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

function SourceGroupUrlList({
  title,
  urls,
  link,
}: {
  title: string;
  urls: string[];
  link?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase text-gray-500">{title}</p>
        <span className="text-[11px] font-medium text-gray-400">
          {countLabel(urls.length, "item", "items")}
        </span>
      </div>
      {urls.length ? (
        <ul className="max-h-44 space-y-1 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
          {urls.map((url, index) => (
            <li
              key={`${title}-${url}-${index}`}
              className="rounded-md bg-gray-50 px-2 py-1.5 font-mono text-[11px] leading-4 text-gray-700"
            >
              {link ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="block min-h-7 break-all leading-5 underline decoration-gray-300 underline-offset-2 hover:text-gray-950 hover:decoration-gray-500"
                >
                  {url}
                </a>
              ) : (
                <span className="block break-all">{url}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-3 text-xs text-gray-400">
          No {title.toLowerCase()} set.
        </div>
      )}
    </div>
  );
}

function ConfigHintLabel({
  children,
  hint,
  align = "left",
  htmlFor,
}: {
  children: ReactNode;
  hint: string;
  align?: "left" | "right";
  htmlFor?: string;
}) {
  const helpLabel = typeof children === "string" ? `Help for ${children}` : hint;

  return (
    <div className="group/hint relative mb-1 flex items-center gap-1.5">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-xs font-medium text-gray-600">
          {children}
        </label>
      ) : (
        <span className="text-xs font-medium text-gray-600">{children}</span>
      )}
      <button
        type="button"
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold leading-none text-gray-500",
          "shadow-sm hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:ring-offset-1",
        )}
        aria-label={helpLabel}
        title={hint}
      >
        <CircleHelp className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none invisible absolute top-full z-30 mt-1.5 w-[min(calc(100vw-1.5rem),17rem)] rounded-lg border border-gray-700 bg-gray-900 px-2.5 py-2 text-left text-[11px] font-normal leading-snug text-white shadow-lg",
          "opacity-0 transition-opacity duration-150",
          "group-hover/hint:visible group-hover/hint:opacity-100",
          "group-focus-within/hint:visible group-focus-within/hint:opacity-100",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {hint}
      </span>
    </div>
  );
}

export function SiteConfigKnowledgeTab({
  siteId,
  siteLivePineconeNs,
  plan,
  form,
  setForm,
  normalizeSourceUrl,
  onRefresh,
  onPersist,
}: {
  siteId: string;
  siteLivePineconeNs: string | null;
  plan: "FREE" | "PRO" | "MAX";
  form: {
    scrapeProvider: string;
    scrapeCloudflareRenderMode: string;
    scrapeCloudflareDiscoveryMode: string;
    scrapeCloudflarePerSeedLimit: string;
    scrapeSourceGroupsJson: string;
    scrapeSeedUrls: string;
    scrapeAllowedPrefixes: string;
    scrapeCoverage: string;
    scrapeSpeed: string;
    scrapeMaxDepth: string;
    scrapeSkipMap: boolean;
    scrapeFinetune: boolean;
    scrapeUrlWhitelistPatterns: string;
    scrapeUrlBlacklistPatterns: string;
  };
  setForm: (next: typeof form) => void;
  normalizeSourceUrl: (raw: string) => string;
  onRefresh: () => void;
  onPersist: (next?: typeof form) => void;
}) {
  const [kbRunId, setKbRunId] = useState<string>("");
  const [kbStep, setKbStep] = useState<
    "idle" | "scrape" | "prepare" | "upload" | "done" | "error"
  >("idle");
  const [kbPipelineStatus, setKbPipelineStatus] = useState<string>("");
  const [kbLoading, setKbLoading] = useState(false);
  const [kbStarting, setKbStarting] = useState(false);
  const [kbError, setKbError] = useState<string>("");
  const [kbUrls, setKbUrls] = useState<string[]>([]);
  const [kbErrorPhase, setKbErrorPhase] = useState<
    "scrape" | "prepare" | "upload" | null
  >(null);
  const [scrapedUrlsOpen, setScrapedUrlsOpen] = useState(false);
  const [fallbackUrlsOpen, setFallbackUrlsOpen] = useState(false);
  const [sourceGroupsEditorOpen, setSourceGroupsEditorOpen] = useState(false);
  const [newSourceGroupOpen, setNewSourceGroupOpen] = useState(false);
  const [newSourceGroup, setNewSourceGroup] = useState(EMPTY_NEW_SOURCE_GROUP);
  const [editingSourceGroupIndex, setEditingSourceGroupIndex] = useState<number | null>(null);
  const [editingSourceGroup, setEditingSourceGroup] =
    useState<SourceGroupDraft>(EMPTY_NEW_SOURCE_GROUP);
  const [advancedConfigOpen, setAdvancedConfigOpen] = useState(false);
  const [runScope, setRunScope] = useState<SourceRunScope>("all");
  const [runConfirmOpen, setRunConfirmOpen] = useState(false);

  const kbBootstrapSeq = useRef(0);
  const kbStartInFlightRef = useRef(false);
  const kbStartSeqRef = useRef(0);

  async function readResponseJson(res: Response) {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      const preview = text.slice(0, 400).trim();
      throw new Error(
        `Request failed (${res.status} ${res.statusText}) with non-JSON response: ${preview || "<empty>"}`,
      );
    }
  }

  function scrapedUrlsFromStatus(payload: any): string[] {
    const candidates = [
      payload?.step_responses?.scrape?.outputs?.urls,
      payload?.scrape?.outputs?.urls,
      payload?.outputs?.urls,
    ];

    for (const value of candidates) {
      if (!Array.isArray(value)) continue;
      const urls = value
        .filter((item): item is string => typeof item === "string")
        .filter((item) => /^https?:\/\//i.test(item));
      if (urls.length) return Array.from(new Set(urls)).slice(-50);
    }

    return [];
  }

  const isKbPolling =
    Boolean(kbRunId) &&
    kbStep !== "done" &&
    kbStep !== "error" &&
    (kbPipelineStatus === "" ||
      (kbPipelineStatus !== "succeeded" &&
        kbPipelineStatus !== "failed" &&
        kbPipelineStatus !== "aborted"));

  // Bootstrap: on mount, load latest run from DB.
  useEffect(() => {
    let cancelled = false;
    const seq = ++kbBootstrapSeq.current;
    (async () => {
      setKbLoading(true);
      setKbError("");
      setKbErrorPhase(null);
      try {
        const res = await fetch(
          `/api/v1/knowledge-base/run/latest?siteId=${encodeURIComponent(siteId)}`,
          { cache: "no-store" },
        );
        const json = (await readResponseJson(res)) as any;
        if (!res.ok) throw new Error(json?.error ?? `Failed to load KB run (${res.status})`);
        if (cancelled || kbBootstrapSeq.current !== seq) return;

        if (!json?.hasRun) {
          setKbRunId("");
          setKbPipelineStatus("");
          setKbStep("idle");
          setKbUrls([]);
          return;
        }

        const runId = typeof json?.runId === "string" ? json.runId.trim() : "";
        const pipelineStatus =
          typeof json?.pipelineStatus === "string" ? json.pipelineStatus : "";
        const done = Boolean(json?.done);

        setKbRunId(runId);
        setKbPipelineStatus(pipelineStatus);

        const cached = json?.cachedStatus ?? null;
        if (cached) {
          const urls = scrapedUrlsFromStatus(cached);
          if (urls.length) setKbUrls(urls);
        } else {
          setKbUrls([]);
        }

        if (done || pipelineStatus === "succeeded") setKbStep("done");
        else if (pipelineStatus === "failed" || pipelineStatus === "aborted") setKbStep("error");
        else setKbStep("scrape");
      } catch (e: any) {
        if (cancelled || kbBootstrapSeq.current !== seq) return;
        setKbStep("error");
        setKbErrorPhase("scrape");
        setKbError(typeof e?.message === "string" ? e.message : "Failed to load knowledge index");
      } finally {
        if (!cancelled && kbBootstrapSeq.current === seq) setKbLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [siteId]);

  useEffect(() => {
    if (!kbRunId) return;
    if (!isKbPolling) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/knowledge-base/run/status?siteId=${encodeURIComponent(siteId)}&runId=${encodeURIComponent(kbRunId)}`,
          { cache: "no-store" },
        );
        const json = (await readResponseJson(res)) as any;
        if (!res.ok) throw new Error(json?.error ?? `Status failed (${res.status})`);
        if (cancelled) return;

        const pipelineStatus = (json?.pipeline_status as string | undefined) ?? "";
        const currentStep = (json?.current_step as string | undefined) ?? "";
        setKbPipelineStatus(pipelineStatus);

        if (pipelineStatus === "succeeded") {
          setKbStep("done");
          onRefresh();
        } else if (pipelineStatus === "failed" || pipelineStatus === "aborted") {
          setKbStep("error");
          setKbErrorPhase(
            currentStep === "prepare" || currentStep === "upload"
              ? (currentStep as any)
              : "scrape",
          );
          setKbError(
            typeof json?.error === "string" && json.error.trim()
              ? json.error
              : "Source page run failed.",
          );
        } else {
          if (currentStep === "prepare") setKbStep("prepare");
          else if (currentStep === "upload") setKbStep("upload");
          else setKbStep("scrape");
        }

        const urls = scrapedUrlsFromStatus(json);
        if (urls.length) setKbUrls(urls);
      } catch (e: any) {
        if (cancelled) return;
        setKbErrorPhase("scrape");
        setKbStep("error");
        setKbError(typeof e?.message === "string" ? e.message : "Status polling failed");
      }
    };

    void tick();
    const interval = setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isKbPolling, kbRunId, onRefresh, siteId]);

  async function runKbPipeline() {
    if (sourceRunBlockedReason) return;
    if (kbStartInFlightRef.current) return;
    kbStartInFlightRef.current = true;
    const startSeq = ++kbStartSeqRef.current;

    setRunConfirmOpen(false);
    setKbError("");
    setKbErrorPhase(null);
    setKbPipelineStatus("");
    setKbUrls([]);
    setKbStep("scrape");
    setKbLoading(false);
    setKbStarting(true);
    kbBootstrapSeq.current++;

    try {
      const res = await fetch("/api/v1/knowledge-base/run/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          ...(sourceGroupSummary.groups.length > 0 ? { sourceGroupMode: runScope } : {}),
        }),
      });
      const json = (await readResponseJson(res)) as any;
      if (!res.ok) throw new Error(json?.error ?? `Failed to start run (${res.status})`);
      const runId = json?.run_id as string | undefined;
      if (!runId) throw new Error("Run started but no run_id returned");

      if (kbStartSeqRef.current === startSeq) {
        setKbRunId(runId);
        setKbPipelineStatus("queued");
        setKbStep("scrape");

        try {
          const sres = await fetch(
            `/api/v1/knowledge-base/run/status?siteId=${encodeURIComponent(siteId)}&runId=${encodeURIComponent(runId)}`,
            { cache: "no-store" },
          );
          const sjson = (await readResponseJson(sres)) as any;
          if (sres.ok) {
            const pipelineStatus = (sjson?.pipeline_status as string | undefined) ?? "";
            const currentStep = (sjson?.current_step as string | undefined) ?? "";
            if (pipelineStatus) setKbPipelineStatus(pipelineStatus);
            if (currentStep === "prepare") setKbStep("prepare");
            else if (currentStep === "upload") setKbStep("upload");
            else if (pipelineStatus === "succeeded") setKbStep("done");
            else if (pipelineStatus === "failed" || pipelineStatus === "aborted") setKbStep("error");

            const urls = scrapedUrlsFromStatus(sjson);
            if (urls.length) setKbUrls(urls);
          }
        } catch {
          // ignore; polling will retry
        }
      }
    } finally {
      if (kbStartSeqRef.current === startSeq) {
        setKbStarting(false);
      }
      kbStartInFlightRef.current = false;
    }
  }

  const hasLiveNamespace = useMemo(
    () => Boolean(siteLivePineconeNs && siteLivePineconeNs.trim()),
    [siteLivePineconeNs],
  );

  /** Local run state can show success before RSC refreshes `site.livePineconeNs` from the callback. */
  const runLooksComplete = useMemo(
    () => {
      const status = kbPipelineStatus.trim().toLowerCase();
      if (status === "failed" || status === "aborted") return false;
      return kbStep === "done" || status === "succeeded";
    },
    [kbStep, kbPipelineStatus],
  );
  const runLooksFailed = useMemo(() => {
    const status = kbPipelineStatus.trim().toLowerCase();
    return kbStep === "error" || status === "failed" || status === "aborted";
  }, [kbPipelineStatus, kbStep]);

  const showScrapedUrlsPanel = useMemo(() => {
    if (kbUrls.length === 0) return false;
    const scrapePhaseDone =
      kbStep === "prepare" ||
      kbStep === "upload" ||
      kbStep === "done" ||
      (kbStep === "error" && kbErrorPhase !== "scrape");
    return scrapePhaseDone;
  }, [kbUrls.length, kbStep, kbErrorPhase]);

  const sourceGroupSummary = useMemo(
    () => parseSourceGroupSummaries(form.scrapeSourceGroupsJson),
    [form.scrapeSourceGroupsJson],
  );
  const sourceGroupRecords = useMemo(
    () => parseSourceGroupRecords(form.scrapeSourceGroupsJson),
    [form.scrapeSourceGroupsJson],
  );
  const enabledSourceGroups = useMemo(
    () => sourceGroupSummary.groups.filter((group) => group.enabled),
    [sourceGroupSummary.groups],
  );
  const scheduledSourceGroups = useMemo(
    () => enabledSourceGroups.filter((group) => group.live),
    [enabledSourceGroups],
  );
  const coreSourceGroups = useMemo(
    () => enabledSourceGroups.filter((group) => !group.live),
    [enabledSourceGroups],
  );
  useEffect(() => {
    if (runScope === "live" && scheduledSourceGroups.length === 0) setRunScope("all");
    if (runScope === "core" && coreSourceGroups.length === 0) setRunScope("all");
  }, [coreSourceGroups.length, runScope, scheduledSourceGroups.length]);
  const seedCount = useMemo(() => countLineItems(form.scrapeSeedUrls), [form.scrapeSeedUrls]);
  const prefixCount = useMemo(
    () => countLineItems(form.scrapeAllowedPrefixes),
    [form.scrapeAllowedPrefixes],
  );
  const totalGroupSeeds = useMemo(
    () => enabledSourceGroups.reduce((sum, group) => sum + group.seeds, 0),
    [enabledSourceGroups],
  );
  const groupPageBudget = useMemo(
    () =>
      enabledSourceGroups.reduce(
        (sum, group) => sum + (typeof group.maxPages === "number" ? group.maxPages : 0),
        0,
      ),
    [enabledSourceGroups],
  );
  const maxGroupDepth = useMemo(
    () =>
      enabledSourceGroups.reduce(
        (max, group) =>
          typeof group.maxDepth === "number" && group.maxDepth > max ? group.maxDepth : max,
        0,
      ),
    [enabledSourceGroups],
  );
  const scopedRunGroups = useMemo(() => {
    if (runScope === "live") return scheduledSourceGroups;
    if (runScope === "core") return coreSourceGroups;
    return enabledSourceGroups;
  }, [coreSourceGroups, enabledSourceGroups, runScope, scheduledSourceGroups]);
  const scopedRunPageBudget = useMemo(
    () =>
      scopedRunGroups.reduce(
        (sum, group) => sum + (typeof group.maxPages === "number" ? group.maxPages : 0),
        0,
      ),
    [scopedRunGroups],
  );
  const scopedRunSeedCount = useMemo(
    () => scopedRunGroups.reduce((sum, group) => sum + group.seeds, 0),
    [scopedRunGroups],
  );
  const runScopeLabel =
    runScope === "live" ? "Live pages" : runScope === "core" ? "Core knowledge" : "All knowledge";
  const effectiveRunScopeLabel = enabledSourceGroups.length ? runScopeLabel : "Knowledge";
  const effectiveRunSeedCount = enabledSourceGroups.length ? scopedRunSeedCount : seedCount;
  const effectiveRunPageCap =
    scopedRunPageBudget > 0 ? `${scopedRunPageBudget} pages` : labelForCoverage(form.scrapeCoverage);
  const effectiveRunDepth =
    enabledSourceGroups.length && scopedRunGroups.some((group) => typeof group.maxDepth === "number")
      ? `Depth up to ${scopedRunGroups.reduce(
          (max, group) =>
            typeof group.maxDepth === "number" && group.maxDepth > max ? group.maxDepth : max,
          0,
        )}`
      : `Depth ${form.scrapeMaxDepth || "0"}`;
  const effectiveRunReader =
    form.scrapeProvider === "cloudflare"
      ? `${labelForRenderMode(form.scrapeCloudflareRenderMode)} · ${labelForDiscoveryMode(
          form.scrapeCloudflareDiscoveryMode,
        )}`
      : "Firecrawl fallback";
  const sourceRunScopeCards = useMemo(() => {
    const detailsFor = (groups: SourceGroupSummary[]) => {
      const pageBudget = groups.reduce(
        (sum, group) => sum + (typeof group.maxPages === "number" ? group.maxPages : 0),
        0,
      );
      const seedTotal = groups.reduce((sum, group) => sum + group.seeds, 0);
      const depth = groups.reduce(
        (max, group) =>
          typeof group.maxDepth === "number" && group.maxDepth > max ? group.maxDepth : max,
        0,
      );
      const liveCount = groups.filter((group) => group.live).length;
      const browserCount = groups.filter((group) => group.renderMode === "browser").length;
      const autoCount = groups.filter((group) => group.renderMode === "auto").length;
      const staticCount = groups.filter((group) => group.renderMode === "static").length;
      const reader =
        browserCount > 0
          ? "Browser-heavy"
          : autoCount > 0
            ? "Auto rendering"
            : staticCount > 0
              ? "Static fetch"
              : "Default reader";

      return {
        groupTotal: groups.length,
        seedTotal,
        pageBudget,
        depth,
        liveCount,
        reader,
      };
    };

    return [
      {
        scope: "all" as const,
        label: "All knowledge",
        helper: "Rebuild every enabled group.",
        disabled: enabledSourceGroups.length === 0,
        ...detailsFor(enabledSourceGroups),
      },
      {
        scope: "core" as const,
        label: "Core knowledge",
        helper: "Stable docs and website groups.",
        disabled: coreSourceGroups.length === 0,
        ...detailsFor(coreSourceGroups),
      },
      {
        scope: "live" as const,
        label: "Live pages",
        helper: "Scheduled race and event pages.",
        disabled: scheduledSourceGroups.length === 0,
        ...detailsFor(scheduledSourceGroups),
      },
    ];
  }, [coreSourceGroups, enabledSourceGroups, scheduledSourceGroups]);
  const sourceGroupDraftStats = (draft: SourceGroupDraft) => {
    const seedUrls = lines(draft.seedUrls).map(normalizeSourceUrl);
    const explicitScopes = lines(draft.allowedPrefixes).map(normalizeSourceUrl);
    const allowedScopes = explicitScopes.length
      ? explicitScopes
      : Array.from(new Set(seedUrls.map(scopeFromUrl)));
    const invalidUrls = [...seedUrls, ...explicitScopes].filter((url) => !isHttpSourceUrl(url));
    return {
      seedUrls,
      explicitScopes,
      allowedScopes,
      invalidUrls,
      maxDepth: parseNonNegativeInt(draft.maxDepth),
      maxPages: parseNonNegativeInt(draft.maxPages),
      refreshMinutes: parseNonNegativeInt(draft.refreshMinutes),
    };
  };
  const newGroupStats = useMemo(
    () => sourceGroupDraftStats(newSourceGroup),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [newSourceGroup, normalizeSourceUrl],
  );
  const editingGroupStats = useMemo(
    () => sourceGroupDraftStats(editingSourceGroup),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editingSourceGroup, normalizeSourceUrl],
  );
  const selectedSourceGroupTemplate = templateForSourceGroupKind(newSourceGroup.kind);
  const selectedEditingSourceGroupTemplate = templateForSourceGroupKind(editingSourceGroup.kind);
  const canAddSourceGroup =
    Boolean(newSourceGroup.label.trim()) &&
    newGroupStats.seedUrls.length > 0 &&
    newGroupStats.invalidUrls.length === 0 &&
    !sourceGroupRecords.error;
  const canSaveSourceGroupEdit =
    editingSourceGroupIndex !== null &&
    Boolean(editingSourceGroup.label.trim()) &&
    editingGroupStats.seedUrls.length > 0 &&
    editingGroupStats.invalidUrls.length === 0 &&
    !sourceGroupRecords.error;
  const selectedRunScopeCard =
    sourceRunScopeCards.find((card) => card.scope === runScope) ?? sourceRunScopeCards[0];
  const sourceSetupWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (sourceGroupSummary.error) {
      warnings.push("Fix the knowledge group JSON before starting a run.");
    }
    if (enabledSourceGroups.length > 0) {
      const emptyEnabledGroups = enabledSourceGroups.filter((group) => group.seeds === 0);
      if (emptyEnabledGroups.length > 0) {
        warnings.push(
          `${countLabel(emptyEnabledGroups.length, "enabled group", "enabled groups")} need at least one start page.`,
        );
      }
    } else if (seedCount === 0) {
      warnings.push("Add at least one start page before reading pages.");
    }
    if (enabledSourceGroups.length === 0 && seedCount > 0 && prefixCount === 0) {
      warnings.push("Add allowed link areas so discovered links stay inside trusted pages.");
    }
    return warnings;
  }, [enabledSourceGroups, prefixCount, seedCount, sourceGroupSummary.error]);
  const sourceRunBlockedReason = sourceGroupSummary.error
    ? "Fix knowledge group JSON before reading pages."
    : effectiveRunSeedCount === 0
      ? "Add at least one start page before reading pages."
      : "";

  useEffect(() => {
    if (!showScrapedUrlsPanel) setScrapedUrlsOpen(false);
  }, [showScrapedUrlsPanel]);

  function persistSourceGroupRecords(groups: SourceGroupRecord[]) {
    const nextForm = {
      ...form,
      scrapeSourceGroupsJson: groups.length ? stringifySourceGroups(groups) : "",
    };
    setForm(nextForm);
    onPersist(nextForm);
  }

  function updateSourceGroupAt(index: number, patch: SourceGroupRecord) {
    if (sourceGroupRecords.error) return;
    persistSourceGroupRecords(
      sourceGroupRecords.groups.map((group, i) =>
        i === index ? { ...group, ...patch } : group,
      ),
    );
  }

  function removeSourceGroupAt(index: number) {
    if (sourceGroupRecords.error) return;
    persistSourceGroupRecords(sourceGroupRecords.groups.filter((_group, i) => i !== index));
  }

  function duplicateSourceGroupAt(index: number) {
    if (sourceGroupRecords.error) return;
    const group = sourceGroupRecords.groups[index];
    if (!group) return;
    const ids = new Set(
      sourceGroupRecords.groups
        .map((item) => (typeof item.id === "string" ? item.id : ""))
        .filter(Boolean),
    );
    const label =
      typeof group.label === "string" && group.label.trim()
        ? `${group.label.trim()} copy`
        : "Knowledge group copy";
    const copy = {
      ...group,
      id: slugifyGroupId(label, ids),
      label,
      enabled: true,
    };
    persistSourceGroupRecords([
      ...sourceGroupRecords.groups.slice(0, index + 1),
      copy,
      ...sourceGroupRecords.groups.slice(index + 1),
    ]);
  }

  function applySourceGroupTemplate(kind: NewSourceGroupKind) {
    const template = templateForSourceGroupKind(kind);
    setNewSourceGroup((current) => ({
      ...current,
      kind,
      live: template.live,
      maxDepth: template.maxDepth,
      maxPages: template.maxPages,
      refreshMinutes: template.refreshMinutes,
    }));
  }

  function sourceGroupRecordFromDraft(
    draft: SourceGroupDraft,
    current: SourceGroupRecord | null,
    existingIds: Set<string>,
  ): SourceGroupRecord {
    const template = templateForSourceGroupKind(draft.kind);
    const stats = sourceGroupDraftStats(draft);
    const label = draft.label.trim();
    const currentId =
      current && typeof current.id === "string" && current.id.trim() ? current.id.trim() : "";
    const id = currentId || slugifyGroupId(label, existingIds);
    const record: SourceGroupRecord = {
      ...(current ?? {}),
      id,
      label,
      enabled: current?.enabled === false ? false : true,
      live: template.live,
      seed_urls: stats.seedUrls,
      allowed_prefixes: stats.allowedScopes,
      scrape_provider: "cloudflare",
      cloudflare_render_mode: template.renderMode,
      cloudflare_discovery_mode: template.discoveryMode,
      cloudflare_per_seed_limit:
        typeof current?.cloudflare_per_seed_limit === "number"
          ? current.cloudflare_per_seed_limit
          : 100,
    };

    if (stats.maxDepth === null) delete record.max_depth;
    else record.max_depth = stats.maxDepth;

    if (stats.maxPages === null) delete record.max_pages;
    else record.max_pages = stats.maxPages;

    if (template.live && stats.refreshMinutes !== null) {
      record.refresh_interval_minutes = stats.refreshMinutes;
    } else {
      delete record.refresh_interval_minutes;
    }

    return record;
  }

  function addSourceGroup() {
    if (sourceGroupRecords.error) return;
    const label = newSourceGroup.label.trim();
    if (!label || newGroupStats.seedUrls.length === 0 || newGroupStats.invalidUrls.length > 0) return;
    const ids = new Set(
      sourceGroupRecords.groups
        .map((item) => (typeof item.id === "string" ? item.id : ""))
        .filter(Boolean),
    );
    const group = sourceGroupRecordFromDraft(newSourceGroup, null, ids);
    persistSourceGroupRecords([...sourceGroupRecords.groups, group]);
    setNewSourceGroup(EMPTY_NEW_SOURCE_GROUP);
    setNewSourceGroupOpen(false);
  }

  function startEditingSourceGroup(index: number) {
    const group = sourceGroupRecords.groups[index];
    if (!group) return;
    setEditingSourceGroupIndex(index);
    setEditingSourceGroup(draftFromSourceGroupRecord(group));
  }

  function cancelEditingSourceGroup() {
    setEditingSourceGroupIndex(null);
    setEditingSourceGroup(EMPTY_NEW_SOURCE_GROUP);
  }

  function saveSourceGroupEdit() {
    if (sourceGroupRecords.error) return;
    if (editingSourceGroupIndex === null) return;
    const current = sourceGroupRecords.groups[editingSourceGroupIndex];
    if (!current || !canSaveSourceGroupEdit) return;
    const ids = new Set(
      sourceGroupRecords.groups
        .map((item, index) =>
          index === editingSourceGroupIndex ? "" : typeof item.id === "string" ? item.id : "",
        )
        .filter(Boolean),
    );
    const nextGroup = sourceGroupRecordFromDraft(editingSourceGroup, current, ids);
    persistSourceGroupRecords(
      sourceGroupRecords.groups.map((group, index) =>
        index === editingSourceGroupIndex ? nextGroup : group,
      ),
    );
    cancelEditingSourceGroup();
  }

  function openNewSourceGroupEditor() {
    setNewSourceGroupOpen(true);
    window.setTimeout(() => {
      const target = document.getElementById("add-source-group-editor");
      if (!target) return;

      if (window.location.hash !== "#add-source-group-editor") {
        window.location.hash = "add-source-group-editor";
      }

      target.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }, 0);
  }

  return (
    <>
      <div
        id="source-pages-panel"
        className="scroll-mt-6 rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm"
      >
        {(() => {
          const status = kbLoading
            ? { tone: "muted", label: "Loading…" }
            : kbStarting
              ? { tone: "muted", label: "Starting…" }
              : isKbPolling
              ? { tone: "live", label: "Reading in progress" }
                : runLooksFailed
                  ? { tone: "error", label: "Needs attention" }
                  : !hasLiveNamespace
                    ? {
                        tone: "error",
                        label: runLooksComplete ? "Knowledge not attached" : "Needs knowledge",
                      }
                    : runLooksComplete
                      ? { tone: "ok", label: "Ready to answer" }
                      : kbRunId
                        ? { tone: "muted", label: "Last run loaded" }
                        : { tone: "muted", label: "No index yet" };

          const statusCls =
            status.tone === "live"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : status.tone === "ok"
                ? "border-green-200 bg-green-50 text-green-800"
                : status.tone === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-gray-200 bg-gray-50 text-gray-700";

          const primaryLabel = kbStarting
            ? "Starting…"
            : isKbPolling
              ? "Running…"
              : kbStep === "error"
                ? `Retry reading ${effectiveRunScopeLabel.toLowerCase()}`
              : kbRunId
                ? `Read ${effectiveRunScopeLabel.toLowerCase()} again`
                : `Start reading ${effectiveRunScopeLabel.toLowerCase()}`;

          return (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-gray-900">Knowledge sources</p>
                    <div
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${statusCls}`}
                    >
                      {status.tone === "live" ? (
                        <span className="relative inline-flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            status.tone === "ok"
                              ? "bg-green-500"
                              : status.tone === "error"
                                ? "bg-red-500"
                                : "bg-gray-400"
                          }`}
                        />
                      )}
                      <span>{status.label}</span>
                    </div>
                    {/* "Indexed" badge intentionally removed — completion is represented by live namespace on the site. */}
                  </div>
                  <p className="mt-1 mb-5 text-sm text-gray-600">
                    {runLooksFailed
                      ? "The last run did not finish. Review the knowledge sources, then retry when you are ready."
                      : runLooksComplete && hasLiveNamespace
                      ? "Your latest reading run finished and is ready to use. Run again whenever your content changes."
                      : isKbPolling
                        ? "Reading pages, cleaning content, and updating the knowledge index."
                        : runLooksComplete && !hasLiveNamespace
                          ? "The last run finished, but no live knowledge index is attached to this widget. Read pages again to publish searchable answers."
                        : "Choose the pages this assistant can read, then start reading to build searchable knowledge."}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  {enabledSourceGroups.length ? (
                    <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-3 sm:w-[22rem]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase text-gray-500">
                            Selected run
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                            {effectiveRunScopeLabel}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-gray-500">
                            Choose a different run area below.
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                          {countLabel(selectedRunScopeCard.groupTotal, "group", "groups")}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[11px]">
                        {[
                          countLabel(scopedRunSeedCount, "start page", "start pages"),
                          scopedRunPageBudget > 0 ? `${scopedRunPageBudget} page cap` : "Preset cap",
                          effectiveRunDepth,
                        ].map((item) => (
                          <span
                            key={item}
                            className="truncate rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-600"
                          >
                            {item}
                          </span>
                        ))}
                        <span className="col-span-3 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-left font-semibold leading-4 text-gray-600">
                          {effectiveRunReader}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (sourceRunBlockedReason) return;
                        setRunConfirmOpen(true);
                      }}
                      disabled={isKbPolling || kbLoading || kbStarting || Boolean(sourceRunBlockedReason)}
                      aria-haspopup="dialog"
                      aria-controls="source-run-confirm"
                      className="rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-60"
                    >
                      {primaryLabel}
                    </button>
                    {isKbPolling && kbRunId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await fetch("/api/v1/knowledge-base/run/stop", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ siteId, runId: kbRunId }),
                            });
                          } finally {
                            setKbPipelineStatus("aborted");
                            setKbStep("error");
                            setKbErrorPhase("scrape");
                            setKbError("Stop requested.");
                          }
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Stop
                      </button>
                    ) : null}
                  </div>

                  <p className="text-xs text-gray-500">
                    {sourceRunBlockedReason || (kbRunId ? "" : "No runs yet.")}
                  </p>
                </div>
              </div>

              <Dialog.Root open={runConfirmOpen && !isKbPolling} onOpenChange={setRunConfirmOpen}>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 z-50 bg-gray-950/35 backdrop-blur-sm" />
                  <Dialog.Content
                    id="source-run-confirm"
                    className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100vh-3rem)] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-5 text-left shadow-2xl focus:outline-none"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Dialog.Title className="text-base font-semibold text-amber-950">
                          Start reading {effectiveRunScopeLabel.toLowerCase()}?
                        </Dialog.Title>
                        <Dialog.Description className="mt-1 text-sm leading-6 text-amber-900/80">
                          This queues a crawler run, cleans the pages, and writes a new searchable
                          knowledge index when it finishes.
                        </Dialog.Description>
                      </div>
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          aria-label="Close"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white/70 text-amber-900 hover:bg-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </Dialog.Close>
                    </div>
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                      {[
                        {
                          label: "Scope",
                          value: effectiveRunScopeLabel,
                        },
                        {
                          label: "Start pages",
                          value: countLabel(effectiveRunSeedCount, "page", "pages"),
                        },
                        {
                          label: "Page cap",
                          value: effectiveRunPageCap,
                        },
                        {
                          label: "Depth",
                          value: effectiveRunDepth,
                        },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-white/75 px-3 py-2">
                          <dt className="text-[11px] font-semibold uppercase text-amber-800/70">
                            {item.label}
                          </dt>
                          <dd className="mt-0.5 truncate text-sm font-semibold text-amber-950">
                            {item.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-2 rounded-lg bg-white/75 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase text-amber-800/70">
                        Reader
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-amber-950">
                        {effectiveRunReader}
                      </p>
                    </div>
                    <div className="mt-2 rounded-lg border border-amber-200 bg-white/75 px-3 py-2 text-sm leading-6 text-amber-950">
                      <p className="font-semibold">What will happen</p>
                      <p className="mt-0.5 text-amber-900/80">
                        This run will start from{" "}
                        {countLabel(effectiveRunSeedCount, "page", "pages")} and may store up to{" "}
                        {selectedRunScopeCard.pageBudget > 0
                          ? `${selectedRunScopeCard.pageBudget} pages`
                          : effectiveRunPageCap}{" "}
                        before cleaning and indexing.
                        {selectedRunScopeCard.liveCount > 0
                          ? ` It includes ${countLabel(
                              selectedRunScopeCard.liveCount,
                              "scheduled group",
                              "scheduled groups",
                            )}, so refreshed live-page content can replace stale event answers.`
                          : " It only updates manually selected knowledge groups."}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Dialog.Close asChild>
                        <button
                          type="button"
                          className="rounded-lg border border-amber-200 bg-white/80 px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-white"
                        >
                          Cancel
                        </button>
                      </Dialog.Close>
                      <button
                        type="button"
                        onClick={() => void runKbPipeline()}
                        disabled={kbStarting}
                        className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-60"
                      >
                        {kbStarting
                          ? "Starting…"
                          : `Start reading ${effectiveRunScopeLabel.toLowerCase()}`}
                      </button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>

              <div className="border-y border-gray-200 py-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Knowledge area</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {enabledSourceGroups.length
                        ? countLabel(enabledSourceGroups.length, "enabled group", "enabled groups")
                        : countLabel(seedCount, "start page", "start pages")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {enabledSourceGroups.length
                        ? `${countLabel(totalGroupSeeds, "start page", "start pages")} · ${countLabel(
                            enabledSourceGroups.reduce((sum, group) => sum + group.prefixes, 0),
                            "allowed area",
                            "allowed areas",
                          )}${
                            scheduledSourceGroups.length
                              ? ` · ${countLabel(
                                  scheduledSourceGroups.length,
                                  "scheduled group",
                                  "scheduled groups",
                                )}`
                              : ""
                          }`
                        : countLabel(prefixCount, "allowed area", "allowed areas")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      Planned coverage
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {groupPageBudget > 0
                        ? countLabel(groupPageBudget, "page", "pages")
                        : labelForCoverage(form.scrapeCoverage)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {maxGroupDepth > 0
                        ? `Depth up to ${maxGroupDepth}`
                        : `Depth ${form.scrapeMaxDepth || "0"}`}{" "}
                      · {labelForSpeed(form.scrapeSpeed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-gray-500">Page reader</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {form.scrapeProvider === "cloudflare"
                        ? "Cloudflare reader"
                        : "Firecrawl fallback"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {form.scrapeProvider === "cloudflare"
                        ? `${labelForRenderMode(form.scrapeCloudflareRenderMode)} · ${labelForDiscoveryMode(form.scrapeCloudflareDiscoveryMode)}`
                        : "Managed page reader"}
                    </p>
                  </div>
                </div>
              </div>

              {sourceSetupWarnings.length ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-amber-950">
                        Knowledge setup needs attention
                      </p>
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-900/85">
                        {sourceSetupWarnings.map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={openNewSourceGroupEditor}
                      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50"
                    >
                      Add knowledge group
                    </button>
                  </div>
                </div>
              ) : null}

              {enabledSourceGroups.length ? (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Run choices</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Pick one run area, then use the start button above to confirm the run.
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                      Selected: {effectiveRunScopeLabel}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-3">
                    {sourceRunScopeCards.map((card) => {
                      const active = runScope === card.scope;
                      const capLabel =
                        card.pageBudget > 0 ? `${card.pageBudget} pages` : "Preset cap";
                      const depthLabel = card.depth > 0 ? `Depth ${card.depth}` : "Default depth";
                      return (
                        <button
                          key={card.scope}
                          type="button"
                          onClick={() => setRunScope(card.scope)}
                          disabled={card.disabled || isKbPolling || kbStarting}
                          aria-pressed={active}
                          className={cn(
                            "min-h-[9.5rem] rounded-lg border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                            active
                              ? "border-gray-900 bg-white shadow-sm ring-1 ring-gray-900/10"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900">{card.label}</p>
                              <p className="mt-1 text-xs leading-5 text-gray-500">
                                {card.helper}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                active
                                  ? "border-gray-900 bg-gray-900 text-white"
                                  : "border-gray-200 bg-gray-50 text-gray-600",
                              )}
                            >
                              {countLabel(card.groupTotal, "group", "groups")}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
                            {[
                              countLabel(card.seedTotal, "start page", "start pages"),
                              capLabel,
                              depthLabel,
                              card.reader,
                            ].map((item) => (
                              <span
                                key={item}
                                className="truncate rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 font-semibold text-gray-600"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                          {card.liveCount > 0 ? (
                            <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-800">
                              Includes {countLabel(card.liveCount, "scheduled group", "scheduled groups")}
                            </p>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-5 space-y-6">
                <section>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Knowledge plan</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        Create groups for static docs, dynamic pages, and live event pages. Each group gets its own boundaries, depth, page cap, and update cadence.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        data-testid="add-source-group-header"
                        onClick={openNewSourceGroupEditor}
                        className="inline-flex w-fit items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 shadow-sm hover:bg-blue-100"
                      >
                        <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                        Add knowledge group
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 lg:grid-cols-3">
                    {[
                      {
                        title: "1. Start pages",
                        body: "Open these exact pages first. Use docs roots, course portals, event pages, or GitHub docs entry points.",
                      },
                      {
                        title: "2. Allowed link areas",
                        body: "Keep discovered links inside these URL prefixes so crawls do not drift into unrelated pages.",
                      },
                      {
                        title: "3. Update mode",
                        body: "Static docs can stay manual. Live pages can update every day or week on their own schedule.",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2"
                      >
                        <p className="text-xs font-semibold text-blue-950">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-blue-900/80">{item.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-600">Configured groups</span>
                      <span className="text-xs font-medium text-gray-500">
                        {enabledSourceGroups.length} enabled
                        {scheduledSourceGroups.length
                          ? ` · ${scheduledSourceGroups.length} scheduled`
                          : ""}
                      </span>
                    </div>

                    {sourceGroupSummary.error ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                        {sourceGroupSummary.error}
                      </div>
                    ) : sourceGroupSummary.groups.length ? (
                      <div className="grid gap-2">
                        {sourceGroupSummary.groups.map((group, index) => (
                          <div
                            key={`${group.id}-${index}`}
                            className={cn(
                              "min-w-0 rounded-lg border px-3 py-3",
                              group.enabled
                                ? "border-gray-200 bg-white"
                                : "border-gray-200 bg-gray-50/80",
                            )}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p
                                    className={cn(
                                      "break-words text-sm font-semibold",
                                      group.enabled ? "text-gray-900" : "text-gray-500",
                                    )}
                                  >
                                    {group.label}
                                  </p>
                                  {!group.enabled ? (
                                    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                                      Disabled
                                    </span>
                                  ) : null}
                                  {group.live ? (
                                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                      Scheduled update
                                    </span>
                                ) : null}
                              </div>
                              {group.firstSeed ? (
                                <p className="mt-1 break-all font-mono text-xs text-gray-500">
                                    First start page: {compactUrl(group.firstSeed)}
                                </p>
                              ) : null}
                              {group.renderMode || group.discoveryMode ? (
                                <p className="mt-1 text-xs text-gray-500">
                                  Reader:{" "}
                                  {group.renderMode
                                    ? labelForRenderMode(group.renderMode)
                                    : "Default render"}{" "}
                                  ·{" "}
                                  {group.discoveryMode
                                    ? labelForDiscoveryMode(group.discoveryMode)
                                    : "Default discovery"}
                                </p>
                              ) : null}
                            </div>
                              <div className="flex shrink-0 flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSourceGroupAt(index, { enabled: !group.enabled })
                                  }
                                  aria-label={`${group.enabled ? "Disable" : "Enable"} ${group.label} knowledge group`}
                                  className="min-h-8 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  {group.enabled ? "Disable" : "Enable"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => startEditingSourceGroup(index)}
                                  aria-label={`Edit ${group.label} knowledge group`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => duplicateSourceGroupAt(index)}
                                  aria-label={`Duplicate ${group.label} knowledge group`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                >
                                  <Copy className="h-3.5 w-3.5" aria-hidden />
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSourceGroupAt(index)}
                                  aria-label={`Remove ${group.label} knowledge group`}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  Remove
                                </button>
                              </div>
                            </div>
                            <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                              {[
                                {
                                  label: "Start pages",
                                  value: countLabel(group.seeds, "page", "pages"),
                                },
                                {
                                  label: "Allowed link areas",
                                  value: countLabel(group.prefixes, "area", "areas"),
                                },
                                {
                                  label: "Page cap",
                                  value:
                                    group.maxPages !== null
                                      ? `${group.maxPages} pages`
                                      : "Uses global setting",
                                },
                                {
                                  label: "Depth",
                                  value:
                                    group.maxDepth !== null
                                      ? `Up to ${group.maxDepth}`
                                      : "Uses global setting",
                                },
                                {
                                  label: "Update mode",
                                  value: sourceGroupUpdateLabel(group),
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
                                >
                                  <dt className="text-[11px] font-semibold uppercase text-gray-500">
                                    {item.label}
                                  </dt>
                                  <dd className="mt-0.5 text-sm font-semibold text-gray-900">
                                    {item.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                            <details className="group mt-3 rounded-lg border border-gray-200 bg-gray-50">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-semibold text-gray-700 marker:hidden hover:bg-gray-100">
                                <span className="min-w-0 truncate">
                                  View start pages and allowed link areas
                                </span>
                                <ChevronDown
                                  className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
                                  aria-hidden
                                />
                              </summary>
                              <div className="border-t border-gray-200 p-3">
                                <div className="grid gap-3 xl:grid-cols-2">
                                  <SourceGroupUrlList
                                    title="Start pages"
                                    urls={group.seedUrls}
                                    link
                                  />
                                  <SourceGroupUrlList
                                    title="Allowed link areas"
                                    urls={group.allowedPrefixes}
                                  />
                                </div>
                              </div>
                            </details>
                            {editingSourceGroupIndex === index ? (
                              <div className="mt-3 rounded-lg border border-gray-300 bg-white p-3 shadow-sm">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">
                                      Edit knowledge group
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      Update the link boundary for this group without opening raw JSON.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={cancelEditingSourceGroup}
                                    className="w-fit rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>

                                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                  <Field label="Group name" className="xl:col-span-2">
                                    <input
                                      value={editingSourceGroup.label}
                                      onChange={(e) =>
                                        setEditingSourceGroup({
                                          ...editingSourceGroup,
                                          label: e.target.value,
                                        })
                                      }
                                      className={inputCls}
                                      placeholder="Docs, events, course pages..."
                                    />
                                  </Field>

                                  <div className="xl:col-span-2">
                                    <p className="mb-1 text-sm font-medium text-gray-700">
                                      Group type
                                    </p>
                                    <div className="grid gap-2 lg:grid-cols-3">
                                      {SOURCE_GROUP_TEMPLATES.map((template) => {
                                        const Icon = template.Icon;
                                        const active = editingSourceGroup.kind === template.kind;
                                        return (
                                          <button
                                            key={template.kind}
                                            type="button"
                                            onClick={() =>
                                              setEditingSourceGroup((current) => ({
                                                ...current,
                                                kind: template.kind,
                                                live: template.live,
                                                maxDepth: template.maxDepth,
                                                maxPages: template.maxPages,
                                                refreshMinutes: template.refreshMinutes,
                                              }))
                                            }
                                            className={cn(
                                              "min-h-[5.75rem] rounded-lg border px-3 py-2.5 text-left transition-colors",
                                              active
                                                ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                                : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white",
                                            )}
                                            aria-pressed={active}
                                          >
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                              <Icon
                                                className={cn(
                                                  "h-4 w-4",
                                                  active ? "text-white" : "text-gray-500",
                                                )}
                                                aria-hidden
                                              />
                                              {template.label}
                                            </span>
                                            <span
                                              className={cn(
                                                "mt-1.5 block text-xs leading-5",
                                                active ? "text-white/80" : "text-gray-500",
                                              )}
                                            >
                                              {template.body}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <Field
                                    label="Start pages"
                                    hint="One per line. The run starts here and follows allowed links."
                                  >
                                    <textarea
                                      value={editingSourceGroup.seedUrls}
                                      onChange={(e) =>
                                        setEditingSourceGroup({
                                          ...editingSourceGroup,
                                          seedUrls: e.target.value,
                                        })
                                      }
                                      rows={7}
                                      className={cn(
                                        inputCls,
                                        "min-h-[10rem] resize-y font-mono text-xs leading-5",
                                      )}
                                      placeholder="https://example.com/docs/"
                                    />
                                  </Field>
                                  <Field
                                    label="Allowed link areas"
                                    hint="Optional. Leave empty to use each start page's domain root."
                                  >
                                    <textarea
                                      value={editingSourceGroup.allowedPrefixes}
                                      onChange={(e) =>
                                        setEditingSourceGroup({
                                          ...editingSourceGroup,
                                          allowedPrefixes: e.target.value,
                                        })
                                      }
                                      rows={7}
                                      className={cn(
                                        inputCls,
                                        "min-h-[10rem] resize-y font-mono text-xs leading-5",
                                      )}
                                      placeholder="https://example.com/docs/"
                                    />
                                  </Field>
                                </div>

                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                  <Field
                                    label="Link depth"
                                    hint="0 only reads the start pages. Higher values follow links farther away."
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      value={editingSourceGroup.maxDepth}
                                      onChange={(e) =>
                                        setEditingSourceGroup({
                                          ...editingSourceGroup,
                                          maxDepth: e.target.value,
                                        })
                                      }
                                      className={inputCls}
                                    />
                                  </Field>
                                  <Field
                                    label="Max pages"
                                    hint="Hard limit for this group before indexing starts."
                                  >
                                    <input
                                      type="number"
                                      min="0"
                                      value={editingSourceGroup.maxPages}
                                      onChange={(e) =>
                                        setEditingSourceGroup({
                                          ...editingSourceGroup,
                                          maxPages: e.target.value,
                                        })
                                      }
                                      className={inputCls}
                                    />
                                  </Field>
                                  {selectedEditingSourceGroupTemplate.live ? (
                                    <Field
                                      label="Update cadence"
                                      hint="Minutes between scheduled updates. 1440 is daily, 10080 is weekly."
                                    >
                                      <input
                                        type="number"
                                        min="0"
                                        value={editingSourceGroup.refreshMinutes}
                                        onChange={(e) =>
                                          setEditingSourceGroup({
                                            ...editingSourceGroup,
                                            refreshMinutes: e.target.value,
                                          })
                                        }
                                        className={inputCls}
                                        placeholder="1440"
                                      />
                                    </Field>
                                  ) : (
                                    <Field
                                      label="Update mode"
                                      hint="Static and dynamic groups update only when you start reading."
                                    >
                                      <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                                        Manual run
                                      </div>
                                    </Field>
                                  )}
                                </div>

                                {editingGroupStats.invalidUrls.length ? (
                                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                    Use public http or https URLs. Check{" "}
                                    <span className="break-all font-mono">
                                      {compactUrl(editingGroupStats.invalidUrls[0] ?? "")}
                                    </span>
                                    {editingGroupStats.invalidUrls.length > 1
                                      ? ` and ${editingGroupStats.invalidUrls.length - 1} more.`
                                      : "."}
                                  </div>
                                ) : null}

                                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                                  <p className="text-xs font-semibold uppercase text-gray-500">
                                    Edit preview
                                  </p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                    {[
                                      {
                                        label: "Start pages",
                                        value: countLabel(editingGroupStats.seedUrls.length, "page", "pages"),
                                      },
                                      {
                                        label: "Allowed link areas",
                                        value: countLabel(
                                          editingGroupStats.allowedScopes.length,
                                          "area",
                                          "areas",
                                        ),
                                      },
                                      {
                                        label: "Page cap",
                                        value:
                                          editingGroupStats.maxPages === null
                                            ? "Global default"
                                            : `${editingGroupStats.maxPages} pages`,
                                      },
                                      {
                                        label: "Mode",
                                        value: selectedEditingSourceGroupTemplate.live
                                          ? editingGroupStats.refreshMinutes === null
                                            ? "Scheduled"
                                            : formatRefreshInterval(editingGroupStats.refreshMinutes)
                                          : "Manual run",
                                      },
                                      {
                                        label: "Reader",
                                        value: labelForRenderMode(
                                          selectedEditingSourceGroupTemplate.renderMode,
                                        ),
                                      },
                                    ].map((item) => (
                                      <div
                                        key={item.label}
                                        className="rounded-lg border border-gray-200 bg-white px-2 py-2"
                                      >
                                        <p className="text-[11px] font-semibold text-gray-500">
                                          {item.label}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs font-semibold text-gray-900">
                                          {item.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="text-xs text-gray-500">
                                    Saving updates the source plan immediately.
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={cancelEditingSourceGroup}
                                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={saveSourceGroupEdit}
                                      disabled={!canSaveSourceGroupEdit}
                                      className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                                    >
                                      Save group
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        No knowledge groups configured.
                      </p>
                    )}

                    <Collapsible
                      open={fallbackUrlsOpen || enabledSourceGroups.length === 0}
                      onOpenChange={setFallbackUrlsOpen}
                      className="mt-3"
                    >
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100">
                        {enabledSourceGroups.length ? "Fallback page list" : "Simple page list"}
                        <span className="ml-auto mr-2 font-medium text-gray-500">
                          {seedCount} start {seedCount === 1 ? "page" : "pages"} · {prefixCount}{" "}
                          {prefixCount === 1 ? "allowed area" : "allowed areas"}
                        </span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            (fallbackUrlsOpen || enabledSourceGroups.length === 0) && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3 data-[state=closed]:hidden">
                        {enabledSourceGroups.length > 0 ? (
                          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                            Knowledge groups are active, so these lists are only a compatibility fallback.
                          </p>
                        ) : (
                          <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">
                            Use this simple list when one website or docs area is enough. Add knowledge groups when different sections need different depth, page caps, or schedules.
                          </p>
                        )}
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div>
                            <ConfigHintLabel
                              htmlFor="scrape-seed-url-entry"
                              hint="First pages opened by the run. The page reader follows links from these pages when the selected discovery mode allows it."
                            >
                              Start pages
                            </ConfigHintLabel>
                            <UrlListInput
                              inputId="scrape-seed-url-entry"
                              value={form.scrapeSeedUrls}
                              placeholder="https://example.com/docs"
                              normalize={normalizeSourceUrl}
                              onChange={(next) => setForm({ ...form, scrapeSeedUrls: next })}
                              onPersist={onPersist}
                            />
                          </div>
                          <div>
                            <ConfigHintLabel
                              htmlFor="scrape-allowed-scope-entry"
                              align="right"
                              hint="Only pages under these URL prefixes are kept. Use site roots for broad coverage and docs folders for narrower coverage."
                            >
                              Allowed link areas
                            </ConfigHintLabel>
                            <UrlListInput
                              inputId="scrape-allowed-scope-entry"
                              value={form.scrapeAllowedPrefixes}
                              placeholder="https://example.com/docs/"
                              normalize={normalizeSourceUrl}
                              onChange={(next) =>
                                setForm({ ...form, scrapeAllowedPrefixes: next })
                              }
                              onPersist={onPersist}
                            />
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      id="add-source-group-editor"
                      open={newSourceGroupOpen}
                      onOpenChange={setNewSourceGroupOpen}
                      className="mt-3"
                    >
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100">
                        Add knowledge group
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            newSourceGroupOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-3 data-[state=closed]:hidden">
                        <div className="rounded-lg border border-gray-200 bg-white p-3">
                          <div className="grid gap-3 lg:grid-cols-2">
                            <Field
                              label="Group name"
                              hint="Example: Help center articles"
                              className="lg:col-span-2"
                            >
                              <input
                                value={newSourceGroup.label}
                                onChange={(e) =>
                                  setNewSourceGroup({
                                    ...newSourceGroup,
                                    label: e.target.value,
                                  })
                                }
                                className={inputCls}
                                placeholder="Docs, events, course pages..."
                              />
                            </Field>
                            <div className="lg:col-span-2">
                              <p className="mb-1 text-sm font-medium text-gray-700">
                                Group type
                              </p>
                              <div className="grid gap-2 lg:grid-cols-3">
                                {SOURCE_GROUP_TEMPLATES.map((template) => {
                                  const Icon = template.Icon;
                                  const active = newSourceGroup.kind === template.kind;
                                  return (
                                    <button
                                      key={template.kind}
                                      type="button"
                                      onClick={() => applySourceGroupTemplate(template.kind)}
                                      className={cn(
                                        "min-h-[7rem] rounded-lg border px-3 py-3 text-left transition-colors",
                                        active
                                          ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                                          : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-white",
                                      )}
                                      aria-pressed={active}
                                    >
                                      <span className="flex items-center gap-2 text-sm font-semibold">
                                        <Icon
                                          className={cn(
                                            "h-4 w-4",
                                            active ? "text-white" : "text-gray-500",
                                          )}
                                          aria-hidden
                                        />
                                        {template.label}
                                      </span>
                                      <span
                                        className={cn(
                                          "mt-2 block text-xs leading-5",
                                          active ? "text-white/80" : "text-gray-500",
                                        )}
                                      >
                                        {template.body}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <Field
                              label="Start pages"
                              hint="One per line. The run starts here and follows allowed links."
                              className="lg:col-span-2"
                            >
                              <textarea
                                value={newSourceGroup.seedUrls}
                                onChange={(e) =>
                                  setNewSourceGroup({
                                    ...newSourceGroup,
                                    seedUrls: e.target.value,
                                  })
                                }
                                rows={6}
                                className={cn(inputCls, "min-h-[9rem] resize-y font-mono text-xs leading-5")}
                                placeholder="https://example.com/docs/"
                              />
                            </Field>
                            <Field
                              label="Allowed link areas"
                              hint="Optional. Leave empty to use each start page's domain root."
                              className="lg:col-span-2"
                            >
                              <textarea
                                value={newSourceGroup.allowedPrefixes}
                                onChange={(e) =>
                                  setNewSourceGroup({
                                    ...newSourceGroup,
                                    allowedPrefixes: e.target.value,
                                  })
                                }
                                rows={5}
                                className={cn(inputCls, "min-h-[8rem] resize-y font-mono text-xs leading-5")}
                                placeholder="https://example.com/docs/"
                              />
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
                              <Field
                                label="Link depth"
                                hint="0 only reads the start pages. Higher values follow links farther away."
                              >
                                <input
                                  type="number"
                                  min="0"
                                  value={newSourceGroup.maxDepth}
                                  onChange={(e) =>
                                    setNewSourceGroup({
                                      ...newSourceGroup,
                                      maxDepth: e.target.value,
                                    })
                                  }
                                  className={inputCls}
                                />
                              </Field>
                              <Field
                                label="Max pages"
                                hint="Hard limit for this group before indexing starts."
                              >
                                <input
                                  type="number"
                                  min="0"
                                  value={newSourceGroup.maxPages}
                                  onChange={(e) =>
                                    setNewSourceGroup({
                                      ...newSourceGroup,
                                      maxPages: e.target.value,
                                    })
                                  }
                                  className={inputCls}
                                />
                              </Field>
                              {selectedSourceGroupTemplate.live ? (
                                <Field
                                  label="Update cadence"
                                  hint="Minutes between scheduled updates. 1440 is daily, 10080 is weekly."
                                >
                                  <input
                                    type="number"
                                    min="0"
                                    value={newSourceGroup.refreshMinutes}
                                    onChange={(e) =>
                                      setNewSourceGroup({
                                        ...newSourceGroup,
                                        refreshMinutes: e.target.value,
                                      })
                                    }
                                    className={inputCls}
                                    placeholder="10080"
                                  />
                                </Field>
                              ) : (
                                <Field
                                  label="Update mode"
                                  hint="Static and dynamic groups update only when you start reading."
                                >
                                  <div className="flex h-10 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-semibold text-gray-700">
                                    Manual run
                                  </div>
                                </Field>
                              )}
                            </div>
                            {newGroupStats.invalidUrls.length ? (
                              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 lg:col-span-2">
                                Use public http or https URLs. Check{" "}
                                <span className="break-all font-mono">
                                  {compactUrl(newGroupStats.invalidUrls[0] ?? "")}
                                </span>
                                {newGroupStats.invalidUrls.length > 1
                                  ? ` and ${newGroupStats.invalidUrls.length - 1} more.`
                                  : "."}
                              </div>
                            ) : null}
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 lg:col-span-2">
                              <p className="text-xs font-semibold uppercase text-gray-500">
                                Group preview
                              </p>
                              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                {[
                                  {
                                    label: "Start pages",
                                    value: countLabel(newGroupStats.seedUrls.length, "page", "pages"),
                                  },
                                  {
                                    label: "Allowed link areas",
                                    value: countLabel(
                                      newGroupStats.allowedScopes.length,
                                      "area",
                                      "areas",
                                    ),
                                  },
                                  {
                                    label: "Page cap",
                                    value:
                                      newGroupStats.maxPages === null
                                        ? "Global default"
                                        : `${newGroupStats.maxPages} pages`,
                                  },
                                  {
                                    label: "Mode",
                                    value: selectedSourceGroupTemplate.live
                                      ? newGroupStats.refreshMinutes === null
                                        ? "Scheduled"
                                        : formatRefreshInterval(newGroupStats.refreshMinutes)
                                      : "Manual run",
                                  },
                                  {
                                    label: "Reader",
                                    value: labelForRenderMode(selectedSourceGroupTemplate.renderMode),
                                  },
                                ].map((item) => (
                                  <div
                                    key={item.label}
                                    className="rounded-lg border border-gray-200 bg-white px-2 py-2"
                                  >
                                    <p className="text-[11px] font-semibold text-gray-500">
                                      {item.label}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-900">
                                      {item.value}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-gray-500">
                              Live page groups update automatically. Static and dynamic groups
                              update when you start reading.
                            </p>
                            <button
                              type="button"
                              onClick={addSourceGroup}
                              disabled={!canAddSourceGroup}
                              className="inline-flex w-fit items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                            >
                              <PlusCircle className="h-3.5 w-3.5" />
                              Add group
                            </button>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={sourceGroupsEditorOpen}
                      onOpenChange={setSourceGroupsEditorOpen}
                      className="mt-3"
                    >
                      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100">
                        Advanced knowledge group JSON
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            sourceGroupsEditorOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2 data-[state=closed]:hidden">
                        <textarea
                          aria-label="Advanced knowledge group JSON"
                          value={form.scrapeSourceGroupsJson}
                          onChange={(e) =>
                            setForm({ ...form, scrapeSourceGroupsJson: e.target.value })
                          }
                          onBlur={() => onPersist()}
                          rows={18}
                          placeholder='[{"id":"live-events","seed_urls":["https://example.com/"],"allowed_prefixes":["https://example.com/"],"max_depth":3,"refresh_interval_minutes":1440}]'
                          className={cn(inputCls, "min-h-[22rem] resize-y font-mono text-xs leading-5")}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                </section>

                <section className="border-t border-gray-200 pt-5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Reading settings</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      Choose the reader, rendering strategy, page budget, speed, and defaults for groups that do not set their own limits.
                    </p>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <Field label="Page reader">
                      <select
                        value={form.scrapeProvider}
                        onChange={(e) => setForm({ ...form, scrapeProvider: e.target.value })}
                        onBlur={() => onPersist()}
                        className={inputCls}
                      >
                        <option value="cloudflare">Cloudflare reader (static + browser)</option>
                        <option value="firecrawl">Firecrawl fallback (legacy)</option>
                      </select>
                    </Field>
                    <Field label="Render mode">
                      <select
                        value={form.scrapeCloudflareRenderMode}
                        onChange={(e) =>
                          setForm({ ...form, scrapeCloudflareRenderMode: e.target.value })
                        }
                        onBlur={() => onPersist()}
                        disabled={form.scrapeProvider !== "cloudflare"}
                        className={inputCls}
                      >
                        <option value="auto">Auto: static first, browser if needed</option>
                        <option value="static">Static HTML only</option>
                        <option value="browser">Always render browser</option>
                      </select>
                    </Field>
                    <Field label="Link discovery">
                      <select
                        value={form.scrapeCloudflareDiscoveryMode}
                        onChange={(e) =>
                          setForm({ ...form, scrapeCloudflareDiscoveryMode: e.target.value })
                        }
                        onBlur={() => onPersist()}
                        disabled={form.scrapeProvider !== "cloudflare"}
                        className={inputCls}
                      >
                        <option value="crawl">Crawl discovered links</option>
                        <option value="static">Only links in fetched HTML</option>
                      </select>
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-4">
                    <Field label="Coverage preset">
                      <select
                        value={form.scrapeCoverage}
                        onChange={(e) => setForm({ ...form, scrapeCoverage: e.target.value })}
                        onBlur={() => onPersist()}
                        className={inputCls}
                      >
                        <option value="basic">Basic (10 pages)</option>
                        <option value="wide" disabled={plan === "FREE"}>
                          {plan === "FREE" ? "Wide (50 pages) - Pro/Max" : "Wide (50 pages)"}
                        </option>
                        <option value="thorough" disabled={plan !== "MAX"}>
                          {plan === "MAX" ? "Thorough (1000 pages)" : "Thorough (1000 pages) - Max"}
                        </option>
                      </select>
                    </Field>
                    <Field label="Speed">
                      <select
                        value={form.scrapeSpeed}
                        onChange={(e) => setForm({ ...form, scrapeSpeed: e.target.value })}
                        onBlur={() => onPersist()}
                        className={inputCls}
                      >
                        <option value="quick">Quick (3 workers)</option>
                        <option value="speedy" disabled={plan === "FREE"}>
                          {plan === "FREE" ? "Speedy (7 workers) - Pro/Max" : "Speedy (7 workers)"}
                        </option>
                        <option value="fastest" disabled={plan !== "MAX"}>
                          {plan === "MAX" ? "Fastest (10 workers)" : "Fastest (10 workers) - Max"}
                        </option>
                      </select>
                    </Field>
                    <Field
                      label="Default depth"
                      hint="Used when a knowledge group does not define its own link depth."
                    >
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={1}
                        value={form.scrapeMaxDepth}
                        onChange={(e) => setForm({ ...form, scrapeMaxDepth: e.target.value })}
                        onBlur={() => onPersist()}
                        className={inputCls}
                      />
                    </Field>
                    <Field
                      label="Default per-start cap"
                      hint="Cloudflare-only fallback limit for each start page."
                    >
                      <input
                        type="number"
                        min={1}
                        value={form.scrapeCloudflarePerSeedLimit}
                        onChange={(e) =>
                          setForm({ ...form, scrapeCloudflarePerSeedLimit: e.target.value })
                        }
                        onBlur={() => onPersist()}
                        disabled={form.scrapeProvider !== "cloudflare"}
                        placeholder="No limit"
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-3">
                    <label
                      htmlFor="scrape-skip-map"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700"
                    >
                      <input
                        id="scrape-skip-map"
                        type="checkbox"
                        checked={form.scrapeSkipMap}
                        onChange={(e) => setForm({ ...form, scrapeSkipMap: e.target.checked })}
                        onBlur={() => onPersist()}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900"
                      />
                      <span>Skip sitemap</span>
                    </label>
                    <label
                      htmlFor="scrape-finetune"
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700"
                    >
                      <input
                        id="scrape-finetune"
                        type="checkbox"
                        checked={form.scrapeFinetune}
                        onChange={(e) => setForm({ ...form, scrapeFinetune: e.target.checked })}
                        onBlur={() => onPersist()}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900"
                      />
                      <span>Clean with AI</span>
                    </label>
                  </div>
                </section>

                <Collapsible
                  open={advancedConfigOpen}
                  onOpenChange={setAdvancedConfigOpen}
                  className="border-t border-gray-200 pt-5"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-semibold text-gray-800 hover:bg-gray-100">
                    Advanced URL filters
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        advancedConfigOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 data-[state=closed]:hidden">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <Field label="Include URL patterns">
                        <textarea
                          value={form.scrapeUrlWhitelistPatterns}
                          onChange={(e) =>
                            setForm({ ...form, scrapeUrlWhitelistPatterns: e.target.value })
                          }
                          onBlur={() => onPersist()}
                          placeholder="example\\.com/(docs|help|pricing)"
                          className={`${inputCls} min-h-[12rem] resize-y font-mono text-xs leading-5`}
                        />
                      </Field>
                      <Field label="Exclude URL patterns">
                        <textarea
                          value={form.scrapeUrlBlacklistPatterns}
                          onChange={(e) =>
                            setForm({ ...form, scrapeUrlBlacklistPatterns: e.target.value })
                          }
                          onBlur={() => onPersist()}
                          placeholder="\\.(png|jpg|svg)$"
                          className={`${inputCls} min-h-[12rem] resize-y font-mono text-xs leading-5`}
                        />
                      </Field>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>

              <div className="mt-5 border-t border-gray-200 pt-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Reading status</h3>
                    <p className="mt-1 text-xs text-gray-500">
                      The run reads pages, cleans the text, then writes the searchable index.
                    </p>
                  </div>
                  {kbPipelineStatus ? (
                    <span className="w-fit rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                      {kbPipelineStatus.replace(/_/g, " ")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ProgressStep
                    label="Reading"
                    state={
                      kbStep === "error" && kbErrorPhase === "scrape"
                        ? "failed"
                        : kbStep === "scrape"
                          ? "in_progress"
                          : kbStep === "prepare" || kbStep === "upload" || kbStep === "done"
                            ? "done"
                            : "not_started"
                    }
                  />
                  <ProgressStep
                    label="Cleaning"
                    state={
                      kbStep === "error" && kbErrorPhase === "prepare"
                        ? "failed"
                        : kbStep === "prepare"
                          ? "in_progress"
                          : kbStep === "upload" || kbStep === "done"
                            ? "done"
                            : "not_started"
                    }
                  />
                  <ProgressStep
                    label="Indexing"
                    state={
                      kbStep === "error" && kbErrorPhase === "upload"
                        ? "failed"
                        : kbStep === "upload"
                          ? "in_progress"
                          : kbStep === "done"
                            ? "done"
                            : "not_started"
                    }
                  />
                </div>
              </div>

              {kbError ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {kbError}
                </div>
              ) : null}

              {showScrapedUrlsPanel ? (
                <Collapsible
                  open={scrapedUrlsOpen}
                  onOpenChange={setScrapedUrlsOpen}
                  className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/90 shadow-sm ring-1 ring-emerald-900/5"
                >
                  <CollapsibleTrigger
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3.5 text-left",
                      "outline-none transition-colors hover:bg-emerald-50/60",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                      scrapedUrlsOpen &&
                        "rounded-b-none border-b border-emerald-200/60 bg-emerald-50/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-200/80" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-950">Pages read</p>
                        <p className="truncate text-[11px] font-medium text-emerald-800/90 sm:hidden">
                          {kbUrls[kbUrls.length - 1]}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 pl-2">
                      <span className="hidden max-w-[14rem] truncate text-[11px] font-medium text-emerald-800/90 sm:inline">
                        {kbUrls[kbUrls.length - 1]}
                      </span>
                      <span className="rounded-lg bg-emerald-600/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-900">
                        {kbUrls.length}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-emerald-800/70 transition-transform duration-200",
                          scrapedUrlsOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="border-t border-emerald-200/50 px-2 pb-2 pt-0 data-[state=closed]:hidden">
                    <div className="max-h-64 overflow-auto rounded-lg border border-emerald-100 bg-white/95 p-2 shadow-inner">
                      <ul className="space-y-0.5 text-xs text-gray-800">
                        {kbUrls
                          .slice()
                          .reverse()
                          .map((u) => (
                            <li
                              key={u}
                              className="group flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-emerald-50/80"
                            >
                              <a
                                href={u}
                                target="_blank"
                                rel="noreferrer"
                                className="min-w-0 break-all text-emerald-950 underline decoration-emerald-200 underline-offset-2 hover:decoration-emerald-400"
                              >
                                {u}
                              </a>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  try {
                                    await navigator.clipboard.writeText(u);
                                  } catch {
                                    // ignore
                                  }
                                }}
                                className="shrink-0 rounded-md border border-emerald-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-900 opacity-0 shadow-sm transition-opacity hover:bg-emerald-50 group-hover:opacity-100"
                                title="Copy URL"
                              >
                                Copy
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : null}
            </>
          );
        })()}
      </div>
    </>
  );
}
