"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Inbox,
  ListFilter,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Search,
} from "lucide-react";

import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";
import { LinkifiedText } from "~/components/chat/linkified-text";

function formatSessionDate(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(d));
}

function formatMessageTime(d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(d));
}

function previewText(text: string | null, max = 120) {
  if (!text?.trim()) return "No user message yet";
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function pluralUnit(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

function countLabel(n: number, singular: string, plural: string) {
  return `${n} ${pluralUnit(n, singular, plural)}`;
}

function shortSessionId(id: string) {
  return id.length > 10 ? id.slice(-8) : id;
}

function sourceLabel(source: { title: string; url: string }) {
  const title = source.title?.trim().replace(/\s+/g, " ");
  if (title) {
    const base = title.split("|").map((part) => part.trim()).filter(Boolean)[0] ?? title;
    return base.length > 42 ? `${base.slice(0, 39)}…` : base;
  }

  try {
    const parsed = new URL(source.url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Source";
  }
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function uniqueSources(
  sources: Array<{ title: string; url: string; score: number }> | null | undefined,
) {
  const seen = new Set<string>();
  return (sources ?? []).filter((source) => {
    if (!source.url || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function sourceCount(
  messages: Array<{ sources?: Array<{ title: string; url: string; score: number }> }>,
) {
  const urls = new Set<string>();
  for (const message of messages) {
    for (const source of message.sources ?? []) {
      if (source.url) urls.add(source.url);
    }
  }
  return urls.size;
}

type MonitorFilter = "all" | "with-sources" | "needs-review";

function monitorFilterLabel(filter: MonitorFilter) {
  if (filter === "with-sources") return "With citations";
  if (filter === "needs-review") return "Needs citations";
  return "All chats";
}

export function SiteMonitorView({
  siteId,
  totalSessions,
  totalMessages,
  outOfScope,
  isActive,
  livePineconeNamespace,
}: {
  siteId: string;
  totalSessions: number;
  totalMessages: number;
  outOfScope: number;
  isActive: boolean;
  livePineconeNamespace: string | null;
}) {
  const monitorPanelRef = useRef<HTMLDivElement | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [conversationQuery, setConversationQuery] = useState("");
  const [monitorFilter, setMonitorFilter] = useState<MonitorFilter>("all");
  const hasKnowledge = Boolean(livePineconeNamespace);
  const monitorState = !hasKnowledge
    ? totalSessions > 0
      ? {
          title: "Knowledge needed",
          body: "Recorded chats can still be reviewed here, but answer testing needs a completed content import first.",
          className: "border-amber-200 bg-amber-50 text-amber-900",
          icon: AlertTriangle,
        }
      : {
          title: "Knowledge needed",
          body: "Add knowledge sources before answer testing or publishing. New chats will appear here after visitors use the widget.",
          className: "border-amber-200 bg-amber-50 text-amber-900",
          icon: AlertTriangle,
        }
    : !isActive
      ? {
          title: "Preview monitor",
          body: "Knowledge is ready, but the widget is still preview-only. Publish it when visitors should start using it.",
          className: "border-blue-200 bg-blue-50 text-blue-900",
          icon: FileSearch,
        }
      : {
          title: "Live conversations",
          body: "New visitor chats appear here with answers, citations, and review flags.",
          className: "border-emerald-200 bg-emerald-50 text-emerald-900",
          icon: MessagesSquare,
        };
  const MonitorStateIcon = monitorState.icon;
  const emptyState = isActive
    ? {
        title: "No visitor conversations yet",
        body: "Open the widget preview or wait for site visitors. New chats will appear here with questions, answers, citations, and timestamps.",
        primaryLabel: "Open widget preview",
        secondaryLabel: "Improve knowledge",
      }
    : hasKnowledge
      ? {
          title: "Publish to start monitoring",
          body: "Knowledge is ready, but the widget is not live yet. Preview it, then publish when conversations should start showing here.",
          primaryLabel: "Preview widget",
          secondaryLabel: "Open publish step",
        }
      : {
          title: "Knowledge is needed first",
          body: "Add trusted pages before publishing this widget. Until then, the preview stays safely limited and no visitor conversations are collected.",
          primaryLabel: "Preview widget",
          secondaryLabel: "Add knowledge",
        };

  const listQuery = api.analytics.monitorSessions.useQuery(
    { siteId, limit: 60 },
    { staleTime: 30_000 },
  );

  const threadQuery = api.analytics.sessionThread.useQuery(
    { siteId, sessionId: selectedSessionId ?? "" },
    { enabled: Boolean(selectedSessionId), staleTime: 15_000 },
  );

  const sessions = listQuery.data ?? [];
  const sessionsWithSources = sessions.filter((session) => session.sourceCount > 0).length;
  const sessionsNeedingReview = sessions.filter(
    (session) => session.messageCount > 1 && session.sourceCount === 0,
  ).length;
  const filteredSessions = sessions.filter((session) => {
    if (monitorFilter === "with-sources" && session.sourceCount === 0) return false;
    if (monitorFilter === "needs-review" && (session.messageCount <= 1 || session.sourceCount > 0)) {
      return false;
    }
    const query = conversationQuery.trim().toLowerCase();
    if (!query) return true;
    return [
      session.id,
      session.firstUserQuestion ?? "",
      session.lastAssistantAnswer ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const selectedThread = threadQuery.data;
  const selectedMessages = selectedThread?.messages ?? [];
  const selectedSourceCount = sourceCount(selectedMessages);
  const latestSession = sessions[0];
  const setupSourceHref = `/sites/${encodeURIComponent(siteId)}?view=setup&tab=knowledge`;
  const publishHref = `/sites/${encodeURIComponent(siteId)}?view=setup&focus=embed#embed`;
  const selectedVisitorQuestions = selectedMessages.filter(
    (message) => message.role === "user",
  ).length;
  const selectedAssistantAnswers = selectedMessages.filter(
    (message) => message.role === "assistant",
  ).length;
  const selectedAssistantAnswersWithoutSources = selectedMessages.filter(
    (message) =>
      message.role === "assistant" &&
      uniqueSources(message.sources).length === 0 &&
      message.content.trim().length > 0,
  ).length;
  const selectedReviewState = selectedSourceCount > 0
    ? {
        title: "Citations found",
        body: "This conversation cites pages you can open from the answers below.",
        className: "border-emerald-200 bg-emerald-50 text-emerald-900",
        icon: CheckCircle2,
        actionHref: setupSourceHref,
        actionLabel: "Review knowledge",
      }
    : selectedAssistantAnswers > 0
      ? {
          title: "Needs citation review",
          body: "An assistant answer was recorded without cited pages. Add stronger sources or tighten the allowed links before relying on it.",
          className: "border-amber-200 bg-amber-50 text-amber-900",
          icon: AlertTriangle,
          actionHref: setupSourceHref,
          actionLabel: "Improve knowledge",
        }
      : {
          title: "Waiting for answer",
          body: "A visitor question exists, but no assistant answer has been recorded yet.",
          className: "border-gray-200 bg-gray-50 text-gray-700",
          icon: MessageCircle,
          actionHref: `/widget-demo?siteId=${encodeURIComponent(siteId)}`,
          actionLabel: "Open preview",
        };
  const SelectedReviewIcon = selectedReviewState.icon;
  const conversationMetricHelper = listQuery.isLoading
    ? totalSessions > 0
      ? "Loading latest conversation…"
      : "Checking for new chats…"
    : latestSession
      ? `Latest ${formatSessionDate(latestSession.createdAt)}`
      : totalSessions > 0
        ? "No visible rows yet"
        : "No chats yet";
  const visibleRowsMissing = !listQuery.isLoading && sessions.length === 0 && totalSessions > 0;
  const resolvedEmptyState = visibleRowsMissing
    ? {
        title: "No complete chats to show yet",
        body: `${countLabel(totalSessions, "conversation is", "conversations are")} recorded in the summary, but this inbox does not have a complete chat row yet. New complete chats will appear here automatically.`,
        primaryLabel: "Open widget preview",
        secondaryLabel: "Improve knowledge",
      }
    : emptyState;

  function scrollMonitorPanelIntoView() {
    const panel = monitorPanelRef.current;
    if (!panel) return;

    const targetTop = window.scrollY + panel.getBoundingClientRect().top - 24;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });

    const scrollParent = panel.closest("main");
    if (scrollParent instanceof HTMLElement && scrollParent.scrollHeight > scrollParent.clientHeight) {
      const parentTop = scrollParent.getBoundingClientRect().top;
      const panelTop = panel.getBoundingClientRect().top;
      scrollParent.scrollTo({
        top: Math.max(0, scrollParent.scrollTop + panelTop - parentTop - 24),
        behavior: "smooth",
      });
    }
  }

  function openSession(sessionId: string) {
    scrollMonitorPanelIntoView();
    setSelectedSessionId(sessionId);
    window.setTimeout(scrollMonitorPanelIntoView, 0);
  }

  useEffect(() => {
    if (!selectedSessionId) return;
    const timer = window.setTimeout(scrollMonitorPanelIntoView, 0);
    return () => window.clearTimeout(timer);
  }, [selectedSessionId]);

  return (
    <div ref={monitorPanelRef} className="scroll-mt-6">
      <Card className="flex min-h-[min(28rem,60vh)] flex-1 flex-col overflow-hidden rounded-lg lg:min-h-[min(34rem,72vh)] lg:flex-row">
        <div className="shrink-0 border-b border-gray-100 bg-gray-50/70 px-5 py-4 lg:w-[min(17rem,28%)] lg:border-b-0 lg:border-r lg:py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600">
              <Inbox className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <Label className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">
                Monitor
              </Label>
              <p className="mt-1 text-sm font-semibold text-gray-900">Visitor inbox</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                Review visitor questions, assistant replies, and cited pages.
              </p>
            </div>
          </div>

        <div className={`mt-4 rounded-lg border px-3 py-3 ${monitorState.className}`}>
          <div className="flex gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/80">
              <MonitorStateIcon className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{monitorState.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{monitorState.body}</p>
            </div>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {[
            {
              icon: MessagesSquare,
              label: pluralUnit(totalSessions, "Conversation", "Conversations"),
              helper: conversationMetricHelper,
              value: totalSessions,
            },
            {
              icon: MessageCircle,
              label: "Visitor questions",
              helper: countLabel(totalMessages, "question recorded", "questions recorded"),
              value: totalMessages,
            },
            {
              icon: AlertTriangle,
              label: "Unsupported",
              helper:
                outOfScope > 0
                  ? "Questions outside coverage were detected"
                  : "No unsupported questions yet",
              value: outOfScope,
            },
          ].map((metric) => (
            <li
              key={metric.label}
              className="rounded-lg border border-gray-200 bg-white px-3 py-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold tabular-nums text-gray-900">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-700">{metric.label}</p>
                </div>
                <metric.icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              </div>
              <p className="mt-2 text-xs leading-4 text-gray-500">{metric.helper}</p>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link href={`/widget-demo?siteId=${encodeURIComponent(siteId)}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Preview widget
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="justify-start">
            <Link href={setupSourceHref}>
              <Search className="h-3.5 w-3.5" aria-hidden />
              Improve knowledge
            </Link>
          </Button>
        </div>
      </div>

      <Separator className="lg:hidden" />

      <Separator orientation="vertical" className="hidden self-stretch lg:block" />

      {/* Chats */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardHeader className="border-b border-gray-100 px-5 pb-4 pt-5 sm:px-6">
          {selectedSessionId ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base">
                  Conversation {shortSessionId(selectedSessionId)}
                </CardTitle>
                {selectedThread ? (
                  <CardDescription className="text-xs text-gray-500">
                    Started {formatSessionDate(selectedThread.createdAt)} ·{" "}
                    {countLabel(selectedMessages.length, "message", "messages")} ·{" "}
                    {countLabel(selectedSourceCount, "cited page", "cited pages")}
                  </CardDescription>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit shrink-0 gap-1.5"
                onClick={() => setSelectedSessionId(null)}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back to chats
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-1">
                <CardTitle className="text-base">Visitor conversations</CardTitle>
                <CardDescription className="text-xs" id="monitor-chats-hint">
                  Newest first. Open a row to check the answer and citations.
                </CardDescription>
                <div className="mt-3 grid gap-2 2xl:grid-cols-[minmax(18rem,1fr)_minmax(0,auto)]">
                  <div className="relative min-w-0">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                    <input
                      value={conversationQuery}
                      onChange={(event) => setConversationQuery(event.target.value)}
                      placeholder="Search questions, answers, or session ID"
                      className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-900/10"
                      aria-label="Search conversations"
                    />
                  </div>
                  <div
                    className="grid min-w-0 gap-1.5 sm:grid-cols-3 2xl:min-w-[28rem]"
                    role="group"
                    aria-label="Filter conversations"
                  >
                    {[
                      {
                        id: "all" as const,
                        icon: ListFilter,
                        count: sessions.length,
                      },
                      {
                        id: "with-sources" as const,
                        icon: FileSearch,
                        count: sessionsWithSources,
                      },
                      {
                        id: "needs-review" as const,
                        icon: AlertTriangle,
                        count: sessionsNeedingReview,
                      },
                    ].map((filter) => {
                      const active = monitorFilter === filter.id;
                      const Icon = filter.icon;
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => setMonitorFilter(filter.id)}
                          aria-pressed={active}
                          aria-label={`${monitorFilterLabel(filter.id)}: ${filter.count} ${
                            filter.count === 1 ? "chat" : "chats"
                          }`}
                          className={cn(
                            "inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-[11px] font-semibold transition-colors",
                            active
                              ? "border-gray-900 bg-gray-900 text-white"
                              : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-white",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                          <span>{monitorFilterLabel(filter.id)}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                              active ? "bg-white/15 text-white" : "bg-white text-gray-500",
                            )}
                          >
                            {filter.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <span className="w-fit rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
                {listQuery.isLoading
                  ? "Loading"
                  : countLabel(filteredSessions.length, "chat shown", "chats shown")}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="h-full min-h-0 flex-1">
            <div
              className="px-4 py-3 sm:px-6"
              aria-describedby={selectedSessionId ? undefined : "monitor-chats-hint"}
            >
              {selectedSessionId ? (
                <>
                  {threadQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading messages…
                    </div>
                  ) : threadQuery.isError ? (
                    <p className="px-2 py-6 text-sm text-red-600">
                      Could not load this conversation.
                    </p>
                  ) : (
                    <>
                      <div className={`mb-4 rounded-lg border px-4 py-3 ${selectedReviewState.className}`}>
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="flex min-w-0 gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
                              <SelectedReviewIcon className="h-4 w-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">{selectedReviewState.title}</p>
                              <p className="mt-1 text-xs leading-5 opacity-80">
                                {selectedReviewState.body}
                              </p>
                              {selectedAssistantAnswersWithoutSources > 0 ? (
                                <p className="mt-2 text-xs font-semibold opacity-90">
                                  {countLabel(
                                    selectedAssistantAnswersWithoutSources,
                                    "assistant answer is",
                                    "assistant answers are",
                                  )}{" "}
                                  missing citations.
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <Link
                            href={selectedReviewState.actionHref}
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-3 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                          >
                            {selectedReviewState.actionLabel}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </div>
                      </div>

                      <div className="mb-4 grid gap-2 sm:grid-cols-3">
                        {[
                          {
                        label: "Visitor questions",
                        value: selectedVisitorQuestions,
                        helper: "Asked by visitors",
                      },
                      {
                        label: "Assistant answers",
                        value: selectedAssistantAnswers,
                        helper: "Replies saved",
                      },
                      {
                        label: "Cited pages",
                        value: selectedSourceCount,
                        helper: "Unique URLs",
                      },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3"
                          >
                            <p className="text-lg font-semibold tabular-nums text-gray-900">
                              {item.value}
                            </p>
                            <p className="mt-0.5 text-xs font-semibold text-gray-700">
                              {item.label}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">{item.helper}</p>
                          </div>
                        ))}
                      </div>

                      <ul className="space-y-3 pb-4">
                        {(threadQuery.data?.messages ?? []).map((msg, i) => {
                          const messageSources = uniqueSources(msg.sources);
                          const isAssistant = msg.role === "assistant";
                          const assistantHasSources = isAssistant && messageSources.length > 0;
                          return (
                            <li
                              key={msg.id}
                              className={cn(
                                "rounded-lg border px-4 py-3",
                                isAssistant
                                  ? assistantHasSources
                                    ? "border-emerald-200 bg-emerald-50/40"
                                    : "border-amber-200 bg-amber-50/50"
                                  : "border-gray-200 bg-white",
                              )}
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span
                                    className={cn(
                                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                      isAssistant
                                        ? "bg-gray-900 text-white"
                                        : "border border-gray-200 bg-gray-50 text-gray-700",
                                    )}
                                  >
                                    {isAssistant ? "Assistant answer" : "Visitor question"}
                                  </span>
                                  <span className="text-xs font-medium text-gray-500">
                                    {formatMessageTime(msg.createdAt)}
                                  </span>
                                </div>
                                {isAssistant ? (
                                  <span
                                    className={cn(
                                      "w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                      assistantHasSources
                                        ? "border-emerald-200 bg-white text-emerald-700"
                                        : "border-amber-200 bg-white text-amber-800",
                                    )}
                                  >
                                    {assistantHasSources
                                      ? countLabel(messageSources.length, "citation", "citations")
                                      : "No citations"}
                                  </span>
                                ) : null}
                              </div>

                              <LinkifiedText
                                content={msg.content}
                                sources={msg.sources}
                                className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-900"
                              />

                              {assistantHasSources ? (
                                <div className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                                    Pages cited
                                  </p>
                                  <div className="mt-2 grid gap-2 xl:grid-cols-2">
                                    {messageSources.slice(0, 6).map((source) => (
                                      <a
                                        key={source.url}
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="group min-w-0 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs hover:border-gray-300 hover:bg-white"
                                      >
                                        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-gray-800 group-hover:text-gray-950">
                                          <span className="truncate">{sourceLabel(source)}</span>
                                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                                        </span>
                                        <span className="mt-1 block truncate font-mono text-[11px] text-gray-500">
                                          {sourceHost(source.url)}
                                        </span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              ) : isAssistant ? (
                                <div className="mt-3 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-medium text-amber-800">
                                  This answer has no citations attached. Improve the knowledge sources or allowed links before relying on it.
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              ) : listQuery.isLoading ? (
                <div className="space-y-3 pb-4">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Loading latest chats
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Pulling questions, answers, citation counts, and review signals.
                      </p>
                    </div>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" aria-hidden />
                  </div>
                  <ul className="space-y-2" aria-hidden>
                    {["first", "second", "third"].map((row) => (
                      <li
                        key={row}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="h-4 w-4/5 animate-pulse rounded bg-gray-200" />
                            <div className="h-3 w-36 animate-pulse rounded bg-gray-100" />
                          </div>
                          <div className="h-6 w-8 shrink-0 animate-pulse rounded-full bg-gray-100" />
                        </div>
                        <div className="mt-3 space-y-2">
                          <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                          <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                        </div>
                        <div className="mt-3 flex gap-1.5">
                          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
                          <div className="h-6 w-24 animate-pulse rounded-full bg-gray-100" />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : listQuery.isError ? (
                <div className="mx-auto max-w-md px-3 py-14 text-center">
                  <p className="text-sm font-semibold text-red-700">
                    Could not load conversations
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Refresh the page or come back after the local API is reachable.
                  </p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="mx-auto flex max-w-sm flex-col items-center px-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500">
                    <MessageCircle className="h-5 w-5" aria-hidden />
                  </div>
                  {sessions.length > 0 ? (
                    <>
                      <p className="mt-3 text-sm font-semibold text-gray-900">
                        No conversations match
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        Clear search or switch from {monitorFilterLabel(monitorFilter).toLowerCase()} to see more chats.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => {
                          setConversationQuery("");
                          setMonitorFilter("all");
                        }}
                      >
                        Clear filters
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-sm font-semibold text-gray-900">
                        {resolvedEmptyState.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {resolvedEmptyState.body}
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/widget-demo?siteId=${encodeURIComponent(siteId)}`}>
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                            {resolvedEmptyState.primaryLabel}
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link
                            href={
                              resolvedEmptyState.secondaryLabel === "Open publish step"
                                ? publishHref
                                : setupSourceHref
                            }
                          >
                            {resolvedEmptyState.secondaryLabel}
                          </Link>
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <ul className="space-y-2 pb-4">
                  {filteredSessions.map((s, i) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => {
                          openSession(s.id);
                        }}
                        className={cn(
                          "group w-full rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/10",
                          i === 0
                            ? "border-gray-300 bg-gray-50 hover:bg-gray-100"
                            : "border-gray-200 bg-white hover:bg-gray-50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                              {previewText(s.firstUserQuestion, 200)}
                            </p>
                            <p className="mt-1 text-xs font-medium text-gray-500">
                              {formatSessionDate(s.createdAt)}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                            {s.messageCount}
                          </span>
                        </div>
                        {s.lastAssistantAnswer ? (
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">
                            {previewText(s.lastAssistantAnswer, 180)}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                              {countLabel(s.messageCount, "message", "messages")}
                            </span>
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                s.sourceCount > 0
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : s.messageCount > 1
                                    ? "border-amber-200 bg-amber-50 text-amber-800"
                                    : "border-gray-200 bg-white text-gray-500",
                              )}
                            >
                            {s.sourceCount > 0
                                ? countLabel(s.sourceCount, "citation", "citations")
                                : s.messageCount > 1
                                  ? "No citations"
                                  : "Awaiting answer"}
                            </span>
                          </div>
                          <span className="inline-flex h-8 w-fit items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 shadow-sm group-hover:border-gray-300 group-hover:bg-gray-50">
                            <span className="sr-only">Click to review. </span>
                            Review chat
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </div>
    </Card>
    </div>
  );
}
