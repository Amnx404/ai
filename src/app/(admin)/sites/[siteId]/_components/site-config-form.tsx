"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Site } from "@prisma/client";
import { useSession } from "next-auth/react";

import { resolvePineconeTarget } from "~/lib/pinecone-resolve";
import { api } from "~/trpc/react";

const MODELS = [
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash Preview (recommended)" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },

  { id: "openai/gpt-5.4", label: "GPT-5.4" },

];

const FREE_MODEL_ID = "google/gemini-2.5-flash";

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

  const [kbRunId, setKbRunId] = useState<string>("");
  const [kbStep, setKbStep] = useState<"idle" | "scrape" | "prepare" | "upload" | "done" | "error">(
    "idle"
  );
  const [kbPipelineStatus, setKbPipelineStatus] = useState<string>("");
  const [kbLoading, setKbLoading] = useState(false);
  const [kbStarting, setKbStarting] = useState(false);
  const [kbError, setKbError] = useState<string>("");
  const [kbUrls, setKbUrls] = useState<string[]>([]);
  const [kbErrorPhase, setKbErrorPhase] = useState<"scrape" | "prepare" | "upload" | null>(null);
  const kbBootstrapSeq = useRef(0);
  const kbStartInFlightRef = useRef(false);
  const kbStartSeqRef = useRef(0);

  const BrandingTab = () => (
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
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </Field>
    </>
  );

  const BehaviorTab = () => (
    <>
      <Field
        label="Allowed domains"
        hint="Comma-separated. Includes your app + primary URL by default."
      >
        <div className="space-y-2">
          <input
            value={form.allowedDomains}
            onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })}
            placeholder="example.com, app.example.com"
            className={inputCls}
          />
          <span className="text-[11px] text-gray-500">
            Example: <span className="font-mono">example.com</span>
          </span>
        </div>
      </Field>
      <Field
        label="Allowed topics / scope"
        hint="Keywords that define what the widget answers. Comma-separated."
      >
        <input
          value={form.allowedTopics}
          onChange={(e) => setForm({ ...form, allowedTopics: e.target.value })}
          placeholder="pricing, features, docs"
          className={inputCls}
        />
      </Field>
      <Field label="Model">
        <select
          value={form.modelId}
          onChange={(e) => setForm({ ...form, modelId: e.target.value })}
          className={inputCls}
        >
          {MODELS.map((m) => {
            const disabled = plan === "FREE" && m.id !== FREE_MODEL_ID;
            return (
              <option key={m.id} value={m.id} disabled={disabled}>
                {disabled ? `${m.label} — Pro/Max` : m.label}
              </option>
            );
          })}
        </select>
      </Field>
      <Field label={`Temperature: ${form.temperature}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={form.temperature}
          onChange={(e) =>
            setForm({ ...form, temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-indigo-600"
        />
      </Field>
    </>
  );

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

  const isKbPolling =
    Boolean(kbRunId) &&
    kbStep !== "done" &&
    kbStep !== "error" &&
    (kbPipelineStatus === "" ||
      (kbPipelineStatus !== "succeeded" &&
        kbPipelineStatus !== "failed" &&
        kbPipelineStatus !== "aborted"));

  // Simplified KB tab bootstrap: on entering the Knowledge tab, load latest run from DB.
  useEffect(() => {
    if (tab !== "knowledge") return;

    let cancelled = false;
    const seq = ++kbBootstrapSeq.current;
    (async () => {
      setKbLoading(true);
      setKbError("");
      setKbErrorPhase(null);
      try {
        const res = await fetch(
          `/api/v1/knowledge-base/run/latest?siteId=${encodeURIComponent(site.id)}`,
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
        const pipelineStatus = typeof json?.pipelineStatus === "string" ? json.pipelineStatus : "";
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
  }, [site.id, tab]);

  useEffect(() => {
    if (!kbRunId) return;
    if (!isKbPolling) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/v1/knowledge-base/run/status?siteId=${encodeURIComponent(site.id)}&runId=${encodeURIComponent(kbRunId)}`,
          { cache: "no-store" },
        );
        const json = (await readResponseJson(res)) as any;
        if (!res.ok) throw new Error(json?.error ?? `Status failed (${res.status})`);
        if (cancelled) return;

        const pipelineStatus = (json?.pipeline_status as string | undefined) ?? "";
        const currentStep = (json?.current_step as string | undefined) ?? "";
        setKbPipelineStatus(pipelineStatus);

        // Map run status -> our 3-step progress UI.
        if (pipelineStatus === "succeeded") {
          setKbStep("done");
          router.refresh();
        } else if (pipelineStatus === "failed" || pipelineStatus === "aborted") {
          setKbStep("error");
          setKbErrorPhase(currentStep === "prepare" || currentStep === "upload" ? (currentStep as any) : "scrape");
          setKbError("Knowledge base run failed.");
        } else {
          if (currentStep === "prepare") setKbStep("prepare");
          else if (currentStep === "upload") setKbStep("upload");
          else setKbStep("scrape");
        }

        // Keep harvesting URLs from the polled state (best-effort).
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
  }, [isKbPolling, kbRunId, router, site.id]);

  async function runKbPipeline() {
    // Synchronous guard: React state updates are async, so double-clicks can
    // otherwise fire multiple start requests before the button disables.
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
    // Cancel any in-flight "latest run" load so it can't overwrite the new run state.
    kbBootstrapSeq.current++;

    try {
      const res = await fetch("/api/v1/knowledge-base/run/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: site.id,
        maxRecords: 500,
        }),
      });
      const json = (await readResponseJson(res)) as any;
      if (!res.ok) throw new Error(json?.error ?? `Failed to start run (${res.status})`);
      const runId = json?.run_id as string | undefined;
      if (!runId) throw new Error("Run started but no run_id returned");

      // If a newer start was initiated while this request was in flight, ignore this result.
      if (kbStartSeqRef.current === startSeq) {
        setKbRunId(runId);
        setKbPipelineStatus("queued");
        setKbStep("scrape");

        // Kick an immediate status fetch so the UI doesn't look "stuck" until
        // the polling loop ticks and the scraper updates state.
        try {
          const sres = await fetch(
            `/api/v1/knowledge-base/run/status?siteId=${encodeURIComponent(site.id)}&runId=${encodeURIComponent(runId)}`,
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
        {tab === "branding" ? <BrandingTab /> : null}

        {tab === "behavior" ? <BehaviorTab /> : null}

        {tab === "knowledge" && (
          <>
            <div className="rounded-3xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
              {(() => {
                const status =
                  kbLoading
                    ? { tone: "muted", label: "Loading…" }
                    : kbStarting
                      ? { tone: "muted", label: "Starting…" }
                      : isKbPolling
                        ? { tone: "live", label: "Scraping in progress" }
                        : kbStep === "done"
                          ? { tone: "ok", label: "Up to date" }
                          : kbStep === "error"
                            ? { tone: "error", label: "Needs attention" }
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

                const primaryLabel =
                  kbStarting
                    ? "Starting…"
                    : isKbPolling
                      ? "Running…"
                      : kbRunId
                        ? "Refresh knowledge base"
                        : "Start scraping";

                return (
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
                      </div>
                      <p className="mt-1 text-sm text-gray-600">
                        We’ll crawl your site and keep answers grounded in your pages.
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
                                  body: JSON.stringify({ siteId: site.id, runId: kbRunId }),
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
                        {kbRunId ? "Showing the latest run for this site." : "No runs yet."}
                      </p>

                      {/* Coverage / speed controls appear after URL + prefix inputs */}
                    </div>
                  </div>
                );
              })()}

              <Field label="Scrape config" hint="Set what to crawl and how fast.">
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

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Field label="🧭 Coverage">
                    <select
                      value={form.scrapeCoverage}
                      onChange={(e) => setForm({ ...form, scrapeCoverage: e.target.value })}
                      className={inputCls}
                    >
                      <option value="basic">Basic (10 pages)</option>
                      <option value="wide" disabled={plan === "FREE"}>
                        {plan === "FREE" ? "Wide (50 pages) — Pro/Max" : "Wide (50 pages)"}
                      </option>
                      <option value="thorough" disabled={plan !== "MAX"}>
                        {plan === "MAX"
                          ? "Thorough (1000 pages)"
                          : "Thorough (1000 pages) — Max"}
                      </option>
                    </select>
                  </Field>
                  <Field label="⚡ Speed">
                    <select
                      value={form.scrapeSpeed}
                      onChange={(e) => setForm({ ...form, scrapeSpeed: e.target.value })}
                      className={inputCls}
                    >
                      <option value="quick">Quick (3 workers)</option>
                      <option value="speedy" disabled={plan === "FREE"}>
                        {plan === "FREE" ? "Speedy (7 workers) — Pro/Max" : "Speedy (7 workers)"}
                      </option>
                      <option value="fastest" disabled={plan !== "MAX"}>
                        {plan === "MAX"
                          ? "Fastest (10 workers)"
                          : "Fastest (10 workers) — Max"}
                      </option>
                    </select>
                  </Field>
                </div>
              </Field>

              {/* Coverage / speed controls live top-right */}

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

              {kbUrls.length > 0 ? (
                <details
                  className="mt-4 rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
                  open={isKbPolling}
                >
                  <summary className="cursor-pointer select-none">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="relative inline-flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                        <p className="text-sm font-semibold text-green-900">
                          {isKbPolling ? "Scraping…" : "Scraped URLs"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isKbPolling ? (
                          <span className="hidden max-w-[22rem] truncate text-[11px] font-medium text-green-800 sm:inline">
                            Latest: {kbUrls[kbUrls.length - 1]}
                          </span>
                        ) : null}
                        <span className="text-xs font-medium text-green-800">
                          {kbUrls.length} URLs
                        </span>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-green-200 bg-white/80 p-2">
                    <ul className="space-y-1 text-xs text-gray-800">
                      {kbUrls
                        .slice()
                        .reverse()
                        .map((u) => (
                          <li
                            key={u}
                            className="group flex items-start justify-between gap-2 rounded-lg px-2 py-1 hover:bg-green-50"
                          >
                            <a
                              href={u}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 break-all text-green-900 underline decoration-green-200 underline-offset-2 hover:decoration-green-400"
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
                              className="shrink-0 rounded-md border border-green-200 bg-white px-2 py-0.5 text-[11px] font-medium text-green-900 opacity-0 shadow-sm transition-opacity hover:bg-green-50 group-hover:opacity-100"
                              title="Copy URL"
                            >
                              Copy
                            </button>
                          </li>
                        ))}
                    </ul>
                  </div>
                </details>
              ) : null}
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
  state,
}: {
  label: string;
  state: "not_started" | "in_progress" | "done" | "failed";
}) {
  const isProcessing = state === "in_progress";
  const isDone = state === "done";
  const isFailed = state === "failed";

  return (
    <div
      className={`relative flex min-h-[2.5rem] items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 ${
        isFailed
          ? "border-red-200 bg-red-50/80"
          : isProcessing
            ? "border-amber-200 bg-amber-50/60"
            : isDone
              ? "border-emerald-200 bg-emerald-50/70"
            : "border-gray-200 bg-white"
      }`}
    >
      <span className="relative z-[1] flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        {isProcessing ? (
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        ) : (
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isFailed ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-gray-300"
            }`}
          />
        )}
      </span>
      <span
        className={`relative z-[1] text-xs font-medium ${
          isProcessing
            ? "text-amber-900"
            : isFailed
              ? "text-red-800"
              : isDone
                ? "text-emerald-900"
                : "text-gray-700"
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
