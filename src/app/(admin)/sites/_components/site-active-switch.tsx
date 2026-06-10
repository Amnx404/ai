"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";

export function SiteActiveSwitch({
  siteId,
  siteName,
  isActive,
  canActivate,
  limitLabel,
  disabledReason,
}: {
  siteId: string;
  siteName?: string;
  isActive: boolean;
  canActivate: boolean;
  limitLabel: string;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(isActive);
  useEffect(() => setLocal(isActive), [isActive]);
  const [checking, setChecking] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const update = api.sites.update.useMutation();
  const disabled = checking || update.isPending || (!local && !canActivate);
  const actionLabel = local
    ? `Unpublish ${siteName ?? "widget"}`
    : `Publish ${siteName ?? "widget"}`;

  return (
    <div
      title={
        local
          ? "Unpublish widget"
          : !canActivate
            ? disabledReason ?? `Active widget limit reached (${limitLabel})`
            : blockedReason
              ? blockedReason
              : checking
                ? "Checking…"
                : "Publish widget"
      }
      className="flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold text-gray-600">
          {checking || update.isPending ? "Saving" : local ? "Live" : "Draft"}
        </span>
        <Switch
          checked={local}
          disabled={disabled}
          onCheckedChange={async (checked) => {
            if (!local && !canActivate) return;
            setBlockedReason(null);

            // Turning ON: run server-side publish checks first.
            if (checked) {
              setChecking(true);
              try {
                const res = await fetch(
                  `/api/v1/sites/deployable?siteId=${encodeURIComponent(siteId)}`,
                );
                const json = (await res.json().catch(() => null)) as any;
                const ok = res.ok && Boolean(json?.canDeploy);
                if (!ok) {
                  setBlockedReason(
                    (typeof json?.reason === "string" && json.reason) ||
                      (typeof json?.error === "string" && json.error) ||
                      "Not ready to publish",
                  );
                  setLocal(false);
                  return;
                }

                setLocal(true);
                update.mutate(
                  { id: siteId, isActive: true },
                  {
                    onSuccess: () => {
                      router.refresh();
                    },
                    onError: (e) => {
                      setBlockedReason(e?.message ?? "Could not publish");
                      setLocal(false);
                    },
                  },
                );
                return;
              } finally {
                setChecking(false);
              }
            }

            // Turning OFF: allow immediately.
            setLocal(false);
            update.mutate(
              { id: siteId, isActive: false },
              {
                onSuccess: () => {
                  router.refresh();
                },
                onError: (e) => {
                  setBlockedReason(e?.message ?? "Could not stop");
                  setLocal(true);
                },
              },
            );
          }}
          className={
            disabled
              ? "data-[state=checked]:border-gray-300 data-[state=checked]:bg-gray-300"
              : undefined
          }
          aria-label={actionLabel}
        />
      </div>
      {blockedReason ? (
        <p className="max-w-32 text-right text-[11px] font-medium leading-snug text-amber-700">
          {blockedReason}
        </p>
      ) : !local && !canActivate && disabledReason ? (
        <p className="max-w-32 text-right text-[11px] font-medium leading-snug text-amber-700">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}
