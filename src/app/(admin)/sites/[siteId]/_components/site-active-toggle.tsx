"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { Switch } from "~/components/ui/switch";
import { Button } from "~/components/ui/button";

export function SiteActiveToggle({
  siteId,
  isActive,
}: {
  siteId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(isActive);
  const [canDeploy, setCanDeploy] = useState(true);
  const [deployReason, setDeployReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const update = api.sites.update.useMutation({
    onSuccess: () => {
      router.refresh();
    },
  });

  useEffect(() => {
    setLocal(isActive);
  }, [isActive]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setChecking(true);
      try {
        const res = await fetch(`/api/v1/sites/deployable?siteId=${encodeURIComponent(siteId)}`);
        const json = (await res.json().catch(() => null)) as any;
        if (cancelled) return;
        if (!res.ok) {
          setCanDeploy(false);
          setDeployReason(json?.error ?? "Not deployable");
          return;
        }
        setCanDeploy(Boolean(json?.canDeploy));
        setDeployReason(typeof json?.reason === "string" ? json.reason : null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [siteId, local]);

  return (
    <div className="flex items-center gap-3">
      {local ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={update.isPending}
            onClick={() => update.mutate({ id: siteId, isActive: false })}
          >
            Stop
          </Button>
        </>
      ) : (
        <>
          <Button
            type="button"
            size="sm"
            disabled={checking || update.isPending || !canDeploy}
            onClick={() => update.mutate({ id: siteId, isActive: true })}
            title={!canDeploy ? deployReason ?? undefined : undefined}
          >
            {checking ? "Checking…" : "Deploy"}
          </Button>
        </>
      )}
    </div>
  );
}

