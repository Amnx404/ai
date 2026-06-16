import { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { ragStream } from "~/lib/rag";
import { env } from "~/env.js";
import { verifyWidgetToken } from "~/lib/widget-jwt";
import { getRealIp, rateLimit } from "~/lib/rate-limit";
import { getLangfuse, getLangfuseTraceUrl } from "~/lib/langfuse";
import { checkOriginAllowed, originMatchesAllowedDomains } from "~/lib/allowed-domains";

const pageContextSchema = z.object({
  url: z.string().url().max(2048),
  title: z.string().max(300).optional(),
  description: z.string().max(1000).optional(),
  headings: z.array(z.string().max(220)).max(20).optional(),
  text: z.string().max(12_000).optional(),
});

const bodySchema = z.object({
  siteId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
        sources: z
          .array(
            z.object({
              title: z.string(),
              url: z.string().url(),
              score: z.number().optional(),
            })
          )
          .optional(),
      })
    )
    .min(1)
    .max(20),
  pageContext: pageContextSchema.nullish(),
  sessionId: z.string().optional(),
  token: z.string().optional(),
  stream: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const ip = getRealIp(req);

  if (!rateLimit(`chat:${ip}`, 30, 60 * 1000)) {
    return sseError("Rate limit exceeded", 429, req);
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return sseError("Invalid request", 400, req);
  }

  const { siteId, messages, sessionId, token } = parsed.data;

  if (!token) {
    return sseError("Widget session required", 401, req);
  }

  try {
    const payload = await verifyWidgetToken(token);
    if (payload.siteId !== siteId) {
      return sseError("Token mismatch", 403, req);
    }
    if (sessionId && payload.sessionId !== sessionId) {
      return sseError("Session mismatch", 403, req);
    }
  } catch {
    return sseError("Invalid token", 401, req);
  }

  const site = await db.site.findFirst({
    where: { id: siteId, isActive: true },
  });

  if (!site) {
    return sseError("Site not found", 404, req);
  }

  const origin = req.headers.get("origin") ?? "";
  const originGate = checkOriginAllowed(origin, site.allowedDomains, {
    allowOpaqueOrigin: process.env.NODE_ENV === "development",
  });
  if (!originGate.ok) {
    return sseError(originGate.error, originGate.status, req);
  }
  const pageContext = sanitizePageContext(parsed.data.pageContext, {
    origin,
    allowedDomains: site.allowedDomains,
    primaryUrl: site.primaryUrl,
  });

  const langfuse = getLangfuse();
  // One trace per browser session (sessionId is created by /api/v1/session and stored in sessionStorage).
  // Each message becomes a SPAN inside this trace, with EVENTs for RAG + a GENERATION for the model output.
  const effectiveSessionId =
    sessionId && sessionId.length > 0 ? sessionId : crypto.randomUUID();
  const trace = langfuse?.trace({
    id: effectiveSessionId,
    name: "widget_session",
    sessionId: effectiveSessionId,
    metadata: {
      siteId,
      origin,
      modelId: site.modelId,
      temperature: site.temperature,
      allowedTopics: site.allowedTopics,
      currentPage: pageContext
        ? {
            url: pageContext.url,
            title: pageContext.title ?? null,
            textLength: pageContext.text?.length ?? 0,
          }
        : null,
    },
  });
  if (trace) {
    const url = getLangfuseTraceUrl(trace.id);
    console.log(`[langfuse] traceId=${trace.id}${url ? ` url=${url}` : ""}`);
    void langfuse?.flushAsync();
  }

  // Per-site rate limit
  if (!rateLimit(`chat:site:${siteId}:${ip}`, 20, 60 * 1000)) {
    return sseError("Site rate limit exceeded", 429, req);
  }

  let resolvedSessionId = sessionId;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      let sources: { title: string; url: string; score: number }[] = [];
      const turnStartMs = Date.now();
      let firstTokenAtMs: number | null = null;
      // Retrieval is modeled as its own Langfuse span (queries in -> ranked
      // chunks out) so the agent's RAG step is inspectable on its own, not just
      // buried in debug events.
      let retrievalSpan: any = null;
      let retrievalSummary: Record<string, unknown> | null = null;
      let retrievalChunks: Array<Record<string, unknown>> = [];
      let modelStreamErrored = false;
      let modelStreamRecovered = false;
      let ragErrorMessage: string | null = null;

      const span =
        trace?.span?.({
          name: "chat_turn",
          input: { messages, pageContext },
          metadata: { siteId, origin, currentPageUrl: pageContext?.url ?? null },
        }) ?? null;

      const generation =
        span?.generation?.({
          name: "assistant_response",
          model: site.modelId,
          input: { messages, pageContext },
          metadata: {
            temperature: site.temperature,
          },
        }) ??
        trace?.generation?.({
          name: "assistant_response",
          model: site.modelId,
          input: { messages, pageContext },
          metadata: {
            temperature: site.temperature,
          },
        }) ??
        null;

      const send = (data: string) => {
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      const filterSourcesByUsage = (
        response: string,
        candidates: { title: string; url: string; score: number }[]
      ) => {
        const hay = response.toLowerCase();
        const norm = (s: string) =>
          s
            .toLowerCase()
            .replace(/\s+/g, " ")
            .replace(/[^\p{L}\p{N}\s]/gu, "")
            .trim();
        return candidates.filter((s) => {
          const title = s.title ?? "";
          const url = s.url?.toLowerCase() ?? "";
          if (url && hay.includes(url)) return true;

          const normalizedHay = norm(hay);
          const titleNeedles = titleNeedleCandidates(title).map(norm).filter((needle) => needle.length >= 8);
          return titleNeedles.some((needle) => normalizedHay.includes(needle));
        });
      };

      try {
        for await (const event of ragStream(site, messages, pageContext)) {
          if (event.type === "token") {
            if (firstTokenAtMs === null) firstTokenAtMs = Date.now();
            const content = sanitizeAssistantToken(event.content);
            fullResponse += content;
            if (content) send(JSON.stringify({ type: "token", content }));
          } else if (event.type === "sources") {
            // Delay emitting sources until the end so we can filter to only those actually referenced.
            sources = event.sources;
          } else if (event.type === "out_of_scope") {
            // Legacy event type (kept for compatibility). We no longer hard-block answering.
            span?.event?.({
              name: "out_of_scope",
              level: "WARNING",
              metadata: { reason: event.reason ?? null },
            });
          } else if (event.type === "debug") {
            if (event.stage === "plan_queries") {
              retrievalSpan =
                span?.span?.({
                  name: "retrieval",
                  input: {
                    queries: event.data.queries,
                    plannedQueries: event.data.plannedQueries,
                  },
                  metadata: { allowedTopics: event.data.allowedTopics },
                }) ?? null;
            } else if (event.stage === "retrieval") {
              retrievalSummary = event.data;
            } else if (event.stage === "retrieved_chunks") {
              retrievalChunks =
                (event.data.chunks as Array<Record<string, unknown>>) ?? [];
              retrievalSpan?.end?.({
                output: { chunks: retrievalChunks },
                metadata: retrievalSummary ?? {},
              });
              retrievalSpan = null;
            } else if (event.stage === "model_stream_error") {
              modelStreamErrored = true;
            } else if (event.stage === "model_stream_recovered") {
              modelStreamRecovered = true;
            }
            span?.event?.({
              name: event.stage,
              level: "DEBUG",
              metadata: event.data,
            });
          } else if (event.type === "error") {
            ragErrorMessage = event.message;
            span?.event?.({
              name: "rag_error",
              level: "ERROR",
              metadata: { message: event.message },
            });
            if (fullResponse.trim().split(/\s+/).filter(Boolean).length < 8) {
              send(JSON.stringify({ type: "error", message: event.message }));
            }
          }
        }
      } catch (err) {
        const msg = "Sorry, something went wrong. Please try again.";
        modelStreamErrored = true;
        if (fullResponse.trim().split(/\s+/).filter(Boolean).length < 8) {
          send(JSON.stringify({ type: "error", message: msg }));
        }
        console.error("[chat] stream error:", err);
        generation?.end?.({
          statusMessage: msg,
          level: "ERROR",
        } as never);
      } finally {
        // Only surface sources that the model actually referenced by page title.
        const sourcesCountBeforeFilter = sources.length;
        const filteredSources = sources.length
          ? filterSourcesByUsage(fullResponse, sources)
          : [];
        const usedSources =
          sources.length && modelStreamErrored && !modelStreamRecovered && !filteredSources.length
            ? sources.slice(0, 3)
            : filteredSources;
        const usedSourcesCount = usedSources.length;
        // Defensive: close the retrieval span if a stream error skipped its end.
        retrievalSpan?.end?.({ metadata: retrievalSummary ?? {} });
        if (usedSources.length) {
          send(JSON.stringify({ type: "sources", sources: usedSources }));
          sources = usedSources;
        } else {
          sources = [];
        }

        send("[DONE]");
        controller.close();

        const endMs = Date.now();
        const latencySec = (endMs - turnStartMs) / 1000;
        const ttftSec =
          firstTokenAtMs === null ? null : (firstTokenAtMs - turnStartMs) / 1000;
        // Best-effort token estimates (we don't currently get usage from streamed OpenRouter responses).
        const estInputTokens = Math.max(
          0,
          Math.round(JSON.stringify({ messages, pageContext }).length / 4)
        );
        const estOutputTokens = Math.max(0, Math.round(fullResponse.length / 4));
        const tokensPerSecond =
          latencySec > 0 ? estOutputTokens / latencySec : null;

        generation?.end?.({
          output: fullResponse,
          metadata: {
            sources,
            modelStreamErrored,
            modelStreamRecovered,
            ragErrorMessage,
            latency: latencySec,
            timeToFirstToken: ttftSec,
            tokensPerSecond,
            inputTokens: estInputTokens,
            outputTokens: estOutputTokens,
            totalTokens: estInputTokens + estOutputTokens,
          },
          level: "DEFAULT",
        } as never);
        span?.end?.({
          metadata: {
            sources,
            modelStreamErrored,
            modelStreamRecovered,
            ragErrorMessage,
            latency: latencySec,
            timeToFirstToken: ttftSec,
          },
        } as never);

        // Per-turn online eval scores. These let you slice agent quality per
        // widget in Langfuse and — via `rerank_active` — catch the reranker
        // silently degrading when its provider quota is exhausted.
        if (langfuse && trace) {
          const finalChunkCount = retrievalChunks.length;
          const topScore = retrievalChunks.reduce((max, c) => {
            const s =
              typeof c.rerankScore === "number"
                ? c.rerankScore
                : typeof c.rrfScore === "number"
                  ? c.rrfScore
                  : 0;
            return Math.max(max, s);
          }, 0);
          const rerankObj =
            retrievalSummary && typeof retrievalSummary.rerank === "object"
              ? (retrievalSummary.rerank as { enabled?: boolean })
              : null;
          const citationUsage =
            sourcesCountBeforeFilter > 0
              ? usedSourcesCount / sourcesCountBeforeFilter
              : 0;
          const observationId = (generation as { id?: string } | null)?.id;
          const score = (name: string, value: number) =>
            langfuse.score({ traceId: trace.id, observationId, name, value });
          // Did retrieval return any grounding context at all?
          score("retrieval_chunk_count", finalChunkCount);
          // Strength of the best chunk (rerank score, or RRF score in fallback).
          score("context_top_score", Math.round(topScore * 1000) / 1000);
          // 1 when the cross-encoder reranker ran, 0 when it fell back to RRF.
          score("rerank_active", rerankObj?.enabled ? 1 : 0);
          // Fraction of surfaced sources the model actually cited (groundedness proxy).
          score("citation_usage", Math.round(citationUsage * 100) / 100);
          // Did the agent produce an answer this turn?
          score("answered", fullResponse.trim().length > 0 ? 1 : 0);
        }
        void langfuse?.flushAsync();

        // Persist async (fire and forget)
        void (async () => {
          try {
            if (!resolvedSessionId) {
              const sess = await db.chatSession.create({
                data: { siteId, ipHash: ip.replace(/\d+$/, "0") },
              });
              resolvedSessionId = sess.id;
            }

            const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
            if (lastUserMsg) {
              await db.message.create({
                data: {
                  sessionId: resolvedSessionId!,
                  role: "user",
                  content: lastUserMsg.content,
                },
              });
            }

            if (fullResponse) {
              await db.message.create({
                data: {
                  sessionId: resolvedSessionId!,
                  role: "assistant",
                  content: fullResponse,
                  sources: sources.length > 0 ? sources : undefined,
                },
              });
            }

            await db.analyticsEvent.create({
              data: { siteId, type: "message" },
            });
          } catch (e) {
            console.error("[chat] persist error:", e);
          }
        })();
      }
    },
  });

  const corsOrigin = origin || "*";

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Credentials": "true",
    },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": req.headers.get("origin") ?? "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function sseError(message: string, status: number, req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": origin,
    },
  });
}

