"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, MessageSquareText, PlayCircle } from "lucide-react";

function findWidgetShadow() {
  const host = document.getElementById("rr-chat-widget");
  return host?.shadowRoot ?? null;
}

function mountedWidgetParts() {
  const shadow = findWidgetShadow();
  if (!shadow) return null;

  const panel = shadow.getElementById("panel");
  const launcher = shadow.getElementById("launcher") as HTMLButtonElement | null;
  if (!panel || !launcher) return null;

  return { shadow, panel, launcher };
}

function openMountedWidget() {
  const mounted = mountedWidgetParts();
  if (!mounted) return null;

  const { shadow, panel, launcher } = mounted;
  if (launcher && !panel?.classList.contains("open")) {
    launcher.click();
  }

  return shadow;
}

export function WidgetDemoControls({
  prompts,
  canTestAnswers,
  blockedReason,
  actionHref,
  actionLabel,
  className = "",
}: {
  prompts: string[];
  canTestAnswers: boolean;
  blockedReason: string;
  actionHref: string;
  actionLabel: string;
  className?: string;
}) {
  const [notice, setNotice] = useState("");
  const [widgetReady, setWidgetReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      if (!cancelled) setWidgetReady(Boolean(mountedWidgetParts()));
    };

    check();
    const interval = window.setInterval(check, 250);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  function openWidget() {
    const shadow = openMountedWidget();
    if (!shadow) {
      setNotice("Widget is still loading.");
      return;
    }
    setNotice(
      canTestAnswers
        ? "Widget opened."
        : "Preview opened. Answers stay locked until setup is ready.",
    );
  }

  function stagePrompt(prompt: string) {
    const shadow = openMountedWidget();
    if (!shadow) {
      setNotice("Widget is still loading.");
      return;
    }

    if (!canTestAnswers) {
      setNotice(blockedReason);
      return;
    }

    const input = shadow.getElementById("input") as HTMLTextAreaElement | null;
    if (!input || input.disabled) {
      setNotice(blockedReason);
      return;
    }

    input.value = prompt;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
    setNotice("Question staged in widget.");
  }

  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex flex-col gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquareText className="h-4 w-4 text-gray-600" aria-hidden />
            <h2 className="text-sm font-semibold text-gray-900">Widget test</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {canTestAnswers
              ? "Use real visitor questions against the mounted widget."
              : blockedReason}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!canTestAnswers ? (
            <Link
              href={actionHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
          <button
            type="button"
            onClick={openWidget}
            disabled={!widgetReady}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-gray-950 px-3 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-wait disabled:bg-gray-300 disabled:text-gray-600"
          >
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
            {!widgetReady
              ? "Loading widget"
              : canTestAnswers
                ? "Open widget"
                : "Open preview widget"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => stagePrompt(prompt)}
            aria-disabled={!canTestAnswers}
            disabled={!canTestAnswers}
            className={`min-h-10 rounded-lg border px-3 py-2 text-left text-xs font-semibold leading-5 transition-colors ${
              canTestAnswers
                ? "border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300 hover:bg-white"
                : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            {prompt}
          </button>
        ))}
      </div>

      {notice ? (
        <div
          className={`mt-3 flex flex-col gap-2 rounded-lg border px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between ${
            canTestAnswers
              ? "border-gray-200 bg-gray-50 text-gray-600"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          <span className="font-medium">{notice}</span>
          {!canTestAnswers ? (
            <Link
              href={actionHref}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 font-semibold text-amber-950 shadow-sm ring-1 ring-amber-200 hover:bg-amber-50"
            >
              {actionLabel}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}

      {!canTestAnswers && !notice ? (
        <p className="mt-3 text-xs leading-5 text-gray-500">
          Sample questions unlock after this setup step is finished.
        </p>
      ) : null}
    </div>
  );
}
