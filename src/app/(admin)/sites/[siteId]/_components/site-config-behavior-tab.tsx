"use client";

import { Field, inputCls } from "./site-config-form.ui";

export function SiteConfigBehaviorTab({
  form,
  setForm,
  plan,
  models,
  freeModelId,
}: {
  form: {
    allowedDomains: string;
    allowedTopics: string;
    modelId: string;
    temperature: number;
  };
  setForm: (next: typeof form) => void;
  plan: "FREE" | "PRO" | "MAX";
  models: Array<{ id: string; label: string }>;
  freeModelId: string;
}) {
  return (
    <>
      <Field
        label="Allowed domains"
        hint="Comma-separated. Includes your app + primary URL by default."
      >
        <div className="space-y-2">
          <input
            value={form.allowedDomains}
            onChange={(e) => setForm({ ...form, allowedDomains: e.target.value })}
            placeholder="example.com, app.example.com"
            className={inputCls}
          />
          <span className="text-[11px] text-gray-500">
            Example: <span className="font-mono">example.com</span>
          </span>
        </div>
      </Field>
      <Field
        label="Allowed topics / scope"
        hint="Keywords that define what the widget answers. Comma-separated."
      >
        <input
          value={form.allowedTopics}
          onChange={(e) => setForm({ ...form, allowedTopics: e.target.value })}
          placeholder="pricing, features, docs"
          className={inputCls}
        />
      </Field>
      <Field label="Model">
        <select
          value={form.modelId}
          onChange={(e) => setForm({ ...form, modelId: e.target.value })}
          className={inputCls}
        >
          {models.map((m) => {
            const disabled = plan === "FREE" && m.id !== freeModelId;
            return (
              <option key={m.id} value={m.id} disabled={disabled}>
                {disabled ? `${m.label} — Pro/Max` : m.label}
              </option>
            );
          })}
        </select>
      </Field>
      <Field label={`Temperature: ${form.temperature}`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={form.temperature}
          onChange={(e) =>
            setForm({ ...form, temperature: parseFloat(e.target.value) })
          }
          className="w-full accent-indigo-600"
        />
      </Field>
    </>
  );
}

