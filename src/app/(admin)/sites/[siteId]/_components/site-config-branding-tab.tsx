"use client";

import { CheckCircle2, Globe2, ImagePlus, MessageCircle, Palette } from "lucide-react";

import { cn } from "~/lib/utils";
import { Field, inputCls } from "./site-config-form.ui";

const COLOR_SWATCHES = ["#2563eb", "#0f766e", "#7c3aed", "#dc2626", "#111827"];

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
}

function parseHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

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
  const previewTitle = form.title.trim() || "Chat";
  const previewGreeting = form.greeting.trim() || "Hi! How can I help you today?";
  const previewColor = isHexColor(form.primaryColor) ? form.primaryColor : "#6366f1";
  const primaryUrl = parseHttpsUrl(form.primaryUrl);
  const identityComplete = Boolean(form.name.trim() && primaryUrl);
  const appearanceComplete = Boolean(form.title.trim() && isHexColor(form.primaryColor));

  function commit(next: typeof form) {
    setForm(next);
    window.setTimeout(() => onPersist(), 0);
  }

  return (
    <div className="space-y-6">
      <section>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Widget identity</h3>
          <p className="mt-1 text-xs text-gray-500">
            Name this widget and set the public website it belongs to.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: CheckCircle2,
              label: "Widget",
              value: identityComplete ? "Ready" : "Needs URL",
              tone: identityComplete ? "ok" : "warn",
            },
            {
              icon: Globe2,
              label: "Website",
              value: primaryUrl?.host ?? "Missing",
              tone: primaryUrl ? "ok" : "warn",
            },
            {
              icon: Palette,
              label: "Appearance",
              value: appearanceComplete ? "Configured" : "Needs title",
              tone: appearanceComplete ? "ok" : "muted",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-lg border px-3 py-3",
                item.tone === "ok"
                  ? "border-emerald-200 bg-emerald-50/70"
                  : item.tone === "warn"
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 bg-gray-50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-gray-900">
                    {item.value}
                  </p>
                </div>
                <item.icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Widget name" hint="Internal name shown in the console. Visitors do not see this.">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={onPersist}
              className={inputCls}
            />
          </Field>
          <Field
            label="Website URL"
            hint="The main public page this widget represents."
            controlId="site-primary-url"
          >
            <input
              id="site-primary-url"
              value={form.primaryUrl}
              onChange={(e) => setForm({ ...form, primaryUrl: e.target.value })}
              onBlur={onPersist}
              placeholder="https://docs.example.com/"
              className={inputCls}
            />
            {!primaryUrl && form.primaryUrl.trim() ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                Use a public https URL, like{" "}
                <span className="font-mono">https://docs.example.com</span>.
              </p>
            ) : null}
          </Field>
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Widget appearance</h3>
          <p className="mt-1 text-xs text-gray-500">
            Logo, title, color, and greeting shown to visitors in the launcher and chat header.
          </p>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Primary color" controlId="site-primary-color-hex">
                <div className="flex gap-2">
                  <input
                    type="color"
                    aria-label="Primary color picker"
                    value={previewColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    onBlur={onPersist}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-gray-300 p-0.5"
                  />
                  <input
                    id="site-primary-color-hex"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    onBlur={onPersist}
                    className={`${inputCls} flex-1 font-mono`}
                    placeholder="#6366f1"
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => commit({ ...form, primaryColor: color })}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                        previewColor.toLowerCase() === color
                          ? "border-gray-900"
                          : "border-white ring-1 ring-gray-200",
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Use color ${color}`}
                      title={color}
                    />
                  ))}
                </div>
                {!isHexColor(form.primaryColor) ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    Use a six-digit hex color, like <span className="font-mono">#2563eb</span>.
                  </p>
                ) : null}
              </Field>
              <Field
                label="Widget title"
                hint="Visible in the chat header. Keep it short enough to fit on mobile."
              >
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  onBlur={onPersist}
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Logo" hint="Square images work best in the launcher and chat header.">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-white">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={form.logoUrl}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="text-xs font-medium text-gray-400">Logo</div>
                  )}
                </div>
                <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  <ImagePlus className="mr-2 h-4 w-4" aria-hidden />
                  Upload logo
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
                    className="hidden"
                  />
                </label>
                {form.logoUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({ ...form, logoUrl: "" });
                      window.setTimeout(() => onPersist(), 0);
                    }}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </Field>

            <Field label="Greeting message" hint="First message visitors see when the chat opens.">
              <textarea
                value={form.greeting}
                onChange={(e) => setForm({ ...form, greeting: e.target.value })}
                onBlur={onPersist}
                rows={3}
                className={`${inputCls} resize-none`}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-600">Widget preview</p>
              <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                {primaryUrl?.host ?? "No website"}
              </span>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
              <div
                className="flex items-center gap-2 rounded-t-lg px-3 py-2 text-white"
                style={{ backgroundColor: previewColor }}
              >
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg bg-white/95 text-xs font-semibold text-gray-700">
                  {form.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    previewTitle.slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="truncate text-sm font-semibold">{previewTitle}</span>
              </div>
              <div className="space-y-2 p-3">
                <div className="max-w-[88%] rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-800">
                  {previewGreeting}
                </div>
                <div
                  className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-white shadow-sm"
                  style={{ backgroundColor: previewColor }}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