function sanitizeAssistantToken(content: string) {
  return content.replace(/[*`]/g, "");
}

type RawPageContext = z.infer<typeof pageContextSchema>;

function sanitizePageContext(
  context: RawPageContext | null | undefined,
  site: { origin: string; allowedDomains: string[]; primaryUrl?: string | null },
) {
  if (!context) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(context.url);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return null;
  }

  const allowedForContext = [
    site.origin,
    site.primaryUrl ?? "",
    ...site.allowedDomains,
  ].filter(Boolean);
  if (
    allowedForContext.length > 0 &&
    !originMatchesAllowedDomains(parsedUrl.origin, allowedForContext)
  ) {
    return null;
  }

  const clean = (value: string | undefined, limit: number) => {
    const compact = value?.replace(/\s+/g, " ").trim() ?? "";
    return compact ? compact.slice(0, limit) : undefined;
  };

  const title = clean(context.title, 300);
  const description = clean(context.description, 1_000);
  const text = clean(context.text, 12_000);
  const headings = (context.headings ?? [])
    .map((heading) => clean(heading, 220))
    .filter((heading): heading is string => Boolean(heading))
    .slice(0, 20);

  if (!title && !description && !text && headings.length === 0) return null;

  return {
    url: parsedUrl.href,
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(headings.length ? { headings } : {}),
    ...(text ? { text } : {}),
  };
}

function titleNeedleCandidates(title: string) {
  const trimmed = title.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return [trimmed];

  const suffixes = parts.slice(1);
  return [trimmed, ...suffixes];
}
