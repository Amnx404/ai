"use client";

import { useState } from "react";
import {
  Globe2,
  MessageSquareText,
  PlusCircle,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { normalizeAllowedDomains, splitDomainInput } from "~/lib/allowed-domains";
import { Field, inputCls } from "./site-config-form.ui";

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).join(", ");
}

function hostFromUrl(value: string) {
  try {
    return new URL(value.trim()).host;
  } catch {
    return "";
  }
}

function hasDomainShapeIssue(domain: string) {
  return /^https?:\/\//i.test(domain) || domain.includes("/");
}

export function SiteConfigBehaviorTab({
  form,
  setForm,
  plan,
  models,
  freeModelId,
  onPersist,
}: {
  form: {
    primaryUrl: string;
    allowedDomains: string;
    allowedTopics: string;
    modelId: string;
    temperature: number;
  };
  setForm: (next: typeof form) => void;
  plan: "FREE" | "PRO" | "MAX";
  models: Array<{ id: string; label: string }>;
  freeModelId: string;
  onPersist: () => void;
}) {
  const [domainDraft, setDomainDraft] = useState("");
  const [domainDraftError, setDomainDraftError] = useState("");
  const rawDomains = splitDomainInput(form.allowedDomains);
  const domains = normalizeAllowedDomains(rawDomains);
  const topics = splitList(form.allowedTopics);
  const primaryHost = hostFromUrl(form.primaryUrl);
  const missingPrimaryHost =
    primaryHost && !domains.some((domain) => domain.toLowerCase() === primaryHost.toLowerCase());
  const canonicalDomains = joinList(domains);
  const hasDomainWarning =
    rawDomains.some(hasDomainShapeIssue) ||
    (form.allowedDomains.trim().length > 0 && canonicalDomains !== joinList(rawDomains));
  const temperatureLabel =
    form.temperature <= 0.25
      ? "Precise"
      : form.temperature >= 0.7
        ? "Flexible"
        : "Balanced";
  const selectedModel = models.find((model) => model.id === form.modelId);
  const planModelCopy =
    plan === "FREE"
      ? "Free workspaces use the included model. Pro and Max unlock larger models for harder questions."
      : "This workspace can use the listed models. Choose a larger model when answer quality matters more than speed.";

  function commit(next: typeof form) {
    setForm(next);
    window.setTimeout(() => onPersist(), 0);
  }

  function commitDomains(nextDomains: string[]) {
    commit({ ...form, allowedDomains: joinList(nextDomains) });
  }

  function addDomains(raw: string) {
    const normalized = normalizeAllowedDomains(splitDomainInput(raw));
    if (!normalized.length) {
      if (raw.trim()) setDomainDraftError("Use a host like example.com or docs.example.com.");
      return;
    }
    setDomainDraft("");
    setDomainDraftError("");
    commitDomains([...domains, ...normalized]);
  }

  function removeDomain(domain: string) {
    commitDomains(domains.filter((item) => item !== domain));
  }

  const answerModes = [
    {
      label: "Precise",
      value: 0.2,
      description: "Best when answers should stay close to cited pages.",
    },
    {
      label: "Balanced",
      value: 0.45,
      description: "Good default for helpful answers with some wording flexibility.",
    },
    {
      label: "Flexible",
      value: 0.75,
      description: "More conversational when exact wording matters less.",
    },
  ];
  const selectedAnswerMode =
    form.temperature <= 0.25
      ? answerModes[0]
      : form.temperature >= 0.7
        ? answerModes[2]
        : answerModes[1];

  return (
    <div className="space-y-6">
      <section>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Guardrails</h3>
          <p className="mt-1 text-xs text-gray-500">
            Choose where the widget can load and which visitor questions it should answer.
          </p>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              label: "Embed access",
              value: domains.length ? `${domains.length} allowed` : "Missing",
              tone: domains.length ? "ok" : "warn",
            },
            {
              icon: MessageSquareText,
              label: "Visitor question focus",
              value: topics.length ? `${topics.length} topics` : "Knowledge decides",
              tone: topics.length ? "ok" : "muted",
            },
            {
              icon: SlidersHorizontal,
              label: "Answer mode",
              value: temperatureLabel,
              tone: "muted",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "rounded-lg border px-3 py-3",
                item.tone === "warn"
                  ? "border-amber-200 bg-amber-50"
                  : item.tone === "ok"
                    ? "border-emerald-200 bg-emerald-50/70"
                    : "border-gray-200 bg-gray-50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-gray-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-gray-900">{item.value}</p>
                </div>
                <item.icon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Field
            label="Allowed embed domains"
            hint="Published widgets load only on these hosts. Paste one or many domains, then add them to the list."
            controlId="allowed-embed-domains"
          >
            <div className="space-y-2">
              <div className="rounded-lg border border-gray-200 bg-white p-2">
                <div className="flex gap-2">
                  <input
                    id="allowed-embed-domains"
                    value={domainDraft}
                    onChange={(e) => {
                      setDomainDraft(e.target.value);
                      if (domainDraftError) setDomainDraftError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addDomains(domainDraft);
                      }
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (splitDomainInput(text).length > 1) {
                        e.preventDefault();
                        addDomains(text);
                      }
                    }}
                    onBlur={() => {
                      if (!domainDraft.trim()) onPersist();
                    }}
                    placeholder="docs.example.com"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => addDomains(domainDraft)}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800"
                  >
                    <PlusCircle className="h-3.5 w-3.5" aria-hidden />
                    Add
                  </button>
                </div>
                {domainDraftError ? (
                  <p className="mt-2 text-xs font-medium text-red-600">{domainDraftError}</p>
                ) : null}
                {domains.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {domains.map((domain) => (
                      <span
                        key={domain}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-[11px] font-semibold text-gray-700"
                      >
                        <span className="min-w-0 truncate">{domain}</span>
                        <button
                          type="button"
                          onClick={() => removeDomain(domain)}
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-gray-900"
                          aria-label={`Remove ${domain}`}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    Add at least one public domain before publishing.
                  </p>
                )}
              </div>
              {missingPrimaryHost ? (
                <button
                  type="button"
                  onClick={() =>
                    commitDomains([...domains, primaryHost])
                  }
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                >
                  <Globe2 className="h-3.5 w-3.5" aria-hidden />
                  Add {primaryHost}
                </button>
              ) : null}
              {hasDomainWarning ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                  <p>
                    Domains should look like <span className="font-mono">docs.example.com</span>, not
                    full URLs.
                  </p>
                  {canonicalDomains ? (
                    <button
                      type="button"
                      onClick={() => commitDomains(domains)}
                      className="mt-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-950 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50"
                    >
                      Use {canonicalDomains}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Field>
          <Field
            label="Visitor question topics"
            hint="Optional comma-separated topics. Use them to narrow the bot; leave blank when the indexed pages should decide what is answerable."
            controlId="allowed-topics"
          >
            <div className="space-y-2">
              <textarea
                id="allowed-topics"
                value={form.allowedTopics}
                onChange={(e) => setForm({ ...form, allowedTopics: e.target.value })}
                onBlur={onPersist}
                placeholder="races, build docs, registration"
                rows={2}
                className={cn(inputCls, "resize-none")}
              />
              {!topics.length ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                  No topic filter. The widget answers only when the indexed pages contain enough relevant context.
                </p>
              ) : null}
              {topics.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Field>
        </div>
      </section>

      <section className="border-t border-gray-200 pt-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Answer style</h3>
          <p className="mt-1 text-xs text-gray-500">
            Pick the model and how strictly answers should stay grounded in indexed pages.
          </p>
        </div>
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-3">
            <Field label="Model">
              <select
                value={form.modelId}
                onChange={(e) => setForm({ ...form, modelId: e.target.value })}
                onBlur={onPersist}
                className={inputCls}
              >
                {models.map((m) => {
                  const disabled = plan === "FREE" && m.id !== freeModelId;
                  return (
                    <option key={m.id} value={m.id} disabled={disabled}>
                      {disabled ? `${m.label} - Pro/Max` : m.label}
                    </option>
                  );
                })}
              </select>
            </Field>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 break-words text-sm font-semibold text-gray-900">
                  {selectedModel?.label ?? form.modelId}
                </p>
                <span className="w-fit rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                  {plan} plan
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">{planModelCopy}</p>
            </div>
          </div>
          <Field label={`Answer mode: ${temperatureLabel}`} controlId="answer-temperature">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="grid gap-1 rounded-lg bg-gray-50 p-1 sm:grid-cols-3 lg:grid-cols-1">
                {answerModes.map((mode) => {
                  const active = selectedAnswerMode?.label === mode.label;
                  return (
                    <button
                      key={mode.label}
                      type="button"
                      onClick={() => commit({ ...form, temperature: mode.value })}
                      className={cn(
                        "min-h-8 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-colors",
                        active
                          ? "bg-white text-gray-950 shadow-sm ring-1 ring-gray-200"
                          : "text-gray-600 hover:bg-white",
                      )}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-semibold text-gray-700">
                <span>{temperatureLabel}</span>
                <span className="tabular-nums text-gray-500">
                  {form.temperature.toFixed(2)}
                </span>
              </div>
              <input
                id="answer-temperature"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.temperature}
                onChange={(e) =>
                  setForm({ ...form, temperature: parseFloat(e.target.value) })
                }
                onBlur={onPersist}
                onPointerUp={onPersist}
                className="mt-2 w-full accent-gray-900"
              />
              <div className="mt-1 flex justify-between text-[11px] text-gray-400">
                <span>Exact</span>
                <span>Flexible</span>
              </div>
              <p className="mt-2 text-xs leading-4 text-gray-500">
                {
                  selectedAnswerMode?.description ?? "Custom setting between exact and flexible."
                }
              </p>
            </div>
          </Field>
        </div>
      </section>
    </div>
  );
}
