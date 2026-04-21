"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Site } from "@prisma/client";

import { resolvePineconeTarget } from "~/lib/pinecone-resolve";
import { api } from "~/trpc/react";

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

export function SiteConfigForm({
  site,
  defaultPineconeIndex,
  defaultPineconeIndexHost,
}: {
  site: Site;
  defaultPineconeIndex: string;
  defaultPineconeIndexHost: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"branding" | "behavior" | "knowledge">(
    "branding"
  );

  const [form, setForm] = useState({
    name: site.name,
    primaryColor: site.primaryColor,
    title: site.title,
    greeting: site.greeting,
    primaryUrl: site.primaryUrl ?? "",
    logoUrl: site.logoUrl ?? "",
    allowedDomains: site.allowedDomains.join(", "),
    allowedTopics: site.allowedTopics.join(", "),
    modelId: site.modelId,
    temperature: site.temperature,
    pineconeIndex: site.pineconeIndex ?? "",
    pineconeNs: site.pineconeNs ?? "",
    liveVersion: site.liveVersion,
    isActive: site.isActive,
  });

  const updateSite = api.sites.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const resolvedPinecone = resolvePineconeTarget(
    {
      id: site.id,
      liveVersion: form.liveVersion,
      pineconeIndex: form.pineconeIndex || null,
      pineconeNs: form.pineconeNs || null,
    },
    defaultPineconeIndex,
    defaultPineconeIndexHost || undefined,
  );

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
      pineconeIndex: form.pineconeIndex || null,
      pineconeNs: form.pineconeNs || null,
      liveVersion: form.liveVersion,
      isActive: form.isActive,
    });
  }

  const tabs = [
    { id: "branding" as const, label: "Branding" },
    { id: "behavior" as const, label: "Behavior" },
    { id: "knowledge" as const, label: "Knowledge Base" },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Tabs */}
      <div className="flex border-b border-gray-200 px-2 pt-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-5">
        {tab === "branding" && (
          <>
            <Field label="Site name">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                onChange={(e) =>
                  setForm({ ...form, greeting: e.target.value })
                }
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>

            <Field
              label="Demo site preview"
              hint="Open a mock page with the widget loaded. Paste the site's primary URL to use its favicon for the launcher."
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  value={form.primaryUrl}
                  onChange={(e) =>
                    setForm({ ...form, primaryUrl: e.target.value })
                  }
                  placeholder="https://client.com"
                  className={`${inputCls} flex-1`}
                />
                <a
                  href={`/widget-demo?siteId=${encodeURIComponent(
                    site.id,
                  )}&url=${encodeURIComponent(form.primaryUrl || "https://example.com")}`}
                  target="_blank"
                  rel="noopener"
                  className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors ${
                    form.primaryUrl.trim()
                      ? "bg-gray-900 hover:bg-gray-800"
                      : "bg-gray-300 cursor-not-allowed"
                  }`}
                  onClick={(e) => {
                    if (!form.primaryUrl.trim()) e.preventDefault();
                  }}
                >
                  Open demo
                </a>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Tip: upload a Logo above to override the launcher icon.
              </p>
            </Field>
            <div className="flex items-center gap-2">
              <input
                id="isActive"
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="h-4 w-4 rounded border-gray-300 text-indigo-600"
              />
              <label htmlFor="isActive" className="text-sm text-gray-700">
                Site is active
              </label>
            </div>
          </>
        )}

        {tab === "behavior" && (
          <>
            <Field
              label="Allowed domains"
              hint="Leave empty to allow all. Comma-separated."
            >
              <input
                value={form.allowedDomains}
                onChange={(e) =>
                  setForm({ ...form, allowedDomains: e.target.value })
                }
                placeholder="example.com, app.example.com"
                className={inputCls}
              />
            </Field>
            <Field
              label="Allowed topics / scope"
              hint="Keywords that define what the widget answers. Comma-separated."
            >
              <input
                value={form.allowedTopics}
                onChange={(e) =>
                  setForm({ ...form, allowedTopics: e.target.value })
                }
                placeholder="pricing, features, docs"
                className={inputCls}
              />
            </Field>
            <Field label="Model">
              <select
                value={form.modelId}
                onChange={(e) =>
                  setForm({ ...form, modelId: e.target.value })
                }
                className={inputCls}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`Temperature: ${form.temperature}`}>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-600"
              />
            </Field>
          </>
        )}

        {tab === "knowledge" && (
          <>
            <Field
              label="Pinecone index"
              hint="Leave empty to use the default index from env."
            >
              <input
                value={form.pineconeIndex}
                onChange={(e) =>
                  setForm({ ...form, pineconeIndex: e.target.value })
                }
                placeholder="roboracer (default)"
                className={inputCls}
              />
            </Field>
            <Field
              label="Namespace override"
              hint="Default: site-{id}. Override if you're using a custom namespace."
            >
              <input
                value={form.pineconeNs}
                onChange={(e) =>
                  setForm({ ...form, pineconeNs: e.target.value })
                }
                placeholder="site-abc123"
                className={inputCls}
              />
            </Field>
            <Field label="Live version">
              <input
                type="number"
                min={1}
                value={form.liveVersion}
                onChange={(e) =>
                  setForm({ ...form, liveVersion: parseInt(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-gray-800">
              <p className="font-semibold text-indigo-900">
                Effective Pinecone target (chat + ingest)
              </p>
              <p className="mt-2 font-mono text-xs break-all">
                <span className="text-gray-500">index:</span>{" "}
                {resolvedPinecone.indexName}
                <span className="ml-2 text-gray-400">
                  ({resolvedPinecone.indexSource === "env" ? "from env" : "site override"})
                </span>
              </p>
              {resolvedPinecone.indexHostUrl ? (
                <p className="mt-1 font-mono text-xs break-all">
                  <span className="text-gray-500">host:</span>{" "}
                  {resolvedPinecone.indexHostUrl}
                  <span className="ml-2 text-gray-400">(from env)</span>
                </p>
              ) : (
                <p className="mt-1 font-mono text-xs break-all">
                  <span className="text-gray-500">host:</span>{" "}
                  <span className="text-gray-400">
                    (auto-resolved by Pinecone SDK)
                  </span>
                </p>
              )}
              <p className="mt-1 font-mono text-xs break-all">
                <span className="text-gray-500">namespace:</span>{" "}
                {resolvedPinecone.namespace}
                <span className="ml-2 text-gray-400">
                  (
                  {resolvedPinecone.namespaceSource === "derived"
                    ? `derived from site id + live v${form.liveVersion}`
                    : "site override"}
                  )
                </span>
              </p>
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
