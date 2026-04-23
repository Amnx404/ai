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
import { SiteAnalytics } from "./site-analytics";

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

export function SiteMonitorView({
  siteId,
  livePineconeNs,
  totalSessions,
  totalMessages,
  outOfScope,
}: {
  siteId: string;
  livePineconeNs: string | null;
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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SiteAnalytics
            totalSessions={totalSessions}
            totalMessages={totalMessages}
            outOfScope={outOfScope}
          />
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Knowledge base
            </p>
            <p className="mt-1 text-sm text-gray-700">
              Live namespace:{" "}
              <span className="font-mono text-gray-900">
                {livePineconeNs ?? "(not uploaded yet)"}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-600">
              Refresh the knowledge base from the Setup tab to ground answers in your
              content.
            </p>
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 lg:sticky lg:top-6 lg:w-[min(100%,22rem)] lg:self-start">
        <Card className="overflow-hidden rounded-2xl">
          <CardHeader className="border-b border-gray-100 pb-4">
            {selectedSessionId ? (
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit gap-1.5"
                  onClick={() => setSelectedSessionId(null)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                  Back to chats
                </Button>
                <div>
                  <CardTitle className="text-sm font-semibold">Conversation</CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs break-all">
                    {selectedSessionId}
                  </CardDescription>
                  {threadQuery.data ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Started {formatSessionDate(threadQuery.data.createdAt)}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <CardTitle className="text-base">Recent chats</CardTitle>
                <CardDescription>
                  Newest first. Open a thread to read the full exchange.
                </CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-0">
            {selectedSessionId ? (
              <div className="flex max-h-[min(28rem,55vh)] flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {threadQuery.isLoading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Loading messages…
                    </div>
                  ) : threadQuery.isError ? (
                    <p className="text-sm text-red-600">Could not load this conversation.</p>
                  ) : (
                    <ul className="space-y-4">
                      {(threadQuery.data?.messages ?? []).map((m) => (
                        <li key={m.id} className="text-sm">
                          <span
                            className={
                              m.role === "user"
                                ? "font-semibold text-indigo-700"
                                : "font-semibold text-gray-800"
                            }
                          >
                            {m.role === "user" ? "User" : "Assistant"}
                          </span>
                          <p className="mt-1 whitespace-pre-wrap text-gray-700">{m.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : (
              <div className="max-h-[min(28rem,55vh)] overflow-y-auto px-2 py-2">
                {listQuery.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Loading chats…
                  </div>
                ) : listQuery.isError ? (
                  <p className="px-3 py-6 text-sm text-red-600">Could not load chats.</p>
                ) : sessions.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-gray-500">
                    No conversations yet. Chats from your widget will show up here.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {sessions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedSessionId(s.id)}
                          className="w-full rounded-xl border border-transparent px-3 py-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                        >
                          <p className="text-xs font-medium text-gray-500">
                            {formatSessionDate(s.createdAt)}
                            {s.messageCount > 0 ? (
                              <span className="ml-2 text-gray-400">
                                · {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-1 line-clamp-3 text-sm text-gray-900">
                            {previewText(s.firstUserQuestion)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
