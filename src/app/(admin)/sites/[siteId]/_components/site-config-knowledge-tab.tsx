"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

import { Field, ProgressStep, UrlListInput, inputCls } from "./site-config-form.ui";

function ConfigHintLabel({
  children,
  hint,
  align = "left",
}: {
  children: ReactNode;
  hint: string;
  align?: "left" | "right";
}) {
  return (
    <div className="group/hint relative mb-1 flex items-center gap-1.5">
      <span className="text-xs font-medium text-gray-600">{children}</span>
      <button
        type="button"
        className={cn(
          "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold leading-none text-gray-500",
          "shadow-sm hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1",
        )}
        aria-label={hint}
      >
        ?
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
  normalizeHttps,
  onRefresh,
  onPersist,
}: {
  siteId: string;
  siteLivePineconeNs: string | null;
  plan: "FREE" | "PRO" | "MAX";
  form: {
    scrapeSeedUrls: string;
    scrapeAllowedPrefixes: string;
    scrapeCoverage: string;
    scrapeSpeed: string;
  };
  setForm: (next: typeof form) => void;
  normalizeHttps: (raw: string) => string;
  onRefresh: () => void;
  onPersist: () => void;
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
          const text = JSON.stringify(cached);
          const matches = text.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
          if (matches.length) setKbUrls(Array.from(new Set(matches)).slice(-50));
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
        setKbError(typeof e?.message === "string" ? e.message : "Failed to load knowledge base");
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
          setKbError("Knowledge base run failed.");
        } else {
          if (currentStep === "prepare") setKbStep("prepare");
          else if (currentStep === "upload") setKbStep("upload");
          else setKbStep("scrape");
        }

        const text = JSON.stringify(json);
        const matches = text.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
        if (matches.length) {
          const next = Array.from(new Set([...matches])).slice(-50);
          setKbUrls(next);
        }
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
    if (kbStartInFlightRef.current) return;
    kbStartInFlightRef.current = true;
    const startSeq = ++kbStartSeqRef.current;

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
          maxRecords: 500,
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

            const text = JSON.stringify(sjson);
            const matches = text.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
            if (matches.length) {
              setKbUrls(Array.from(new Set(matches)).slice(-50));
            }
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
    () =>
      kbStep === "done" ||
      kbPipelineStatus.trim().toLowerCase() === "succeeded",
    [kbStep, kbPipelineStatus],
  );

  const showScrapedUrlsPanel = useMemo(() => {
    if (kbUrls.length === 0) return false;
    const scrapePhaseDone =
      kbStep === "prepare" ||
      kbStep === "upload" ||
      kbStep === "done" ||
      (kbStep === "error" && kbErrorPhase !== "scrape");
    return scrapePhaseDone;
  }, [kbUrls.length, kbStep, kbErrorPhase]);

  useEffect(() => {
    if (!showScrapedUrlsPanel) setScrapedUrlsOpen(false);
  }, [showScrapedUrlsPanel]);

  return (
    <>
      <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
        {(() => {
          const status = kbLoading
            ? { tone: "muted", label: "Loading…" }
            : kbStarting
              ? { tone: "muted", label: "Starting…" }
              : isKbPolling
                ? { tone: "live", label: "Scraping in progress" }
                : kbStep === "error"
                  ? { tone: "error", label: "Needs attention" }
                  : runLooksComplete
                    ? { tone: "ok", label: "Up to date" }
                    : !hasLiveNamespace
                      ? { tone: "error", label: "Needs scraping / indexing" }
                      : kbRunId
                        ? { tone: "muted", label: "Last run loaded" }
                        : { tone: "muted", label: "Not scraped yet" };

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
              : kbRunId
                ? "Refresh knowledge base"
                : "Start scraping";

          return (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-gray-900">
                      Knowledge base
                    </p>
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
                    {runLooksComplete
                      ? "Your latest crawl finished and is ready to use. Run again whenever your site changes."
                      : isKbPolling
                        ? "Hang tight—we’re crawling your pages and building the knowledge index."
                        : "We’ll go around your site and understand what’s on those pages and what links to them."}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void runKbPipeline()}
                      disabled={isKbPolling || kbLoading || kbStarting}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
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
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Stop
                      </button>
                    ) : null}
                  </div>

                  <p className="text-xs text-gray-500">
                    {kbRunId ? "" : "No runs yet."}
                  </p>
                </div>
              </div>

              <Field label="Config">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <ConfigHintLabel hint="Starting places for the crawl: full https links to the first pages we open (like your homepage or a docs landing page). We discover more pages by following links from here.">
                      Seed URLs
                    </ConfigHintLabel>
                    <UrlListInput
                      value={form.scrapeSeedUrls}
                      placeholder="https://example.com/docs"
                      normalize={normalizeHttps}
                      onChange={(next) => setForm({ ...form, scrapeSeedUrls: next })}
                      onPersist={onPersist}
                    />
                  </div>
                  <div>
                    <ConfigHintLabel
                      align="right"
                      hint="We only keep pages whose web address starts with one of these paths—usually your site’s root (https://yoursite.com/) or a folder (https://yoursite.com/docs/). That keeps the crawl on your content and off random external links."
                    >
                      Allowed prefixes
                    </ConfigHintLabel>
                    <UrlListInput
                      value={form.scrapeAllowedPrefixes}
                      placeholder="https://example.com/docs/"
                      normalize={normalizeHttps}
                      onChange={(next) => setForm({ ...form, scrapeAllowedPrefixes: next })}
                      onPersist={onPersist}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="🧭 Coverage">
                    <select
                      value={form.scrapeCoverage}
                      onChange={(e) => setForm({ ...form, scrapeCoverage: e.target.value })}
                      onBlur={onPersist}
                      className={inputCls}
                    >
                      <option value="basic">Basic (10 pages)</option>
                      <option value="wide" disabled={plan === "FREE"}>
                        {plan === "FREE" ? "Wide (50 pages) — Pro/Max" : "Wide (50 pages)"}
                      </option>
                      <option value="thorough" disabled={plan !== "MAX"}>
                        {plan === "MAX" ? "Thorough (1000 pages)" : "Thorough (1000 pages) — Max"}
                      </option>
                    </select>
                  </Field>
                  <Field label="⚡ Speed">
                    <select
                      value={form.scrapeSpeed}
                      onChange={(e) => setForm({ ...form, scrapeSpeed: e.target.value })}
                      onBlur={onPersist}
                      className={inputCls}
                    >
                      <option value="quick">Quick (3 workers)</option>
                      <option value="speedy" disabled={plan === "FREE"}>
                        {plan === "FREE" ? "Speedy (7 workers) — Pro/Max" : "Speedy (7 workers)"}
                      </option>
                      <option value="fastest" disabled={plan !== "MAX"}>
                        {plan === "MAX" ? "Fastest (10 workers)" : "Fastest (10 workers) — Max"}
                      </option>
                    </select>
                  </Field>
                </div>
              </Field>

              <div className="mt-5 grid grid-cols-3 gap-2">
                <ProgressStep
                  label="Scraping"
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

              {kbError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {kbError}
                </div>
              ) : null}

              {showScrapedUrlsPanel ? (
                <Collapsible
                  open={scrapedUrlsOpen}
                  onOpenChange={setScrapedUrlsOpen}
                  className="mt-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white shadow-sm ring-1 ring-emerald-900/5"
                >
                  <CollapsibleTrigger
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left",
                      "outline-none transition-colors hover:bg-emerald-50/60",
                      "focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                      scrapedUrlsOpen &&
                        "rounded-b-none border-b border-emerald-200/60 bg-emerald-50/40",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-200/80" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-emerald-950">Scraped URLs</p>
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
                    <div className="max-h-64 overflow-auto rounded-xl border border-emerald-100 bg-white/95 p-2 shadow-inner">
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

