"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";

export function SiteActiveSwitch({
  siteId,
  isActive,
  canActivate,
  limitLabel,
}: {
  siteId: string;
  isActive: boolean;
  canActivate: boolean;
  limitLabel: string;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(isActive);
  useEffect(() => setLocal(isActive), [isActive]);
  const [checking, setChecking] = useState(false);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const update = api.sites.update.useMutation();
  const disabled = checking || update.isPending || (!local && !canActivate);

  return (
    <div
      title={
        local
          ? "Deactivate site"
          : !canActivate
            ? `Upgrade to activate more sites (${limitLabel})`
            : blockedReason
              ? blockedReason
              : checking
                ? "Checking…"
                : "Activate site"
      }
      onClick={(e) => {
        // This component is often rendered inside a clickable card/link.
        // Prevent accidental navigation when toggling.
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        // Some browsers/controls trigger navigation on pointerdown before click.
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <Switch
        checked={local}
        disabled={disabled}
        onCheckedChange={async (checked) => {
          if (!local && !canActivate) return;
          setBlockedReason(null);

          // Turning ON: run server-side deployability checks first.
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
                    "Not deployable",
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
                    setBlockedReason(e?.message ?? "Could not deploy");
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
            ? "data-[state=checked]:bg-gray-300 data-[state=checked]:border-gray-300"
            : undefined
        }
        aria-label={local ? "Deactivate site" : "Activate site"}
      />
    </div>
  );
}

