"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "~/trpc/react";

export function GettingStarted({
  siteId,
  primaryUrl,
  allowedDomainsCount,
  livePineconeNamespace,
  isActive,
}: {
  siteId: string;
  primaryUrl: string;
  allowedDomainsCount: number;
  livePineconeNamespace: string | null;
  isActive: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const setup = sp.get("setup") === "1";
  const [dirty, setDirty] = useState(false);

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
      title: "Branding + primary URL",
      done: primaryUrl.trim().length > 0,
      href: `/sites/${siteId}?tab=branding${setup ? "&setup=1" : ""}`,
    },
    {
      id: "behavior",
      title: "Allowed domains (security)",
      done: allowedDomainsCount > 0,
      href: `/sites/${siteId}?tab=behavior${setup ? "&setup=1" : ""}`,
    },
    {
      id: "knowledge",
      title: "Scrape knowledge base",
      done: !!livePineconeNamespace,
      href: `/sites/${siteId}?tab=knowledge${setup ? "&setup=1" : ""}`,
    },
    {
      id: "embed",
      title: "Embed on your site",
      done: false,
      href: `#embed`,
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? steps[steps.length - 1]!;
  const canDeploy = !!livePineconeNamespace;

  const update = api.sites.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const primaryCta = useMemo(() => {
    if (dirty) return { kind: "save" as const, label: "Save changes" };
    if (!canDeploy) return { kind: "continue" as const, label: "Continue setup" };
    if (isActive) return { kind: "stop" as const, label: "Stop" };
    return { kind: "deploy" as const, label: "Deploy" };
  }, [dirty, canDeploy, isActive]);

  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Setup</h2>
          <p className="mt-1 text-sm text-gray-600">
            {completed}/{steps.length} configured
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {primaryCta.kind === "continue" ? (
            <Link
              href={next.href}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              {primaryCta.label}
            </Link>
          ) : (
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => {
                if (primaryCta.kind === "save") {
                  window.dispatchEvent(new CustomEvent("site:request-save"));
                  return;
                }
                if (primaryCta.kind === "deploy") {
                  update.mutate({ id: siteId, isActive: true });
                  return;
                }
                if (primaryCta.kind === "stop") {
                  update.mutate({ id: siteId, isActive: false });
                  return;
                }
              }}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {update.isPending ? "Working…" : primaryCta.label}
            </button>
          )}
          <Link
            href={`/widget-demo?siteId=${siteId}&url=${encodeURIComponent(primaryOrigin || "https://example.com/")}`}
            className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Preview widget
          </Link>
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className="group flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border ${
                  s.done
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-gray-200 bg-gray-50 text-gray-500 group-hover:border-indigo-200 group-hover:bg-indigo-50 group-hover:text-indigo-700"
                }`}
                aria-hidden="true"
              >
                {s.done ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                    <path d="M9 16.2l-3.5-3.5L4 14.2l5 5 12-12-1.5-1.5L9 16.2z" />
                  </svg>
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className="text-sm font-semibold text-gray-900">{s.title}</span>
            </div>

            {s.id === "knowledge" && s.done && livePineconeNamespace ? (
              <span className="hidden max-w-[240px] truncate font-mono text-xs text-gray-500 sm:block">
                {livePineconeNamespace}
              </span>
            ) : (
              <span className="text-xs font-semibold text-gray-500">
                {s.done ? "Done" : "Next"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

