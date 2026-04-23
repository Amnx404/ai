"use client";

import { Field, inputCls } from "./site-config-form.ui";

export function SiteConfigBrandingTab({
  form,
  setForm,
  onPersist,
}: {
  form: {
    name: string;
    primaryUrl: string;
    primaryColor: string;
    title: string;
    logoUrl: string;
    greeting: string;
  };
  setForm: (next: typeof form) => void;
  onPersist: () => void;
}) {
  return (
    <>
      <Field label="Site name">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={onPersist}
          className={inputCls}
        />
      </Field>
      <Field label="Primary URL" hint="Where your widget will be embedded.">
        <input
          value={form.primaryUrl}
          onChange={(e) => setForm({ ...form, primaryUrl: e.target.value })}
          onBlur={onPersist}
          placeholder="https://client.com"
          className={inputCls}
        />
      </Field>
      <div className="flex gap-4">
        <Field label="Primary color" className="flex-1">
          <div className="flex gap-2">
            <input
              type="color"
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              onBlur={onPersist}
              className="h-9 w-12 rounded-lg border border-gray-300 p-0.5 cursor-pointer"
            />
            <input
              value={form.primaryColor}
              onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              onBlur={onPersist}
              className={`${inputCls} flex-1`}
              placeholder="#6366f1"
            />
          </div>
        </Field>
        <Field label="Widget title" className="flex-1">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onBlur={onPersist}
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Logo" hint="Upload a logo (stored in Postgres as base64). Optional.">
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
                  window.setTimeout(() => onPersist(), 0);
                }
              };
              reader.readAsDataURL(file);
            }}
            className="block text-sm text-gray-700"
          />
          {form.logoUrl && (
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, logoUrl: "" });
                window.setTimeout(() => onPersist(), 0);
              }}
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
          onChange={(e) => setForm({ ...form, greeting: e.target.value })}
          onBlur={onPersist}
          rows={3}
          className={`${inputCls} resize-none`}
        />
      </Field>
    </>
  );
}

