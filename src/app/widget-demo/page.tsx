import Script from "next/script";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Palette,
  Rocket,
} from "lucide-react";

import { env } from "~/env.js";
import { getUserFacingAllowedDomains } from "~/lib/allowed-domains";
import { db } from "~/server/db";
import { WidgetDemoControls } from "./widget-demo-controls";

function safeOrigin(input: string | undefined) {
  if (!input) return null;
  try {
    return new URL(input).origin;
  } catch {
    return null;
  }
}

function hostLabel(input: string | null | undefined) {
  if (!input) return "example.com";
  try {
    return new URL(input).hostname.replace(/^www\./, "");
  } catch {
    return input;
  }
}

function WidgetIcon({
  logoUrl,
  primaryColor,
  size = "md",
}: {
  logoUrl: string | null | undefined;
  primaryColor: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-6 w-6 rounded-md"
      : size === "lg"
        ? "h-10 w-10 rounded-lg"
        : "h-7 w-7 rounded-md";
  const iconClass = size === "lg" ? "h-5 w-5" : "h-4 w-4";

  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} border border-gray-200 bg-white object-cover`}
      />
    );
  }

  return (
    <span
      className={`inline-flex ${sizeClass} items-center justify-center text-white shadow-sm`}
      style={{ backgroundColor: primaryColor }}
      aria-hidden="true"
    >
      <MessageCircle className={iconClass} aria-hidden />
    </span>
  );
}

export default async function WidgetDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string; url?: string }>;
}) {
  const { siteId, url } = await searchParams;
  const site = siteId
    ? await db.site.findUnique({
        where: { id: siteId },
        select: {
          allowedDomains: true,
          allowedTopics: true,
          greeting: true,
          isActive: true,
          livePineconeNs: true,
          logoUrl: true,
          name: true,
          primaryColor: true,
          primaryUrl: true,
          title: true,
        },
      })
    : null;
  const origin = safeOrigin(url) ?? safeOrigin(site?.primaryUrl) ?? "https://example.com";
  const siteName = site?.name?.trim() || hostLabel(origin);
  const widgetTitle = site?.title?.trim() || "Chat";
  const greeting = site?.greeting?.trim() || "Hi! How can I help you today?";
  const primaryColor = site?.primaryColor || "#6366f1";
  const hasWebsite = Boolean(site?.primaryUrl?.trim());
  const hasKnowledge = Boolean(site?.livePineconeNs);
  const hasAllowedDomain =
    getUserFacingAllowedDomains(site?.allowedDomains ?? [], env.NEXTAUTH_URL).length > 0;
  const readyToPublish = hasWebsite && hasAllowedDomain && hasKnowledge;
  const statusLabel = site?.isActive
    ? "Live widget"
    : readyToPublish
      ? "Ready draft"
      : hasKnowledge
        ? "Setup needed"
      : "Preview only";
  const setupHref = siteId ? `/sites/${siteId}?view=setup` : "/sites";
  const knowledgeHref = siteId ? `/sites/${siteId}?view=setup&tab=knowledge` : "/sites";
  const publishHref = siteId ? `/sites/${siteId}?view=setup&focus=embed#embed` : "/sites";
  const topics = site?.allowedTopics?.length
    ? site.allowedTopics.slice(0, 4)
    : ["Features", "Docs", "Pricing", "FAQ"];
  const faviconUrl = `${origin}/favicon.ico`;
  const logoUrl = site?.logoUrl || null;
  const readiness = [
    {
      label: "Appearance",
      done: true,
      helper: "Launcher, greeting, and colors are loaded.",
    },
    {
      label: "Website URL",
      done: hasWebsite,
      helper: hasWebsite ? "The widget has a public website URL." : "Set the website URL before publishing.",
    },
    {
      label: "Knowledge",
      done: hasKnowledge,
      helper: hasKnowledge ? "Knowledge is ready for answers." : "Add knowledge before answer testing.",
    },
    {
      label: "Allowed domain",
      done: hasAllowedDomain,
      helper: hasAllowedDomain ? "Embed domains are configured." : "Add at least one allowed domain.",
    },
    {
      label: "Published",
      done: Boolean(site?.isActive),
      helper: site?.isActive ? "The widget can answer visitors." : "Publish after setup is ready.",
    },
  ];
  const previewModeTitle = site?.isActive
    ? "Live answer test"
    : readyToPublish
      ? "Ready to publish"
      : hasKnowledge
        ? "Install setup needed"
      : "Preview only";
  const previewModeBody = site?.isActive
    ? "Ask a real visitor question in the widget. Responses use the active knowledge."
    : readyToPublish
      ? "The launcher and panel are ready. Publish the widget to enable public answers on approved domains."
      : hasKnowledge
        ? "Knowledge is ready, but the website URL or domains need to be finished before publishing."
      : "The launcher and panel can be reviewed here, but answer testing is disabled until knowledge is added and the widget is published.";
  const questionTopics = topics.slice(0, 3);
  const testPrompts = Array.from(
    new Set([
      `What should I know before getting started with ${siteName}?`,
      questionTopics[0] ? `What are the key details about ${questionTopics[0]}?` : null,
      questionTopics[1] ? `Where can I find information about ${questionTopics[1]}?` : null,
      questionTopics[2] ? `What should visitors know about ${questionTopics[2]}?` : null,
      `Which pages support this answer?`,
    ].filter((prompt): prompt is string => Boolean(prompt))),
  ).slice(0, 4);
  const answerBlockedReason = !hasWebsite
    ? "Set the website URL before answer testing."
    : !hasAllowedDomain
      ? "Add an allowed domain before answer testing."
      : !hasKnowledge
        ? "Add knowledge before answer testing."
        : !site?.isActive
          ? "Publish the widget before live answer testing."
          : "Widget is ready for answer testing.";
  let answerBlockAction = { href: setupHref, label: "Open setup" };
  if (!hasWebsite) {
    answerBlockAction = {
      href: siteId ? `/sites/${siteId}?view=setup&tab=branding` : "/sites",
      label: "Set website URL",
    };
  } else if (!hasAllowedDomain) {
    answerBlockAction = {
      href: siteId ? `/sites/${siteId}?view=setup&tab=behavior` : "/sites",
      label: "Add domain",
    };
  } else if (!hasKnowledge) {
    answerBlockAction = { href: knowledgeHref, label: "Add knowledge" };
  } else if (!site?.isActive) {
    answerBlockAction = { href: publishHref, label: "Open publish step" };
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 text-gray-900">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
          <WidgetIcon logoUrl={logoUrl} primaryColor={primaryColor} size="sm" />
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Widget preview</div>
              <div className="truncate text-xs text-gray-500">
                Previewing <span className="font-mono">{hostLabel(origin)}</span>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                site?.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : hasKnowledge
                    ? "border-blue-200 bg-blue-50 text-blue-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {statusLabel}
            </span>
            <Link
              href={setupHref}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to setup
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl min-w-0 gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <WidgetIcon logoUrl={logoUrl} primaryColor={primaryColor} size="lg" />
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-bold">{siteName}</h1>
                    <p className="mt-1 truncate text-sm text-gray-500">{origin}</p>
                  </div>
                </div>
                {site?.primaryUrl ? (
                  <a
                    href={site.primaryUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Open website
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-600">
                This page shows how the launcher and chat panel will feel beside real website
                content. Live answer testing is available after knowledge is ready and the widget
                is published.
              </p>

              <div
                className={`mt-4 rounded-lg border px-4 py-3 ${
                  site?.isActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : hasKnowledge
                      ? "border-blue-200 bg-blue-50 text-blue-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
                    {site?.isActive ? (
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    ) : hasKnowledge ? (
                      <Rocket className="h-4 w-4" aria-hidden />
                    ) : (
                      <AlertCircle className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{previewModeTitle}</p>
                    <p className="mt-1 text-sm leading-6 opacity-80">{previewModeBody}</p>
                    {!site?.isActive ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {!hasKnowledge ? (
                          <Link
                            href={knowledgeHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                          >
                            <BookOpenText className="h-3.5 w-3.5" aria-hidden />
                            Add knowledge
                          </Link>
                        ) : null}
                        {hasKnowledge ? (
                          <Link
                            href={publishHref}
                            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                          >
                            <Rocket className="h-3.5 w-3.5" aria-hidden />
                            Open publish step
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {topics.map((t) => (
                  <div
                    key={t}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="text-sm font-semibold">{t}</div>
                    <div className="mt-1 text-xs text-gray-600">
                      Example page content that the widget can sit beside.
                    </div>
                  </div>
                ))}
              </div>
              {siteId ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link
                    href={`/sites/${siteId}?view=setup&tab=branding`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <Palette className="h-3.5 w-3.5" aria-hidden />
                    Edit appearance
                  </Link>
                  <Link
                    href={`/sites/${siteId}?view=setup&tab=knowledge`}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <BookOpenText className="h-3.5 w-3.5" aria-hidden />
                    Manage knowledge
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {siteId ? (
            <WidgetDemoControls
              prompts={testPrompts}
              canTestAnswers={Boolean(site?.isActive && readyToPublish)}
              blockedReason={answerBlockedReason}
              actionHref={answerBlockAction.href}
              actionLabel={answerBlockAction.label}
            />
          ) : null}

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold">Preview readiness</div>
            <div className="mt-3 space-y-2">
              {readiness.map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                        item.done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                      <p className="mt-0.5 text-xs leading-5 text-gray-600">{item.helper}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-white"
                style={{ backgroundColor: primaryColor }}
              >
                <WidgetIcon logoUrl={logoUrl} primaryColor={primaryColor} size="md" />
                <span className="truncate text-sm font-semibold">{widgetTitle}</span>
              </div>
              <div className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-gray-700">
                {greeting}
              </div>
            </div>
            <div className="mt-4 space-y-2 text-xs text-gray-600">
              <div>
                <span className="font-medium">Previewing:</span>{" "}
                <span className="font-mono">{hostLabel(origin)}</span>
              </div>
              <div>
                <span className="font-medium">Widget title:</span>{" "}
                <span>{widgetTitle}</span>
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <span>{statusLabel}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {siteId ? (
        <>
          <Script
            id="widget-demo-config"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `window.ChatWidget = { siteId: ${JSON.stringify(
                siteId,
              )}, apiBase: ${JSON.stringify(env.NEXTAUTH_URL)}, pageIconUrl: ${JSON.stringify(
                site?.logoUrl || faviconUrl,
              )}, preview: true };`,
            }}
          />
          <Script
            src={`${env.NEXTAUTH_URL}/widget.js?v=current-page-context`}
            strategy="afterInteractive"
          />
        </>
      ) : null}
    </div>
  );
}
