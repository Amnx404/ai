"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { api } from "~/trpc/react";

export function CreateSiteButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [domains, setDomains] = useState("");
  const router = useRouter();

  const createSite = api.sites.create.useMutation({
    onSuccess: (site) => {
      setOpen(false);
      setName("");
      setPrimaryUrl("");
      setDomains("");
      router.push(`/sites/${site.id}`);
      router.refresh();
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
      >
        + New site
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-lg font-bold text-gray-900">
              Create new site
            </h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Site name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Docs"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Primary URL{" "}
                  <span className="font-normal text-gray-400">(required)</span>
                </label>
                <input
                  value={primaryUrl}
                  onChange={(e) => setPrimaryUrl(e.target.value)}
                  placeholder="https://client.com"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Used for demo preview and favicon-based widget icon.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Allowed domains{" "}
                  <span className="font-normal text-gray-400">(optional, comma-separated)</span>
                </label>
                <input
                  value={domains}
                  onChange={(e) => setDomains(e.target.value)}
                  placeholder="example.com, app.example.com"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!name.trim()) return;
                  createSite.mutate({
                    name: name.trim(),
                    primaryUrl: primaryUrl.trim(),
                    allowedDomains: domains
                      .split(",")
                      .map((d) => d.trim())
                      .filter(Boolean),
                  });
                }}
                disabled={!name.trim() || !primaryUrl.trim() || createSite.isPending}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {createSite.isPending ? "Creating…" : "Create"}
              </button>
            </div>

            {createSite.error && (
              <p className="mt-3 text-xs text-red-600">
                {createSite.error.message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
