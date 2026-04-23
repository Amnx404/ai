"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Site } from "@prisma/client";
import { useSession } from "next-auth/react";

import { api } from "~/trpc/react";
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
  initialTab,
}: {
  site: Site;
  defaultPineconeIndex: string;
  defaultPineconeIndexHost: string;
  initialTab?: "branding" | "behavior" | "knowledge";
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const plan = ((session?.user as any)?.plan ?? "FREE") as "FREE" | "PRO" | "MAX";
  const normalizeHttps = (raw: string) => {
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
  };

  const stripImplicitDomains = (domains: string[]) =>
    domains.filter((d) => {
      const s = String(d ?? "").trim();
      if (!s) return false;
      return !/^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/i.test(s);
    });

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

  const initialScrapeConfig = useMemo(() => {
    const raw = site.scrapeConfig;
    if (!raw || typeof raw !== "object") return {};
    return raw as Record<string, unknown>;
  }, [site.scrapeConfig]);

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
    liveVersion: site.liveVersion,
    livePineconePrefix:
      (
        site as unknown as {
          livePineconePrefix?: string | null;
        }
      ).livePineconePrefix ?? `${site.id}-live-v-`,
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
    scrapeCoverage:
      typeof initialScrapeConfig.max_pages === "number"
        ? Number(initialScrapeConfig.max_pages) <= 10
          ? "basic"
          : Number(initialScrapeConfig.max_pages) <= 50
            ? "wide"
            : "thorough"
        : "thorough",
    scrapeSpeed:
      typeof initialScrapeConfig.parallel_workers === "number"
        ? Number(initialScrapeConfig.parallel_workers) <= 3
          ? "quick"
          : Number(initialScrapeConfig.parallel_workers) <= 7
            ? "speedy"
            : "fastest"
        : "speedy",
  });

  useEffect(() => {
    // Free tier: lock model selection to the allowed model.
    if (plan === "FREE" && form.modelId !== FREE_MODEL_ID) {
      setForm((prev) => ({ ...prev, modelId: FREE_MODEL_ID }));
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
    if (site.allowedDomains.length > 0) return;
    if (form.allowedDomains.trim().length > 0) return;
    const suggested = computeSuggestedAllowedDomains("");
    if (suggested.trim().length > 0) setForm((prev) => ({ ...prev, allowedDomains: suggested }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, site.id]);

  const initialSnapshotRef = useRef<string>("");
  const lastDirtyRef = useRef<boolean>(false);

  useEffect(() => {
    // Build a stable snapshot of the persisted site state to compare against.
    // We only include the fields that the form can edit.
    const snapshot = JSON.stringify({
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
      liveVersion: site.liveVersion,
      scrapeSeedUrls: Array.isArray((site.scrapeConfig as any)?.seed_urls)
        ? ((site.scrapeConfig as any).seed_urls as unknown[])
            .filter((v: unknown): v is string => typeof v === "string")
            .join("\n")
        : site.primaryUrl
          ? site.primaryUrl
          : "",
      scrapeAllowedPrefixes: Array.isArray((site.scrapeConfig as any)?.allowed_prefixes)
        ? ((site.scrapeConfig as any).allowed_prefixes as unknown[])
            .filter((v: unknown): v is string => typeof v === "string")
            .join("\n")
        : (() => {
            try {
              const u = new URL(site.primaryUrl || "");
              return `${u.origin}/`;
            } catch {
              return "";
            }
          })(),
      scrapeCoverage:
        typeof (site.scrapeConfig as any)?.max_pages === "number"
          ? ((site.scrapeConfig as any).max_pages as number) <= 10
            ? "basic"
            : ((site.scrapeConfig as any).max_pages as number) <= 50
              ? "wide"
              : "thorough"
          : "thorough",
      scrapeSpeed:
        typeof (site.scrapeConfig as any)?.parallel_workers === "number"
          ? ((site.scrapeConfig as any).parallel_workers as number) <= 3
            ? "quick"
            : ((site.scrapeConfig as any).parallel_workers as number) <= 7
              ? "speedy"
              : "fastest"
          : "speedy",
    });
    initialSnapshotRef.current = snapshot;
    // Emit initial dirty state (false)
    window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty: false } }));
    lastDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  const updateSite = api.sites.update.useMutation({
    onSuccess: () => {
      // On refresh, the server state becomes canonical, so we can clear dirty immediately.
      window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty: false } }));
      lastDirtyRef.current = false;
      router.refresh();
    },
  });

  const maxPagesByCoverage = (coverage: string) => {
    if (coverage === "basic") return 10;
    if (coverage === "wide") return 50;
    // MAX tier gets the large crawl.
    return plan === "MAX" ? 1000 : 200;
  };

  const workersBySpeed = (speed: string) => {
    if (speed === "quick") return 3;
    if (speed === "fastest") return 10;
    return 7; // speedy
  };

  function save() {
    updateSite.mutate({
      id: site.id,
      name: form.name,
      primaryColor: form.primaryColor,
      title: form.title,
      greeting: form.greeting,
      primaryUrl: form.primaryUrl.trim() ? normalizeHttps(form.primaryUrl.trim()) : "",
      logoUrl: form.logoUrl.trim() ? form.logoUrl.trim() : null,
      allowedDomains: form.allowedDomains
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      allowedTopics: form.allowedTopics
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      modelId: form.modelId,
      temperature: form.temperature,
      liveVersion: form.liveVersion,
      scrapeConfig: {
        seed_urls: form.scrapeSeedUrls
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        allowed_prefixes: form.scrapeAllowedPrefixes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        max_pages: maxPagesByCoverage(form.scrapeCoverage),
        delay: 0.5,
        parallel_workers: workersBySpeed(form.scrapeSpeed),
        respect_allowed_prefixes: true,
      },
    });
  }

  // Dirty-state emitter for the setup widget.
  useEffect(() => {
    const dirty = JSON.stringify(form) !== initialSnapshotRef.current;
    if (dirty !== lastDirtyRef.current) {
      lastDirtyRef.current = dirty;
      window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty } }));
    }
  }, [form]);

  // Allow the setup widget to trigger a save.
  useEffect(() => {
    const onRequestSave = () => {
      save();
    };
    window.addEventListener("site:request-save", onRequestSave);
    return () => window.removeEventListener("site:request-save", onRequestSave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const tabDone = useMemo(() => {
    const branding = form.name.trim().length > 0 && form.primaryUrl.trim().length > 0;
    const behavior = form.allowedDomains.trim().length > 0;
    const knowledge = Boolean(site.livePineconeNs);
    return { branding, behavior, knowledge };
  }, [form.allowedDomains, form.name, form.primaryUrl, site.livePineconeNs]);

  const tabs = [
    {
      id: "branding" as const,
      label: "Branding",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.59l3.7 3.7-1.4 1.41L11 13V7h2z" />
        </svg>
      ),
      desc: "Logo, colors, demo",
    },
    {
      id: "behavior" as const,
      label: "Behavior",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M12 1a11 11 0 1011 11A11 11 0 0012 1zm6 6h-2.35a15.7 15.7 0 00-1.1-2.44A9.07 9.07 0 0118 7zM12 3a13.4 13.4 0 011.73 4H10.27A13.4 13.4 0 0112 3zM4 13a8.9 8.9 0 010-2h3.06a16.6 16.6 0 000 2H4zm.35-6A9.07 9.07 0 018.45 4.56 15.7 15.7 0 007.35 7H4.35zM6 12a14.4 14.4 0 01.17-2h3.35a17.7 17.7 0 000 4H6.17A14.4 14.4 0 016 12zm1.35 5h-3A9.07 9.07 0 018.45 19.44 15.7 15.7 0 007.35 17zm2.92 0h3.46A13.4 13.4 0 0112 21a13.4 13.4 0 01-1.73-4zm.19-3a15.8 15.8 0 010-4h3.08a15.8 15.8 0 010 4h-3.08zM15.55 19.44A9.07 9.07 0 0119.65 17h-3a15.7 15.7 0 01-1.1 2.44zM16.83 14H18v-4h-1.17a16.6 16.6 0 010 4zM16.65 11h3.06a8.9 8.9 0 010 2h-3.06a16.6 16.6 0 000-2z" />
        </svg>
      ),
      desc: "Domains, topics, model",
    },
    {
      id: "knowledge" as const,
      label: "Knowledge",
      icon: (
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M19 2H8a2 2 0 00-2 2v14a2 2 0 002 2h11v2H7a4 4 0 01-4-4V6a4 4 0 014-4h12v2z" />
          <path d="M10 6h10v2H10V6zm0 4h10v2H10v-2zm0 4h7v2h-7v-2z" />
        </svg>
      ),
      desc: "Scrape & Pinecone",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-gray-50 p-1.5">
          {tabs.map((t) => {
            const active = tab === t.id;
            const done = tabDone[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`group rounded-xl px-3 py-2.5 text-left transition-all ${
                  active
                    ? "bg-white shadow-sm ring-1 ring-gray-200"
                    : "hover:bg-white/60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`${
                      active ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-500"
                    }`}
                  >
                    {t.icon}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      active ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    {t.label}
                  </span>
                  <span
                    className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border ${
                      done
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                    aria-label={done ? `${t.label} configured` : `${t.label} not configured`}
                  >
                    {done ? (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                        <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 12-12-1.5-1.5L9 16.2z" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-6 space-y-5">
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
          />
        ) : null}

        {tab === "behavior" ? (
          <SiteConfigBehaviorTab
            form={{
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
          />
        ) : null}

        {tab === "knowledge" ? (
          <SiteConfigKnowledgeTab
            siteId={site.id}
            siteLivePineconeNs={site.livePineconeNs}
            plan={plan}
            form={{
              scrapeSeedUrls: form.scrapeSeedUrls,
              scrapeAllowedPrefixes: form.scrapeAllowedPrefixes,
              scrapeCoverage: form.scrapeCoverage,
              scrapeSpeed: form.scrapeSpeed,
            }}
            setForm={(next) =>
              setForm((prev) => ({
                ...prev,
                ...next,
              }))
            }
            normalizeHttps={normalizeHttps}
            onRefresh={() => router.refresh()}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
        {updateSite.isSuccess && (
          <p className="text-sm text-green-600 font-medium">Saved!</p>
        )}
        {updateSite.error && (
          <p className="text-sm text-red-600">{updateSite.error.message}</p>
        )}
        {!updateSite.isSuccess && !updateSite.error && <span />}
        <button
          onClick={save}
          disabled={updateSite.isPending}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {updateSite.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
