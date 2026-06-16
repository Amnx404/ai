"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Code2,
  Copy,
  ExternalLink,
  Globe2,
  Rocket,
  ShieldCheck,
} from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { cn } from "~/lib/utils";

type CopyState = "idle" | "copied" | "error";
type StepTone = "ready" | "waiting" | "live";
type InstallStep = {
  title: string;
  body: string;
  state: string;
  tone: StepTone;
};

function hostFromUrl(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

export function EmbedSnippet({
  siteId,
  primaryUrl,
  allowedDomainsCount,
  livePineconeNamespace,
  isActive,
  compact = false,
}: {
  siteId: string;
  primaryUrl: string;
  allowedDomainsCount: number;
  livePineconeNamespace: string | null;
  isActive: boolean;
  compact?: boolean;
}) {
  const searchParams = useSearchParams();
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [origin, setOrigin] = useState("");
  const [open, setOpen] = useState(false);
  const setupTarget = searchParams.get("tab");
  const focusTarget = searchParams.get("focus");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (setupTarget !== "publish" && setupTarget !== "install" && focusTarget !== "embed") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("embed")?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTarget, setupTarget]);

  const snippet = origin
    ? `<script>
  window.ChatWidget = { siteId: "${siteId}" };
</script>
<script async src="${origin}/widget.js?v=current-page-context"></script>`
    : "Loading install code...";

  const primaryHost = hostFromUrl(primaryUrl);
  const hasKnowledge = Boolean(livePineconeNamespace);
  const hasWebsite = Boolean(primaryHost);
  const hasAllowedDomains = allowedDomainsCount > 0;
  const readyToInstall = hasWebsite && hasAllowedDomains;
  const readyToPublish = readyToInstall && hasKnowledge;
  const canCopySnippet = readyToInstall && Boolean(origin);
  const publishMissingLabel = !hasWebsite
    ? "Needs URL"
    : !hasAllowedDomains
      ? "Needs domains"
      : !hasKnowledge
        ? "Needs knowledge"
        : "Ready";
  const shortWidgetKey =
    siteId.length > 18 ? `${siteId.slice(0, 10)}...${siteId.slice(-5)}` : siteId;
  const nextSetupHref = !hasWebsite
    ? `/sites/${encodeURIComponent(siteId)}?view=setup&tab=branding`
    : !hasAllowedDomains
      ? `/sites/${encodeURIComponent(siteId)}?view=setup&tab=behavior`
      : !hasKnowledge
        ? `/sites/${encodeURIComponent(siteId)}?view=setup&tab=knowledge`
        : `/sites/${encodeURIComponent(siteId)}?view=setup&focus=embed#embed`;
  const nextSetupLabel = !hasWebsite
    ? "Set website URL"
    : !hasAllowedDomains
      ? "Set allowed domains"
      : !hasKnowledge
        ? "Add knowledge"
        : isActive
          ? "Review install"
          : "Publish from checklist";
  const installFacts = [
    {
      icon: Globe2,
      label: "Website",
      value: primaryHost || "Missing URL",
      ok: Boolean(primaryHost),
    },
    {
      icon: ShieldCheck,
      label: "Allowed domains",
      value: allowedDomainsCount ? `${allowedDomainsCount} configured` : "Missing",
      ok: allowedDomainsCount > 0,
    },
    {
      icon: Code2,
      label: "Widget key",
      value: shortWidgetKey,
      title: siteId,
      ok: true,
    },
  ];
  const status = isActive
    ? {
        label: "Live",
        helper: "The installed widget can answer visitors on allowed domains.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      }
    : readyToPublish
      ? {
          label: "Ready to publish",
          helper: "Install the snippet, preview it, then publish when you are ready.",
          className: "border-blue-200 bg-blue-50 text-blue-800",
        }
      : hasKnowledge
        ? {
            label: "Install setup needed",
            helper: "Set the website URL and allowed domains before publishing the widget.",
            className: "border-amber-200 bg-amber-50 text-amber-900",
          }
      : {
          label: "Setup needed",
          helper: "Add trusted knowledge before publishing the widget to visitors.",
          className: "border-amber-200 bg-amber-50 text-amber-900",
        };
  const installSteps: InstallStep[] = [
    {
      title: "Paste snippet",
      body: readyToInstall
        ? "Add it before the closing body tag or inside the website template."
        : "Set the website URL and allowed domains before installing.",
      state: readyToInstall ? "Available" : "Needs setup",
      tone: readyToInstall ? "ready" : "waiting",
    },
    {
      title: "Preview",
      body: readyToInstall
        ? "Check the launcher, greeting, and branding before sending visitors to it."
        : "Preview becomes meaningful once the website and allowed domains are set.",
      state: readyToInstall ? "Available" : "Needs setup",
      tone: readyToInstall ? "ready" : "waiting",
    },
    {
      title: "Publish",
      body: isActive
        ? "The widget is live on allowed domains."
        : readyToPublish
          ? "Ready after you install and preview the snippet."
        : hasKnowledge
          ? "Waiting for website URL and allowed domains."
            : "Waiting for knowledge to be added.",
      state: isActive ? "Live" : publishMissingLabel,
      tone: isActive ? "live" : readyToPublish ? "ready" : "waiting",
    },
  ];

  function copy() {
    if (!canCopySnippet) return;
    void navigator.clipboard
      .writeText(snippet)
      .then(() => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 2000);
      })
      .catch(() => {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 2500);
      });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-sm">
      <div
        className={
          compact ? "space-y-4" : "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
        }
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">Install widget</h3>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                status.className,
              )}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {status.label}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{status.helper}</p>
          <div
            className={
              compact
                ? "mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50"
                : "mt-3 grid gap-2 sm:grid-cols-3"
            }
          >
            {installFacts.map((item) => (
              <div
                key={item.label}
                className={cn(
                  compact
                    ? "flex min-w-0 items-center justify-between gap-3 px-3 py-2.5"
                    : "min-w-0 rounded-lg border px-3 py-2",
                  !compact &&
                    (item.ok ? "border-gray-200 bg-gray-50" : "border-amber-200 bg-amber-50"),
                )}
              >
                {compact ? (
                  <>
                    <div className="flex min-w-0 items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                      <span className="truncate text-xs font-semibold uppercase text-gray-500">
                        {item.label}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "max-w-[9.5rem] truncate text-right text-xs font-semibold",
                        item.ok ? "text-gray-900" : "text-amber-800",
                      )}
                      title={"title" in item ? item.title : item.value}
                    >
                      {item.value}
                    </span>
                  </>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase text-gray-500">
                        {item.label}
                      </p>
                      <p
                        className="mt-1 truncate text-xs font-semibold text-gray-900"
                        title={"title" in item ? item.title : item.value}
                      >
                        {item.value}
                      </p>
                    </div>
                    <item.icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className={compact ? "grid gap-2" : "flex flex-col gap-2 sm:flex-row lg:flex-col"}>
          <button
            type="button"
            onClick={copy}
            disabled={!canCopySnippet}
            title={
              canCopySnippet
                ? "Copy install snippet"
                : "Set the website URL and allowed domains before copying the snippet."
            }
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {!canCopySnippet
              ? "Setup needed"
              : copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Copy failed"
                : "Copy snippet"}
          </button>
          <Link
            href={`/widget-demo?siteId=${encodeURIComponent(siteId)}${
              primaryUrl ? `&url=${encodeURIComponent(primaryUrl)}` : ""
            }`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Preview
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
          {(!readyToPublish || !isActive) ? (
            <Link
              href={nextSetupHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              {nextSetupLabel}
            </Link>
          ) : null}
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "" : "sm:grid-cols-3"}`}>
        {installSteps.map((step, index) => (
          <div key={step.title} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                  step.tone === "live"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : step.tone === "ready"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-500",
                )}
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      step.tone === "live"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : step.tone === "ready"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-500",
                    )}
                  >
                    {step.state}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-500">{step.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-gray-100">
          <span className="inline-flex items-center gap-2">
            <Code2 className="h-3.5 w-3.5" aria-hidden />
            Install code
          </span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 data-[state=closed]:hidden">
          <pre className="max-h-72 min-w-0 overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-green-300">
            <code className="block min-w-0 whitespace-pre-wrap break-all">{snippet}</code>
          </pre>
          <p className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            {readyToInstall
              ? "Installed snippets stay quiet until the widget is published."
              : "Install code is available after the website URL and allowed domains are set."}
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
