"use client";

import { useMemo, useState } from "react";

export const inputCls =
  "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function Field({
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

export function ProgressStep({
  label,
  state,
}: {
  label: string;
  state: "not_started" | "in_progress" | "done" | "failed";
}) {
  const isProcessing = state === "in_progress";
  const isDone = state === "done";
  const isFailed = state === "failed";

  return (
    <div
      className={`relative flex min-h-[2.5rem] items-center gap-2 overflow-hidden rounded-lg border px-3 py-2 ${
        isFailed
          ? "border-red-200 bg-red-50/80"
          : isProcessing
            ? "border-amber-200 bg-amber-50/60"
            : isDone
              ? "border-emerald-200 bg-emerald-50/70"
              : "border-gray-200 bg-white"
      }`}
    >
      <span className="relative z-[1] flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        {isProcessing ? (
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        ) : (
          <span
            className={`inline-flex h-2.5 w-2.5 rounded-full ${
              isFailed ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-gray-300"
            }`}
          />
        )}
      </span>
      <span
        className={`relative z-[1] text-xs font-medium ${
          isProcessing
            ? "text-amber-900"
            : isFailed
              ? "text-red-800"
              : isDone
                ? "text-emerald-900"
                : "text-gray-700"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function UrlListInput({
  value,
  onChange,
  placeholder,
  normalize,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  normalize: (raw: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>("");

  const items = useMemo(() => {
    return value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [value]);

  const shouldScroll = items.length > 3;

  const extractAllNormalized = (raw: string) => {
    const s = raw.trim();
    if (!s) return [];
    const matches = s.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
    const candidates =
      matches.length > 0
        ? matches
        : [
            // Fall back to single entry behavior when there's no explicit scheme in the string.
            s,
          ];

    return candidates
      .map((c) => normalize(c))
      .map((c) => c.replace(/[),.;]+$/g, ""))
      .filter(Boolean);
  };

  const commit = (raw: string) => {
    const normalized = extractAllNormalized(raw);
    if (!normalized.length) return;

    for (const n of normalized) {
      try {
        const u = new URL(n);
        if (u.protocol !== "https:") {
          setError("Must be an https URL.");
          return;
        }
      } catch {
        setError("Invalid URL.");
        return;
      }
    }

    setError("");
    const nextItems = Array.from(new Set([...items, ...normalized]));
    onChange(nextItems.join("\n"));
    setDraft("");
  };

  const remove = (idx: number) => {
    const nextItems = items.filter((_, i) => i !== idx);
    onChange(nextItems.join("\n"));
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            }
          }}
          onBlur={() => {
            if (!draft.trim()) return;
            // Helpful: normalize on blur but don't auto-add unless it's valid.
            const n = normalize(draft);
            if (n !== draft) setDraft(n);
          }}
          className={`${inputCls} font-mono text-xs`}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          className="shrink-0 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
        >
          Add
        </button>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}

      {items.length ? (
        <div
          className={`mt-2 space-y-1 ${
            shouldScroll ? "max-h-28 overflow-auto pr-1" : ""
          }`}
        >
          {items.map((u, idx) => (
            <div
              key={`${u}-${idx}`}
              className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-800">
                {u}
              </span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-white hover:text-gray-900"
                aria-label={`Remove ${u}`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-400">Add one or more URLs.</p>
      )}
    </div>
  );
}

