"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type Site } from "@prisma/client";
import {
  AlertCircle,
  BookOpenText,
  Check,
  CheckCircle2,
  Loader2,
  Palette,
  Save,
  ShieldCheck,
} from "lucide-react";

import { api } from "~/trpc/react";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { buildScrapeConfigFromKnowledgeFields } from "~/lib/site-scrape-form";
import { SiteConfigBrandingTab } from "./site-config-branding-tab";
import { SiteConfigBehaviorTab } from "./site-config-behavior-tab";
import { SiteConfigKnowledgeTab } from "./site-config-knowledge-tab";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview (recommended)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },

  { id: "openai/gpt-5.4", label: "GPT-5.4" },

];

const FREE_MODEL_ID = "google/gemini-2.5-flash";

export function SiteConfigForm({
  site,
  defaultPineconeIndex: _defaultPineconeIndex,
  defaultPineconeIndexHost: _defaultPineconeIndexHost,
  internalAppHost,
  initialTab,
  plan,
}: {
  site: Site;
  defaultPineconeIndex: string;
  defaultPineconeIndexHost: string;
  internalAppHost: string;
  initialTab?: "branding" | "behavior" | "knowledge";
  plan: "FREE" | "PRO" | "MAX";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizeHttps = useCallback((raw: string) => {
    const s = raw.trim();
    if (!s) return "";

    // If the user pasted arbitrary text, extract the first URL-looking substring.
    // Examples:
    // - "docs: https://example.com/foo" -> "https://example.com/foo"
    // - "http://example.com" -> "https://example.com"
    const m = s.match(/https?:\/\/[^\s"'<>]+/i);
    const candidate = (m?.[0] ?? s)
      // Common trailing punctuation when pasting from sentences.
      .replace(/[),.;]+$/g, "");

    if (/^https:\/\//i.test(candidate)) return candidate;
    if (/^http:\/\//i.test(candidate)) return candidate.replace(/^http:\/\//i, "https://");
    return `https://${candidate}`;
  }, []);

  const normalizeSourceUrl = useCallback((raw: string) => {
    const s = raw.trim();
    if (!s) return "";

    const m = s.match(/https?:\/\/[^\s"'<>]+/i);
    const candidate = (m?.[0] ?? s).replace(/[),.;]+$/g, "");

    if (/^https?:\/\//i.test(candidate)) return candidate;
    return `https://${candidate}`;
  }, []);

  const stripImplicitDomains = (domains: string[]) =>
    getUserFacingAllowedDomains(domains, internalAppHost);

  const baseOrigin = (raw: string) => {
    try {
      const u = new URL(normalizeHttps(raw));
      return `${u.origin}/`;
    } catch {
      return "";
    }
  };

  const [tab, setTab] = useState<"branding" | "behavior" | "knowledge">(
    initialTab ?? "branding"
  );

  useEffect(() => {
    setTab(initialTab ?? "branding");
  }, [initialTab]);

  const initialScrapeConfig = useMemo(() => {
    const raw = site.scrapeConfig;
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, unknown>;
  }, [site.scrapeConfig]);

  const persistedInt = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.trim());
      return Number.isFinite(n) ? Math.trunc(n) : null;
    }
    return null;
  };

  const persistedStringList = (v: unknown): string =>
    Array.isArray(v)
      ? v
          .filter((item): item is string => typeof item === "string")
          .join("\n")
      : "";

  const [form, setForm] = useState({
    name: site.name,
    primaryColor: site.primaryColor,
    title: site.title,
    greeting: site.greeting,
    primaryUrl: site.primaryUrl ?? "",
    logoUrl: site.logoUrl ?? "",
    allowedDomains: stripImplicitDomains(site.allowedDomains).join(", "),
    allowedTopics: site.allowedTopics.join(", "),
    modelId: site.modelId,
    temperature: site.temperature,
    scrapeSeedUrls: Array.isArray(initialScrapeConfig.seed_urls)
      ? (initialScrapeConfig.seed_urls as unknown[])
          .filter((v): v is string => typeof v === "string")
          .join("\n")
      : (site.primaryUrl ? site.primaryUrl : ""),
    scrapeAllowedPrefixes: Array.isArray(initialScrapeConfig.allowed_prefixes)
      ? (initialScrapeConfig.allowed_prefixes as unknown[])
          .filter((v): v is string => typeof v === "string")
          .join("\n")
      : (() => {
          try {
            const u = new URL(site.primaryUrl || "");
            return `${u.origin}/`;
          } catch {
            return "";
          }
        })(),
    scrapeCoverage: (() => {
      const mp = persistedInt(initialScrapeConfig.max_pages);
      if (mp === null) return "basic";
      if (mp <= 10) return "basic";
      if (mp <= 50) return "wide";
      return "thorough";
    })(),
    scrapeSpeed: (() => {
      const w = persistedInt(initialScrapeConfig.parallel_workers);
      if (w === null) return "speedy";
      if (w <= 3) return "quick";
      if (w <= 7) return "speedy";
      return "fastest";
    })(),
    scrapeMaxDepth: (() => {
      const depth = persistedInt(initialScrapeConfig.max_depth);
      return depth === null ? "2" : String(depth);
    })(),
    scrapeProvider:
      initialScrapeConfig.scrape_provider === "firecrawl" ? "firecrawl" : "cloudflare",
    scrapeCloudflareRenderMode:
      initialScrapeConfig.cloudflare_render_mode === "static" ||
      initialScrapeConfig.cloudflare_render_mode === "browser"
        ? initialScrapeConfig.cloudflare_render_mode
        : "auto",
    scrapeCloudflareDiscoveryMode:
      initialScrapeConfig.cloudflare_discovery_mode === "static" ? "static" : "crawl",
    scrapeCloudflarePerSeedLimit: (() => {
      const limit = persistedInt(initialScrapeConfig.cloudflare_per_seed_limit);
      return limit === null ? "" : String(limit);
    })(),
    scrapeSourceGroupsJson: Array.isArray(initialScrapeConfig.source_groups)
      ? JSON.stringify(initialScrapeConfig.source_groups, null, 2)
      : "",
    scrapeSkipMap:
      typeof initialScrapeConfig.skip_map === "boolean"
        ? initialScrapeConfig.skip_map
        : false,
    scrapeFinetune:
      typeof initialScrapeConfig.finetune === "boolean"
        ? initialScrapeConfig.finetune
        : false,
    scrapeUrlWhitelistPatterns: persistedStringList(initialScrapeConfig.url_whitelist_patterns),
    scrapeUrlBlacklistPatterns: persistedStringList(initialScrapeConfig.url_blacklist_patterns),
  });

  const formRef = useRef(form);
  formRef.current = form;

  const initialSnapshotRef = useRef<string>("");
  const lastDirtyRef = useRef<boolean>(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const formSnapshot = useCallback(
    (f: typeof form) =>
      JSON.stringify({
        name: f.name,
        primaryColor: f.primaryColor,
        title: f.title,
        greeting: f.greeting,
        primaryUrl: f.primaryUrl,
        logoUrl: f.logoUrl,
        allowedDomains: f.allowedDomains,
        allowedTopics: f.allowedTopics,
        modelId: f.modelId,
        temperature: f.temperature,
        scrapeSeedUrls: f.scrapeSeedUrls,
        scrapeAllowedPrefixes: f.scrapeAllowedPrefixes,
        scrapeCoverage: f.scrapeCoverage,
        scrapeSpeed: f.scrapeSpeed,
        scrapeMaxDepth: f.scrapeMaxDepth,
        scrapeProvider: f.scrapeProvider,
        scrapeCloudflareRenderMode: f.scrapeCloudflareRenderMode,
        scrapeCloudflareDiscoveryMode: f.scrapeCloudflareDiscoveryMode,
        scrapeCloudflarePerSeedLimit: f.scrapeCloudflarePerSeedLimit,
        scrapeSourceGroupsJson: f.scrapeSourceGroupsJson,
        scrapeSkipMap: f.scrapeSkipMap,
        scrapeFinetune: f.scrapeFinetune,
        scrapeUrlWhitelistPatterns: f.scrapeUrlWhitelistPatterns,
        scrapeUrlBlacklistPatterns: f.scrapeUrlBlacklistPatterns,
      }),
    [],
  );

  const markClean = useCallback(
    (draft?: typeof form) => {
      initialSnapshotRef.current = formSnapshot(draft ?? formRef.current);
      lastDirtyRef.current = false;
      setIsDirty(false);
      setLastSavedAt(new Date());
      window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty: false } }));
    },
    [formSnapshot],
  );

  const updateSite = api.sites.update.useMutation({
    onSuccess: () => {
      markClean();
      router.refresh();
    },
  });

  const persistSite = useCallback((draft?: typeof form) => {
    window.requestAnimationFrame(() => {
      const f = draft ?? formRef.current;
      updateSite.mutate({
        id: site.id,
        name: f.name,
        primaryColor: f.primaryColor,
        title: f.title,
        greeting: f.greeting,
        primaryUrl: f.primaryUrl.trim() ? normalizeHttps(f.primaryUrl.trim()) : "",
        logoUrl: f.logoUrl.trim() ? f.logoUrl.trim() : null,
        allowedDomains: f.allowedDomains
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        allowedTopics: f.allowedTopics
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        modelId: f.modelId,
        temperature: f.temperature,
        scrapeConfig: buildScrapeConfigFromKnowledgeFields({
          scrapeSeedUrls: f.scrapeSeedUrls,
          scrapeProvider: f.scrapeProvider as "firecrawl" | "cloudflare",
          scrapeCloudflareRenderMode: f.scrapeCloudflareRenderMode as "auto" | "static" | "browser",
          scrapeCloudflareDiscoveryMode: f.scrapeCloudflareDiscoveryMode as "crawl" | "static",
          scrapeCloudflarePerSeedLimit: f.scrapeCloudflarePerSeedLimit,
          scrapeSourceGroupsJson: f.scrapeSourceGroupsJson,
          scrapeAllowedPrefixes: f.scrapeAllowedPrefixes,
          scrapeCoverage: f.scrapeCoverage,
          scrapeSpeed: f.scrapeSpeed,
          scrapeMaxDepth: f.scrapeMaxDepth,
          scrapeSkipMap: f.scrapeSkipMap,
          scrapeFinetune: f.scrapeFinetune,
          scrapeUrlWhitelistPatterns: f.scrapeUrlWhitelistPatterns,
          scrapeUrlBlacklistPatterns: f.scrapeUrlBlacklistPatterns,
          plan,
        }) as never,
      });
    });
  }, [site.id, plan, normalizeHttps, updateSite]);

  useEffect(() => {
    if (plan === "FREE" && form.modelId !== FREE_MODEL_ID) {
      setForm((prev) => ({ ...prev, modelId: FREE_MODEL_ID }));
      window.requestAnimationFrame(() => persistSite());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  const computeSuggestedAllowedDomains = (rawCurrent: string) => {
    const set = new Set(
      rawCurrent
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    );

    try {
      const primaryHost = new URL(normalizeHttps(form.primaryUrl).trim()).host;
      if (primaryHost) set.add(primaryHost);
    } catch {
      // ignore
    }

    return [...set].join(", ");
  };

  useEffect(() => {
    // Only prefill defaults if the site hasn't set any explicit domains yet.
    if (stripImplicitDomains(site.allowedDomains).length > 0) return;
    if (form.allowedDomains.trim().length > 0) return;
    const suggested = computeSuggestedAllowedDomains("");
    if (suggested.trim().length > 0) setForm((prev) => ({ ...prev, allowedDomains: suggested }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  useEffect(() => {
    // When primary URL is set/changed, keep sensible defaults in empty fields.
    const next = { ...form };

    // Always keep app domain + primary domain included.
    next.allowedDomains = computeSuggestedAllowedDomains(next.allowedDomains);

    if (next.scrapeSeedUrls.trim().length === 0 && next.primaryUrl.trim().length > 0) {
      next.scrapeSeedUrls = normalizeHttps(next.primaryUrl.trim());
    }

    if (next.scrapeAllowedPrefixes.trim().length === 0 && next.primaryUrl.trim().length > 0) {
      try {
        const u = new URL(normalizeHttps(next.primaryUrl.trim()));
        next.scrapeAllowedPrefixes = `${u.origin}/`;
      } catch {
        // ignore
      }
    }

    // Avoid re-render loops if nothing actually changed.
    if (
      next.allowedDomains !== form.allowedDomains ||
      next.scrapeSeedUrls !== form.scrapeSeedUrls ||
      next.scrapeAllowedPrefixes !== form.scrapeAllowedPrefixes
    ) {
      setForm(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.primaryUrl]);

  useEffect(() => {
    // Enforce plan-based scrape tiers in the UI.
    // FREE: basic+quick, PRO: allow wide+speedy, MAX: allow thorough+fastest.
    const allowedCoverage =
      plan === "MAX"
        ? ["basic", "wide", "thorough"]
        : plan === "PRO"
          ? ["basic", "wide"]
          : ["basic"];
    const allowedSpeed =
      plan === "MAX"
        ? ["quick", "speedy", "fastest"]
        : plan === "PRO"
          ? ["quick", "speedy"]
          : ["quick"];

    const nextCoverage = allowedCoverage.includes(form.scrapeCoverage) ? form.scrapeCoverage : "basic";
    const nextSpeed = allowedSpeed.includes(form.scrapeSpeed) ? form.scrapeSpeed : "quick";

    if (nextCoverage !== form.scrapeCoverage || nextSpeed !== form.scrapeSpeed) {
      setForm((prev) => ({ ...prev, scrapeCoverage: nextCoverage, scrapeSpeed: nextSpeed }));
      window.requestAnimationFrame(() => persistSite());
    }
  }, [plan, site.id, form.scrapeCoverage, form.scrapeSpeed, persistSite]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => markClean());
    return () => window.cancelAnimationFrame(frame);
  }, [markClean, site.id]);

  // Dirty-state emitter for the setup widget.
  useEffect(() => {
    if (!initialSnapshotRef.current) return;
    const dirty = formSnapshot(form) !== initialSnapshotRef.current;
    setIsDirty(dirty);
    if (dirty !== lastDirtyRef.current) {
      lastDirtyRef.current = dirty;
      window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty } }));
    }
  }, [form, formSnapshot]);

  useEffect(() => {
    const onRequestSave = () => persistSite();
    window.addEventListener("site:request-save", onRequestSave);
    return () => window.removeEventListener("site:request-save", onRequestSave);
  }, [persistSite]);

  const tabDone = useMemo(() => {
    const branding = form.name.trim().length > 0 && form.primaryUrl.trim().length > 0;
    const behavior =
      getUserFacingAllowedDomains(form.allowedDomains.split(/[,\n]+/), internalAppHost).length > 0;
    const knowledge = Boolean(site.livePineconeNs);
    return { branding, behavior, knowledge };
  }, [form.allowedDomains, form.name, form.primaryUrl, internalAppHost, site.livePineconeNs]);

  const tabs = [
    {
      id: "branding" as const,
      label: "Branding",
      icon: Palette,
      desc: "Logo, colors, demo",
    },
    {
      id: "behavior" as const,
      label: "Behavior",
      icon: ShieldCheck,
      desc: "Domains, topics, model",
    },
    {
      id: "knowledge" as const,
      label: "Knowledge",
      icon: BookOpenText,
      desc: "Pages, reading, index",
    },
  ];

  const selectTab = (nextTab: "branding" | "behavior" | "knowledge") => {
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "setup");
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const savedAtLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
  const saveStatus = updateSite.isPending
    ? {
        icon: Loader2,
        label: "Saving changes",
        helper: "Settings are being updated.",
        className: "border-blue-200 bg-blue-50 text-blue-800",
        spin: true,
      }
    : updateSite.error
      ? {
          icon: AlertCircle,
          label: "Save failed",
          helper: updateSite.error.message,
          className: "border-red-200 bg-red-50 text-red-800",
          spin: false,
        }
      : isDirty
        ? {
            icon: AlertCircle,
            label: "Unsaved changes",
            helper: "Save before previewing or publishing.",
            className: "border-amber-200 bg-amber-50 text-amber-900",
            spin: false,
          }
        : {
            icon: CheckCircle2,
            label: "Saved",
            helper: savedAtLabel ? `Last saved at ${savedAtLabel}.` : "Settings are up to date.",
            className: "border-emerald-200 bg-emerald-50 text-emerald-800",
            spin: false,
          };
  const SaveStatusIcon = saveStatus.icon;
  const knowledgeWorkSurface = tab === "knowledge";
  const showKnowledgeSaveControls =
    knowledgeWorkSurface && (isDirty || updateSite.isPending || Boolean(updateSite.error));
  const shellClass = knowledgeWorkSurface
    ? "min-w-0 space-y-4"
    : "min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm";
  const tabsClass = knowledgeWorkSurface
    ? "rounded-lg border border-gray-200 bg-white px-3 py-4 shadow-sm sm:px-6"
    : "border-b border-gray-200 px-3 py-4 sm:px-6";
  const contentClass = knowledgeWorkSurface
    ? showKnowledgeSaveControls
      ? "space-y-5 pb-28"
      : "space-y-5 pb-6"
    : "space-y-5 p-4 sm:p-6";
  const errorClass = knowledgeWorkSurface
    ? "rounded-lg border border-red-100 bg-red-50/80 px-6 py-3 text-sm text-red-800"
    : "border-t border-red-100 bg-red-50/80 px-6 py-3 text-sm text-red-800";
  const saveBarClass = knowledgeWorkSurface
    ? "fixed bottom-4 left-4 right-4 z-50 rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.16)] backdrop-blur sm:px-4 lg:left-[17.5rem]"
    : "sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:px-6";
  const saveStatusBoxClass = knowledgeWorkSurface
    ? `flex min-w-0 items-center gap-3 rounded-lg border px-3 py-1.5 ${saveStatus.className}`
    : `flex min-w-0 items-start gap-3 rounded-lg border px-3 py-2 ${saveStatus.className}`;
  const saveStatusHelperClass = knowledgeWorkSurface
    ? "sr-only"
    : "mt-0.5 break-words text-xs opacity-80";
  const saveControls = (
    <div className={saveBarClass}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className={saveStatusBoxClass}
          role="status"
          aria-live="polite"
        >
          <SaveStatusIcon
            className={`h-4 w-4 shrink-0 ${saveStatus.spin ? "animate-spin" : ""}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{saveStatus.label}</p>
            <p className={saveStatusHelperClass}>{saveStatus.helper}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => persistSite()}
          disabled={updateSite.isPending || (!isDirty && !updateSite.error)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
        >
          {updateSite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Save className="h-4 w-4" aria-hidden />
          )}
          {updateSite.isPending ? "Saving" : updateSite.error ? "Retry save" : "Save changes"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={shellClass}>
      {/* Tabs */}
      <div className={tabsClass}>
        <div
          className="grid grid-cols-3 gap-1.5 rounded-lg bg-gray-50 p-1.5"
          role="tablist"
          aria-label="Widget setup sections"
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            const done = tabDone[t.id];
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                id={`setup-tab-${t.id}`}
                role="tab"
                onClick={() => selectTab(t.id)}
                aria-label={`${t.label}: ${t.desc}. ${done ? "Configured" : "Not configured"}`}
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-controls={`setup-panel-${t.id}`}
                className={`group min-h-11 min-w-0 rounded-lg px-1.5 py-2 text-center transition-all sm:px-3 sm:py-2.5 sm:text-left ${
                  active
                    ? "bg-white shadow-sm ring-1 ring-gray-200"
                    : "hover:bg-white/60"
                }`}
              >
                <div className="flex min-w-0 items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
                  <span
                    className={`shrink-0 ${active ? "text-gray-900" : "text-gray-400 group-hover:text-gray-700"}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span
                    className={`min-w-0 whitespace-nowrap text-xs font-semibold sm:truncate sm:text-sm ${
                      active ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span
                    className={`ml-auto hidden h-5 w-5 items-center justify-center rounded-full border sm:flex ${
                      done
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                    aria-label={done ? `${t.label} configured` : `${t.label} not configured`}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                </div>
                <p className="mt-0.5 hidden truncate text-xs text-gray-500 sm:block">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {knowledgeWorkSurface ? <div id="source-pages" className="scroll-mt-6" /> : null}
      {showKnowledgeSaveControls ? saveControls : null}

      <div
        id={`setup-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`setup-tab-${tab}`}
        className={contentClass}
      >
        {tab === "branding" ? (
          <SiteConfigBrandingTab
            form={{
              name: form.name,
              primaryUrl: form.primaryUrl,
              primaryColor: form.primaryColor,
              title: form.title,
              logoUrl: form.logoUrl,
              greeting: form.greeting,
            }}
            setForm={(next) =>
              setForm((prev) => ({
                ...prev,
                ...next,
              }))
            }
            onPersist={persistSite}
          />
        ) : null}

        {tab === "behavior" ? (
          <SiteConfigBehaviorTab
            form={{
              primaryUrl: form.primaryUrl,
              allowedDomains: form.allowedDomains,
              allowedTopics: form.allowedTopics,
              modelId: form.modelId,
              temperature: form.temperature,
            }}
            setForm={(next) =>
              setForm((prev) => ({
                ...prev,
                ...next,
              }))
            }
            plan={plan}
            models={MODELS}
            freeModelId={FREE_MODEL_ID}
            onPersist={persistSite}
          />
        ) : null}

        {tab === "knowledge" ? (
          <SiteConfigKnowledgeTab
            siteId={site.id}
            siteLivePineconeNs={site.livePineconeNs}
            plan={plan}
            form={{
              scrapeProvider: form.scrapeProvider,
              scrapeCloudflareRenderMode: form.scrapeCloudflareRenderMode,
              scrapeCloudflareDiscoveryMode: form.scrapeCloudflareDiscoveryMode,
              scrapeCloudflarePerSeedLimit: form.scrapeCloudflarePerSeedLimit,
              scrapeSourceGroupsJson: form.scrapeSourceGroupsJson,
              scrapeSeedUrls: form.scrapeSeedUrls,
              scrapeAllowedPrefixes: form.scrapeAllowedPrefixes,
              scrapeCoverage: form.scrapeCoverage,
              scrapeSpeed: form.scrapeSpeed,
              scrapeMaxDepth: form.scrapeMaxDepth,
              scrapeSkipMap: form.scrapeSkipMap,
              scrapeFinetune: form.scrapeFinetune,
              scrapeUrlWhitelistPatterns: form.scrapeUrlWhitelistPatterns,
              scrapeUrlBlacklistPatterns: form.scrapeUrlBlacklistPatterns,
            }}
            setForm={(next) =>
              setForm((prev) => ({
                ...prev,
                ...next,
              }))
            }
            normalizeSourceUrl={normalizeSourceUrl}
            onRefresh={() => router.refresh()}
            onPersist={(next) =>
              persistSite(next ? { ...formRef.current, ...next } : undefined)
            }
          />
        ) : null}
      </div>

      {updateSite.error ? (
        <div className={errorClass}>
          {updateSite.error.message}
        </div>
      ) : null}

      {knowledgeWorkSurface ? null : saveControls}
    </div>
  );
}
