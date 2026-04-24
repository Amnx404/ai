"use client";

import { useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";

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

function previewText(text: string | null, max = 120) {
  if (!text?.trim()) return "No user message yet";
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function pluralUnit(n: number, singular: string, plural: string) {
  return n === 1 ? singular : plural;
}

export function SiteMonitorView({
  siteId,
  totalSessions,
  totalMessages,
  outOfScope,
}: {
  siteId: string;
  totalSessions: number;
  totalMessages: number;
  outOfScope: number;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const listQuery = api.analytics.monitorSessions.useQuery(
    { siteId, limit: 60 },
    { staleTime: 30_000 },
  );

  const threadQuery = api.analytics.sessionThread.useQuery(
    { siteId, sessionId: selectedSessionId ?? "" },
    { enabled: Boolean(selectedSessionId), staleTime: 15_000 },
  );

  const sessions = listQuery.data ?? [];

  return (
    <Card
      className={cn(
        "flex min-h-[min(24rem,50vh)] min-h-0 flex-1 flex-col overflow-hidden rounded-2xl lg:min-h-[min(32rem,70vh)] lg:flex-row",
      )}
    >
      {/* Summary */}
      <div className="shrink-0 border-b border-gray-100 bg-gray-50/50 px-5 py-4 lg:w-[min(13rem,22%)] lg:border-b-0 lg:border-r lg:py-5">
        <Label className="text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">
          Summary
        </Label>
        <ul className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-6 sm:gap-y-2 lg:flex-col lg:gap-2.5">
          <li className="text-[0.9375rem] leading-snug text-gray-700">
            <span className="tabular-nums font-semibold text-gray-900">{totalSessions}</span>{" "}
            {pluralUnit(totalSessions, "conversation", "conversations")}
          </li>
          <li className="text-[0.9375rem] leading-snug text-gray-700">
            <span className="tabular-nums font-semibold text-gray-900">{totalMessages}</span>{" "}
            {pluralUnit(totalMessages, "message", "messages")}
          </li>
          <li className="text-[0.9375rem] leading-snug text-gray-700">
            <span className="tabular-nums font-semibold text-gray-900">{outOfScope}</span> out of
            scope
          </li>
        </ul>
      </div>

      <Separator className="lg:hidden" />

      <Separator orientation="vertical" className="hidden self-stretch lg:block" />

      {/* Chats */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CardHeader className="border-b border-gray-100 px-5 pb-4 pt-5 sm:px-6">
          {selectedSessionId ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-sm">Conversation</CardTitle>
                <CardDescription className="break-all font-mono text-xs text-gray-600">
                  {selectedSessionId}
                </CardDescription>
                {threadQuery.data ? (
                  <CardDescription className="text-xs text-gray-500">
                    Started {formatSessionDate(threadQuery.data.createdAt)}
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
            <div className="space-y-1">
              <CardTitle className="text-sm">Chats</CardTitle>
              <CardDescription className="text-xs" id="monitor-chats-hint">
                Newest first. Select a row to read the full thread.
              </CardDescription>
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
                    <ul className="pb-4">
                      {(threadQuery.data?.messages ?? []).map((msg, i) => (
                        <li key={msg.id}>
                          {i > 0 ? <Separator className="my-4" /> : null}
                          <div className="px-1 text-sm">
                            <span
                              className={
                                msg.role === "user"
                                  ? "font-semibold text-indigo-700"
                                  : "font-semibold text-gray-800"
                              }
                            >
                              {msg.role === "user" ? "User" : "Assistant"}
                            </span>
                            <LinkifiedText
                              content={msg.content}
                              sources={msg.sources}
                              className="mt-1 whitespace-pre-wrap text-gray-800"
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : listQuery.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading chats…
                </div>
              ) : listQuery.isError ? (
                <p className="px-3 py-6 text-sm text-red-600">Could not load chats.</p>
              ) : sessions.length === 0 ? (
                <p className="px-3 py-12 text-center text-sm text-gray-500">
                  No conversations yet. Chats from your widget will show up here.
                </p>
              ) : (
                <ul>
                  {sessions.map((s, i) => (
                    <li key={s.id}>
                      {i > 0 ? <Separator /> : null}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSessionId(s.id);
                        }}
                        className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                      >
                        <p className="text-xs font-medium text-gray-500">
                          {formatSessionDate(s.createdAt)}
                          {s.messageCount > 0 ? (
                            <span className="ml-2 text-gray-400">
                              · {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">
                          {previewText(s.firstUserQuestion, 200)}
                        </p>
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
  );
}
