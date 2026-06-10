"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ExternalLink, Rocket, Save } from "lucide-react";

import { api } from "~/trpc/react";

type ActionMessage = {
  tone: "info" | "success" | "error";
  text: string;
};

export function GettingStarted({
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
  const router = useRouter();
  const sp = useSearchParams();
  const setup = sp.get("setup") === "1";
  const activeTab = sp.get("tab");
  const activeFocus = sp.get("focus");
  const [dirty, setDirty] = useState(false);
  const [checkingPublish, setCheckingPublish] = useState(false);
  const [actionMessage, setActionMessage] = useState<ActionMessage | null>(null);

  useEffect(() => {
    const onDirty = (e: Event) => {
      const ce = e as CustomEvent<{ dirty?: boolean }>;
      setDirty(!!ce.detail?.dirty);
    };
    window.addEventListener("site:dirty", onDirty);
    return () => window.removeEventListener("site:dirty", onDirty);
  }, []);

  const primaryOrigin = (() => {
    try {
      if (!primaryUrl) return "";
      const u = new URL(primaryUrl);
      return `${u.origin}/`;
    } catch {
      return "";
    }
  })();

  const steps = [
    {
      id: "branding",
      title: "Branding + website URL",
      description: "Name the widget, set the colors, and point it at the website it belongs to.",
      done: primaryUrl.trim().length > 0,
      href: `/sites/${siteId}?view=setup&tab=branding${setup ? "&setup=1" : ""}`,
    },
    {
      id: "behavior",
      title: "Allowed domains",
      description: "Choose the domains that are allowed to load the published widget.",
      done: allowedDomainsCount > 0,
      href: `/sites/${siteId}?view=setup&tab=behavior${setup ? "&setup=1" : ""}`,
    },
    {
      id: "knowledge",
      title: "Add knowledge sources",
      description: "Import and clean the pages the widget should use when answering visitors.",
      done: !!livePineconeNamespace,
      href: `/sites/${siteId}?view=setup&tab=knowledge${setup ? "&setup=1" : ""}`,
    },
    {
      id: "embed",
      title: "Install + publish",
      description: "Copy the snippet, preview the launcher, then make it live.",
      done: isActive,
      href: `/sites/${siteId}?view=setup${setup ? "&setup=1" : ""}&focus=embed#embed`,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? steps[steps.length - 1]!;
  const canDeploy =
    primaryUrl.trim().length > 0 &&
    allowedDomainsCount > 0 &&
    Boolean(livePineconeNamespace);
  const launchRequirements = [
    {
      label: "URL",
      fullLabel: "Website URL",
      done: primaryUrl.trim().length > 0,
      href: steps[0]!.href,
    },
    {
      label: "Domains",
      fullLabel: "Allowed domains",
      done: allowedDomainsCount > 0,
      href: steps[1]!.href,
    },
    {
      label: "Knowledge",
      fullLabel: "Knowledge sources",
      done: Boolean(livePineconeNamespace),
      href: steps[2]!.href,
    },
    {
      label: "Publish",
      fullLabel: "Publish widget",
      done: isActive,
      href: steps[3]!.href,
    },
  ];
  const missingRequirements = launchRequirements.filter((item) => !item.done);
  const blockingRequirements = launchRequirements
    .filter((item) => item.fullLabel !== "Publish widget" && !item.done)
    .map((item) => item.fullLabel.toLowerCase());
  const launchProgressText = dirty
    ? "Save pending changes before publishing."
    : isActive
      ? "Published and available on allowed domains."
      : blockingRequirements.length
        ? `Missing ${blockingRequirements.join(", ")}.`
        : "Ready for final preview and publish.";
  const currentStepOpen =
    (next.id === "branding" && (activeTab === "branding" || activeTab === "appearance")) ||
    (next.id === "behavior" && activeTab === "behavior") ||
    (next.id === "knowledge" && (activeTab === "knowledge" || activeTab === "sources")) ||
    (next.id === "embed" && activeFocus === "embed");
  const nextActionLabel =
    next.id === "branding"
      ? "Set website URL"
      : next.id === "behavior"
        ? "Set allowed domains"
        : next.id === "knowledge"
          ? currentStepOpen
            ? "Review knowledge"
            : "Open knowledge"
          : currentStepOpen
            ? "Review install step"
            : "Open install step";
  const nextActionHref =
    next.id === "knowledge"
      ? `${next.href}#source-pages`
      : next.id === "embed"
        ? steps[3]!.href
        : next.href;

  const update = api.sites.update.useMutation({
    onSuccess: () => router.refresh(),
  });
  const actionBusy = checkingPublish || update.isPending;

  useEffect(() => {
    if (dirty) setActionMessage(null);
  }, [dirty]);

  async function deployabilityReason() {
    const res = await fetch(`/api/v1/sites/deployable?siteId=${encodeURIComponent(siteId)}`);
    const json = (await res.json().catch(() => null)) as any;
    if (res.ok && Boolean(json?.canDeploy)) return null;
    return (
      (typeof json?.reason === "string" && json.reason) ||
      (typeof json?.error === "string" && json.error) ||
      "This widget is not ready to publish yet."
    );
  }

  async function handlePrimaryAction(kind: "save" | "deploy" | "stop") {
    if (kind === "save") {
      setActionMessage({ tone: "info", text: "Saving settings before launch." });
      window.dispatchEvent(new CustomEvent("site:request-save"));
      return;
    }

    if (kind === "deploy") {
      setActionMessage(null);
      setCheckingPublish(true);
      try {
        const reason = await deployabilityReason();
        if (reason) {
          setActionMessage({ tone: "error", text: reason });
          return;
        }
        setActionMessage({ tone: "info", text: "Publishing widget." });
        update.mutate(
          { id: siteId, isActive: true },
          {
            onSuccess: () => {
              setActionMessage({ tone: "success", text: "Widget published." });
              router.refresh();
            },
            onError: (error) => {
              setActionMessage({
                tone: "error",
                text: error?.message ?? "Could not publish this widget.",
              });
            },
          },
        );
      } catch (error) {
        setActionMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "Could not check publish readiness.",
        });
      } finally {
        setCheckingPublish(false);
      }
      return;
    }

    setActionMessage({ tone: "info", text: "Stopping live widget." });
    update.mutate(
      { id: siteId, isActive: false },
      {
        onSuccess: () => {
          setActionMessage({ tone: "success", text: "Widget moved back to draft." });
          router.refresh();
        },
        onError: (error) => {
          setActionMessage({
            tone: "error",
            text: error?.message ?? "Could not stop this widget.",
          });
        },
      },
    );
  }

  const primaryCta = useMemo(() => {
    if (dirty) return { kind: "save" as const, label: "Save changes" };
    if (!canDeploy) return { kind: "continue" as const, label: nextActionLabel };
    if (isActive) return { kind: "stop" as const, label: "Stop live widget" };
    return { kind: "deploy" as const, label: "Publish widget" };
  }, [dirty, canDeploy, isActive, nextActionLabel]);

  const status = useMemo(() => {
    if (dirty) {
      return {
        icon: AlertCircle,
        label: "Unsaved changes",
        helper: "Save the current settings before publishing or testing the final install.",
        className: "border-amber-200 bg-amber-50 text-amber-900",
      };
    }
    if (isActive) {
      return {
        icon: CheckCircle2,
        label: "Live",
        helper: "The widget is published on allowed domains.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    }
    if (canDeploy) {
      return {
        icon: CheckCircle2,
        label: "Ready to publish",
        helper: "Knowledge is ready. Preview the widget, then publish when the install looks right.",
        className: "border-blue-200 bg-blue-50 text-blue-800",
      };
    }
    if (next.id === "branding") {
      return {
        icon: AlertCircle,
        label: "Website URL needed",
        helper: "Set the website URL before the widget can be installed or published.",
        className: "border-gray-200 bg-gray-50 text-gray-700",
      };
    }
    if (next.id === "behavior") {
      return {
        icon: AlertCircle,
        label: "Allowed domains needed",
        helper: "Choose where the widget is allowed to load before publishing.",
        className: "border-gray-200 bg-gray-50 text-gray-700",
      };
    }
    return {
      icon: AlertCircle,
      label: "Knowledge needed",
      helper: "Add trusted pages before the widget can answer visitors.",
      className: "border-gray-200 bg-gray-50 text-gray-700",
    };
  }, [canDeploy, dirty, isActive, next.id]);

  const StatusIcon = status.icon;

  return (
    <div className={`rounded-lg border border-gray-200 bg-white shadow-sm ${compact ? "p-4" : "p-6"}`}>
      <div className={compact ? "space-y-2" : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
              <Rocket className="h-4 w-4" aria-hidden />
            </span>
            <h2 className={compact ? "text-sm font-semibold text-gray-900" : "text-lg font-semibold text-gray-900"}>
              Launch checklist
            </h2>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden />
              {status.label}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {completed}/{steps.length} ready
            {isActive ? " · widget is live" : ""}
          </p>
          {!compact ? (
            <p className="mt-1 max-w-2xl text-sm text-gray-500">{status.helper}</p>
          ) : null}
        </div>
        {!compact ? (
          <div className="flex flex-col gap-2 sm:items-end">
            {primaryCta.kind === "continue" ? (
              <Link
                href={nextActionHref}
                className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800"
              >
                {primaryCta.label}
              </Link>
            ) : (
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => void handlePrimaryAction(primaryCta.kind)}
                className="inline-flex items-center justify-center rounded-lg bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-60"
              >
                {primaryCta.kind === "save" && !actionBusy ? (
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                ) : null}
                {checkingPublish ? "Checking…" : update.isPending ? "Working…" : primaryCta.label}
              </button>
            )}
            <Link
              href={`/widget-demo?siteId=${siteId}&url=${encodeURIComponent(primaryOrigin || "https://example.com/")}`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10 focus-visible:ring-offset-2"
            >
              Preview widget
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
            {actionMessage ? (
              <div
                role="status"
                aria-live="polite"
                className={`max-w-full rounded-lg border px-3 py-2 text-xs font-medium sm:max-w-[18rem] ${
                  actionMessage.tone === "error"
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : actionMessage.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-gray-200 bg-gray-50 text-gray-700"
                }`}
              >
                {actionMessage.text}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div
          className={`mt-4 rounded-lg border px-3 py-3 ${
            canDeploy && !dirty
              ? "border-blue-100 bg-blue-50/70"
              : "border-gray-200 bg-gray-50"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-gray-400">Launch progress</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">{launchProgressText}</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {launchRequirements.map((item) => (
                <Link
                  key={item.fullLabel}
                  href={item.href}
                  className={`inline-flex min-h-7 items-center justify-center rounded-md border px-2 text-[11px] font-semibold ${
                    item.done
                      ? "border-green-200 bg-white text-green-700"
                      : item === missingRequirements[0]
                        ? "border-blue-200 bg-white text-blue-700"
                        : "border-gray-200 bg-white text-gray-500"
                  }`}
                  title={item.fullLabel}
                >
                  {item.done ? <Check className="mr-1 h-3 w-3" aria-hidden /> : null}
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`grid gap-2 ${compact ? "mt-4" : "mt-5 sm:grid-cols-2"}`}>
        {steps.map((s) => {
          const isNext = s.id === next.id && !s.done;
          const statusLabel = s.done ? "Ready" : isNext ? "Next" : "Waiting";
          const statusNode =
            s.id === "knowledge" && s.done && livePineconeNamespace ? (
              <span className={`${compact ? "shrink-0" : "hidden max-w-[240px] shrink-0 truncate sm:block"} text-xs font-semibold text-green-700`}>
                Knowledge ready
              </span>
            ) : s.id === "embed" && s.done ? (
              <span className="shrink-0 text-xs font-semibold text-green-700">
                Live
              </span>
            ) : (
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                  s.done
                    ? "border-green-200 bg-green-50 text-green-700"
                    : isNext
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
              >
                {statusLabel}
              </span>
            );

          return (
            <Link
              key={s.id}
              href={s.href}
              className={`group min-w-0 rounded-lg border border-gray-200 bg-white transition-all hover:border-gray-300 hover:shadow-sm ${
                compact ? "flex items-center justify-between gap-2" : "flex items-start justify-between gap-3"
              } ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                    s.done
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-gray-200 bg-gray-50 text-gray-500 group-hover:border-gray-300 group-hover:bg-white group-hover:text-gray-800"
                  }`}
                  aria-hidden="true"
                >
                  {s.done ? (
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-gray-900">{s.title}</span>
                  {!compact ? (
                    <span className="mt-1 block text-xs leading-5 text-gray-500">
                      {s.description}
                    </span>
                  ) : null}
                </span>
              </div>

              {statusNode}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
