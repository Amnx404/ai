"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function SiteActiveToggle({
  siteId,
  isActive,
}: {
  siteId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [local, setLocal] = useState(isActive);

  const update = api.sites.update.useMutation({
    onSuccess: () => {
      router.refresh();
    },
  });

  return (
    <button
      type="button"
      disabled={update.isPending}
      onClick={() => {
        const next = !local;
        setLocal(next);
        update.mutate({ id: siteId, isActive: next });
      }}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
        local
          ? "bg-gray-900 text-white hover:bg-gray-800"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}
      title={local ? "Stop (disable) the site" : "Deploy (enable) the site"}
    >
      {local ? "Stop" : "Deploy"}
    </button>
  );
}

