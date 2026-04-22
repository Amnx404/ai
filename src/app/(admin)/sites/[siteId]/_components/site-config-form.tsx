"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Site } from "@prisma/client";

import { resolvePineconeTarget } from "~/lib/pinecone-resolve";
import { api } from "~/trpc/react";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview (recommended)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },

  { id: "openai/gpt-5.4", label: "GPT-5.4" },

];

export function SiteConfigForm({
  site,
  defaultPineconeIndex,
  defaultPineconeIndexHost,
  initialTab,
}: {
  site: Site;
  defaultPineconeIndex: string;
  defaultPineconeIndexHost: string;
  initialTab?: "branding" | "behavior" | "knowledge";
}) {
  const router = useRouter();
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
    allowedDomains: site.allowedDomains.join(", "),
    allowedTopics: site.allowedTopics.join(", "),
    modelId: site.modelId,
    temperature: site.temperature,
    pineconeIndex: site.pineconeIndex ?? "",
    pineconeNs: site.pineconeNs ?? "",
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
    scrapeMaxPages:
      typeof initialScrapeConfig.max_pages === "number"
        ? String(initialScrapeConfig.max_pages)
        : "200",
    scrapeDelay:
      typeof initialScrapeConfig.delay === "number"
        ? String(initialScrapeConfig.delay)
        : "0.5",
    scrapeParallelWorkers:
      typeof initialScrapeConfig.parallel_workers === "number"
        ? String(initialScrapeConfig.parallel_workers)
        : "4",
    scrapeUseSelenium:
      typeof initialScrapeConfig.use_selenium === "boolean"
        ? initialScrapeConfig.use_selenium
        : true,
  });

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
      allowedDomains: site.allowedDomains.join(", "),
      allowedTopics: site.allowedTopics.join(", "),
      modelId: site.modelId,
      temperature: site.temperature,
      pineconeIndex: site.pineconeIndex ?? "",
      pineconeNs: site.pineconeNs ?? "",
      liveVersion: site.liveVersion,
      livePineconePrefix: (
        site as unknown as { livePineconePrefix?: string | null }
      ).livePineconePrefix ?? `${site.id}-live-v-`,
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
      scrapeMaxPages:
        typeof (site.scrapeConfig as any)?.max_pages === "number"
          ? String((site.scrapeConfig as any).max_pages)
          : "200",
      scrapeDelay:
        typeof (site.scrapeConfig as any)?.delay === "number"
          ? String((site.scrapeConfig as any).delay)
          : "0.5",
      scrapeParallelWorkers:
        typeof (site.scrapeConfig as any)?.parallel_workers === "number"
          ? String((site.scrapeConfig as any).parallel_workers)
          : "4",
      scrapeUseSelenium:
        typeof (site.scrapeConfig as any)?.use_selenium === "boolean"
          ? Boolean((site.scrapeConfig as any).use_selenium)
          : true,
    });
    initialSnapshotRef.current = snapshot;
    // Emit initial dirty state (false)
    window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty: false } }));
    lastDirtyRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);

  const [kbAdvanced, setKbAdvanced] = useState(false);
  const [kbRunId, setKbRunId] = useState<string>("");
  const [kbStep, setKbStep] = useState<"idle" | "scrape" | "prepare" | "upload" | "done" | "error">(
    "idle"
  );
  const [kbError, setKbError] = useState<string>("");
  const [kbLog, setKbLog] = useState<string>("");
  const [kbErrorPhase, setKbErrorPhase] = useState<"scrape" | "prepare" | "upload" | null>(null);

  const updateSite = api.sites.update.useMutation({
    onSuccess: () => {
      // On refresh, the server state becomes canonical, so we can clear dirty immediately.
      window.dispatchEvent(new CustomEvent("site:dirty", { detail: { dirty: false } }));
      lastDirtyRef.current = false;
      router.refresh();
    },
  });

  const resolvedPinecone = resolvePineconeTarget(
    {
      id: site.id,
      liveVersion: form.liveVersion,
      pineconeIndex: form.pineconeIndex || null,
      pineconeNs: form.pineconeNs || null,
    },
    defaultPineconeIndex,
    defaultPineconeIndexHost || undefined,
  );

  function save() {
    updateSite.mutate({
      id: site.id,
      name: form.name,
      primaryColor: form.primaryColor,
      title: form.title,
      greeting: form.greeting,
      primaryUrl: form.primaryUrl.trim(),
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
      pineconeIndex: form.pineconeIndex || null,
      pineconeNs: form.pineconeNs || null,
      liveVersion: form.liveVersion,
      livePineconePrefix: form.livePineconePrefix.trim() || null,
      scrapeConfig: {
        seed_urls: form.scrapeSeedUrls
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        allowed_prefixes: form.scrapeAllowedPrefixes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        max_pages: Number(form.scrapeMaxPages || 200),
        delay: Number(form.scrapeDelay || 0.5),
        parallel_workers: Number(form.scrapeParallelWorkers || 4),
        use_selenium: !!form.scrapeUseSelenium,
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

  async function readResponseJson(res: Response) {
    const text = await res.text().catch(() => "");
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Likely an HTML error page or otherwise non-JSON response.
      const preview = text.slice(0, 400).trim();
      throw new Error(
        `Request failed (${res.status} ${res.statusText}) with non-JSON response: ${preview || "<empty>"}`,
      );
    }
  }

  async function kbScrape() {
    setKbError("");
    setKbLog("");
    setKbErrorPhase(null);
    setKbStep("scrape");
    try {
      const scrape = {
        seed_urls: form.scrapeSeedUrls
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        allowed_prefixes: form.scrapeAllowedPrefixes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        max_pages: Number(form.scrapeMaxPages || 200),
        delay: Number(form.scrapeDelay || 0.5),
        parallel_workers: Number(form.scrapeParallelWorkers || 4),
        use_selenium: !!form.scrapeUseSelenium,
        respect_allowed_prefixes: true,
      };
      const res = await fetch("/api/v1/knowledge-base/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id, scrape }),
      });
      const json = (await readResponseJson(res)) as any;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? `Scrape failed (${res.status})`);
      }
      const runId = json?.run_id as string | undefined;
      if (!runId) throw new Error("Scrape succeeded but no run_id returned");
      setKbRunId(runId);
      setKbLog(JSON.stringify(json, null, 2));
      return runId;
    } catch (e: any) {
      console.warn("KB scrape failed", e);
      setKbErrorPhase("scrape");
      setKbStep("error");
      setKbError("Something went wrong on our side.");
      setKbLog(
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : JSON.stringify(e, null, 2),
      );
      throw e;
    }
  }

  async function kbPrepare(runId: string) {
    setKbStep("prepare");
    try {
      const res = await fetch("/api/v1/knowledge-base/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: site.id, runId }),
      });
      const json = (await readResponseJson(res)) as any;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? `Prepare failed (${res.status})`);
      }
      setKbLog(JSON.stringify(json, null, 2));
    } catch (e: any) {
      console.warn("KB prepare failed", e);
      setKbErrorPhase("prepare");
      setKbStep("error");
      setKbError("Something went wrong on our side.");
      setKbLog(
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : JSON.stringify(e, null, 2),
      );
      throw e;
    }
  }

  async function kbUpload(runId: string) {
    setKbStep("upload");
    try {
      const res = await fetch("/api/v1/knowledge-base/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
          runId,
          livePrefix: form.livePineconePrefix.trim(),
          // Small debugging defaults; you can remove/raise later
          maxRecords: kbAdvanced ? undefined : 500,
          batchSize: 100,
          embedBatchSize: 32,
          embedWorkers: 1,
        }),
      });
      const json = (await readResponseJson(res)) as any;
      if (!res.ok) {
        throw new Error(json?.error?.message ?? json?.error ?? `Upload failed (${res.status})`);
      }
      setKbLog(JSON.stringify(json, null, 2));
      setKbStep("done");
      router.refresh();
    } catch (e: any) {
      console.warn("KB upload failed", e);
      setKbErrorPhase("upload");
      setKbStep("error");
      setKbError("Something went wrong on our side.");
      setKbLog(
        typeof e?.message === "string" && e.message.trim()
          ? e.message
          : JSON.stringify(e, null, 2),
      );
      throw e;
    }
  }

  async function runKbPipeline() {
    setKbError("");
    setKbErrorPhase(null);
    const runId = await kbScrape();
    await kbPrepare(runId);
    await kbUpload(runId);
  }

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
        {tab === "branding" && (
          <>
            <Field label="Site name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Primary URL" hint="Where your widget will be embedded.">
              <input
                value={form.primaryUrl}
                onChange={(e) =>
                  setForm({ ...form, primaryUrl: normalizeHttps(e.target.value) })
                }
                placeholder="https://client.com"
                className={inputCls}
              />
            </Field>
            <div className="flex gap-4">
              <Field label="Primary color" className="flex-1">
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm({ ...form, primaryColor: e.target.value })
                    }
                    className="h-9 w-12 rounded-lg border border-gray-300 p-0.5 cursor-pointer"
                  />
                  <input
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm({ ...form, primaryColor: e.target.value })
                    }
                    className={`${inputCls} flex-1`}
                    placeholder="#6366f1"
                  />
                </div>
              </Field>
              <Field label="Widget title" className="flex-1">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field
              label="Logo"
              hint="Upload a logo (stored in Postgres as base64). Optional."
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-xs text-gray-400">logo</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = reader.result;
                      if (typeof result === "string") {
                        setForm({ ...form, logoUrl: result });
                      }
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="block text-sm text-gray-700"
                />
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logoUrl: "" })}
                    className="text-sm font-medium text-gray-700 underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            </Field>
            <Field label="Greeting message">
              <textarea
                value={form.greeting}
                onChange={(e) =>
                  setForm({ ...form, greeting: e.target.value })
                }
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </>
        )}

        {tab === "behavior" && (
          <>
            <Field
              label="Allowed domains"
              hint="Leave empty to allow all. Comma-separated."
            >
              <input
                value={form.allowedDomains}
                onChange={(e) =>
                  setForm({ ...form, allowedDomains: e.target.value })
                }
                placeholder="example.com, app.example.com"
                className={inputCls}
              />
            </Field>
            <Field
              label="Allowed topics / scope"
              hint="Keywords that define what the widget answers. Comma-separated."
            >
              <input
                value={form.allowedTopics}
                onChange={(e) =>
                  setForm({ ...form, allowedTopics: e.target.value })
                }
                placeholder="pricing, features, docs"
                className={inputCls}
              />
            </Field>
            <Field label="Model">
              <select
                value={form.modelId}
                onChange={(e) =>
                  setForm({ ...form, modelId: e.target.value })
                }
                className={inputCls}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Temperature: ${form.temperature}`}>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
            </Field>
          </>
        )}

        {tab === "knowledge" && (
          <>
            <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                    Knowledge base
                    <span className="text-gray-400">•</span>
                    Scrape → Prepare → Upload
                  </div>
                  <p className="mt-3 text-base font-semibold text-gray-900">
                    Refresh your content
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Scrape your website/docs and upload the cleaned knowledge to Pinecone.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    onClick={() => void runKbPipeline()}
                    disabled={kbStep === "scrape" || kbStep === "prepare" || kbStep === "upload"}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {kbStep === "scrape" || kbStep === "prepare" || kbStep === "upload"
                      ? "Refreshing…"
                      : "Refresh knowledge base"}
                  </button>
                  {kbRunId ? (
                    <p className="text-xs text-gray-500">
                      Run: <span className="font-mono">{kbRunId}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500">Takes ~1–3 minutes.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <ProgressStep
                  label="Scrape"
                  processing={kbStep === "scrape"}
                  completed={
                    kbStep === "prepare" || kbStep === "upload" || kbStep === "done"
                  }
                  error={kbStep === "error" && kbErrorPhase === "scrape"}
                />
                <ProgressStep
                  label="Prepare"
                  processing={kbStep === "prepare"}
                  completed={kbStep === "upload" || kbStep === "done"}
                  error={kbStep === "error" && kbErrorPhase === "prepare"}
                />
                <ProgressStep
                  label="Upload"
                  processing={kbStep === "upload"}
                  completed={kbStep === "done"}
                  error={kbStep === "error" && kbErrorPhase === "upload"}
                />
              </div>

              {kbError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {kbError}
                </div>
              ) : null}

              {kbLog ? (
                <details className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                    View run details
                  </summary>
                  <pre className="mt-3 max-h-64 overflow-auto rounded-xl bg-white border border-gray-200 p-3 text-xs">
{kbLog}
                  </pre>
                </details>
              ) : null}
            </div>

            <Field label="Scrape config" hint="Keep it simple: set the crawl entrypoints and limits.">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Seed URLs</label>
                  <UrlListInput
                    value={form.scrapeSeedUrls}
                    placeholder="https://example.com/docs"
                    normalize={normalizeHttps}
                    onChange={(next) => setForm({ ...form, scrapeSeedUrls: next })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Allowed prefixes</label>
                  <UrlListInput
                    value={form.scrapeAllowedPrefixes}
                    placeholder="https://example.com/docs/"
                    normalize={normalizeHttps}
                    onChange={(next) => setForm({ ...form, scrapeAllowedPrefixes: next })}
                  />
                </div>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Max pages">
                <input
                  value={form.scrapeMaxPages}
                  onChange={(e) => setForm({ ...form, scrapeMaxPages: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <div className="sm:col-span-2">
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">Advanced</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Tuning, Selenium, and Pinecone settings live here.
                  </p>
                  <button
                    type="button"
                    onClick={() => setKbAdvanced((v) => !v)}
                    className="mt-3 inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    {kbAdvanced ? "Hide advanced" : "Show advanced"}
                  </button>
                </div>
              </div>
            </div>

            {kbAdvanced ? (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Scrape tuning</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <Field label="Delay (seconds)">
                      <input
                        value={form.scrapeDelay}
                        onChange={(e) =>
                          setForm({ ...form, scrapeDelay: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Parallel workers">
                      <input
                        value={form.scrapeParallelWorkers}
                        onChange={(e) =>
                          setForm({ ...form, scrapeParallelWorkers: e.target.value })
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Use Selenium">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.scrapeUseSelenium}
                          onChange={(e) =>
                            setForm({ ...form, scrapeUseSelenium: e.target.checked })
                          }
                          className="h-4 w-4 accent-indigo-600"
                        />
                        Render pages
                      </label>
                    </Field>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Upload settings</p>
                  <Field
                    label="Live prefix"
                    hint="Editable. The pipeline will create namespaces like {prefix}1, {prefix}2, …"
                  >
                    <input
                      value={form.livePineconePrefix}
                      onChange={(e) =>
                        setForm({ ...form, livePineconePrefix: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">Pinecone target</p>
                  <Field
                    label="Pinecone index"
                    hint="Leave empty to use the default index from env."
                  >
                    <input
                      value={form.pineconeIndex}
                      onChange={(e) =>
                        setForm({ ...form, pineconeIndex: e.target.value })
                      }
                      placeholder="roboracer (default)"
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="Namespace override"
                    hint="Leave empty to use the latest live namespace (recommended)."
                  >
                    <input
                      value={form.pineconeNs}
                      onChange={(e) =>
                        setForm({ ...form, pineconeNs: e.target.value })
                      }
                      placeholder="my-namespace"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Live version">
                    <input
                      type="number"
                      min={1}
                      value={form.liveVersion}
                      onChange={(e) =>
                        setForm({ ...form, liveVersion: parseInt(e.target.value) })
                      }
                      className={inputCls}
                    />
                  </Field>
                </div>
              </>
            ) : null}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-gray-800">
              <p className="font-semibold text-indigo-900">
                Effective Pinecone target (chat + ingest)
              </p>
              <p className="mt-2 font-mono text-xs break-all">
                <span className="text-gray-500">index:</span>{" "}
                {resolvedPinecone.indexName}
                <span className="ml-2 text-gray-400">
                  ({resolvedPinecone.indexSource === "env" ? "from env" : "site override"})
                </span>
              </p>
              {resolvedPinecone.indexHostUrl ? (
                <p className="mt-1 font-mono text-xs break-all">
                  <span className="text-gray-500">host:</span>{" "}
                  {resolvedPinecone.indexHostUrl}
                  <span className="ml-2 text-gray-400">(from env)</span>
                </p>
              ) : (
                <p className="mt-1 font-mono text-xs break-all">
                  <span className="text-gray-500">host:</span>{" "}
                  <span className="text-gray-400">
                    (auto-resolved by Pinecone SDK)
                  </span>
                </p>
              )}
              <p className="mt-1 font-mono text-xs break-all">
                <span className="text-gray-500">namespace:</span>{" "}
                {resolvedPinecone.namespace}
                <span className="ml-2 text-gray-400">
                  (
                  {resolvedPinecone.namespaceSource === "derived"
                    ? `derived from site id + live v${form.liveVersion}`
                    : "site override"}
                  )
                </span>
              </p>
            </div>
          </>
        )}
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

function ProgressStep({
  label,
  processing,
  completed,
  error,
}: {
  label: string;
  processing: boolean;
  completed: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={`relative flex min-h-[2.5rem] items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 ${
        error ? "border-red-200 bg-red-50/80" : "border-gray-200 bg-white"
      }`}
    >
      {processing ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-100/0 via-emerald-200/55 to-emerald-100/0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-emerald-300/35 to-transparent animate-kb-step-sweep"
          />
        </>
      ) : null}
      <span
        className={`relative z-[1] h-2.5 w-2.5 shrink-0 rounded-full ${
          error ? "bg-red-500" : completed ? "bg-emerald-500" : "bg-gray-300"
        }`}
      />
      <span
        className={`relative z-[1] text-xs font-medium ${
          processing ? "text-emerald-900" : error ? "text-red-800" : "text-gray-700"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function UrlListInput({
  value,
  onChange,
  placeholder,
  normalize,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  normalize: (raw: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>("");

  const items = useMemo(() => {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [value]);

  const shouldScroll = items.length > 3;

  const extractAllNormalized = (raw: string) => {
    const s = raw.trim();
    if (!s) return [];
    const matches = s.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    const candidates =
      matches.length > 0
        ? matches
        : [
            // Fall back to single entry behavior when there's no explicit scheme in the string.
            s,
          ];

    return candidates
      .map((c) => normalize(c))
      .map((c) => c.replace(/[),.;]+$/g, ""))
      .filter(Boolean);
  };

  const commit = (raw: string) => {
    const normalized = extractAllNormalized(raw);
    if (!normalized.length) return;

    for (const n of normalized) {
      try {
        const u = new URL(n);
        if (u.protocol !== "https:") {
          setError("Must be an https URL.");
          return;
        }
      } catch {
        setError("Invalid URL.");
        return;
      }
    }

    setError("");
    const nextItems = Array.from(new Set([...items, ...normalized]));
    onChange(nextItems.join("\n"));
    setDraft("");
  };

  const remove = (idx: number) => {
    const nextItems = items.filter((_, i) => i !== idx);
    onChange(nextItems.join("\n"));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            }
          }}
          onBlur={() => {
            if (!draft.trim()) return;
            // Helpful: normalize on blur but don't auto-add unless it's valid.
            const n = normalize(draft);
            if (n !== draft) setDraft(n);
          }}
          className={`${inputCls} font-mono text-xs`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          className="shrink-0 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}

      {items.length ? (
        <div
          className={`mt-2 space-y-1 ${
            shouldScroll ? "max-h-28 overflow-auto pr-1" : ""
          }`}
        >
          {items.map((u, idx) => (
            <div
              key={`${u}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800">
                {u}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-white hover:text-gray-900"
                aria-label={`Remove ${u}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">Add one or more URLs.</p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {hint && <p className="mb-1 text-xs text-gray-400">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
