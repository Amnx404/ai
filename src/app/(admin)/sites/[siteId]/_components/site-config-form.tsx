"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type Site } from "@prisma/client";

import { api } from "~/trpc/react";

const MODELS = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (default)" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

export function SiteConfigForm({ site }: { site: Site }) {
  const router = useRouter();
  const [tab, setTab] = useState<"branding" | "behavior" | "knowledge">(
    "branding"
  );

  const [form, setForm] = useState({
    name: site.name,
    primaryColor: site.primaryColor,
    title: site.title,
    greeting: site.greeting,
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

  function save() {
    updateSite.mutate({
      id: site.id,
      name: form.name,
      primaryColor: form.primaryColor,
      title: form.title,
      greeting: form.greeting,
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
