import { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { ragStream } from "~/lib/rag";
import { resolvePineconeTarget } from "~/lib/pinecone";
import { env } from "~/env.js";
import { verifyWidgetToken } from "~/lib/widget-jwt";
import { getRealIp, rateLimit } from "~/lib/rate-limit";
import { getLangfuse, getLangfuseTraceUrl } from "~/lib/langfuse";

const bodySchema = z.object({
  siteId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .min(1)
    .max(20),
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

  // Verify JWT if provided
  if (token) {
    try {
      const payload = await verifyWidgetToken(token);
      if (payload.siteId !== siteId) {
        return sseError("Token mismatch", 403, req);
      }
    } catch {
      return sseError("Invalid token", 401, req);
    }
  }

  const site = await db.site.findFirst({
    where: { id: siteId, isActive: true },
  });

  if (!site) {
    return sseError("Site not found", 404, req);
  }

  const origin = req.headers.get("origin") ?? "";

  const pineconeTarget = resolvePineconeTarget(site, env.PINECONE_INDEX);
  const langfuse = getLangfuse();
  const trace = langfuse?.trace({
    name: "widget_chat",
    sessionId,
    input: {
      siteId,
      messages,
    },
    metadata: {
      origin,
      pinecone: pineconeTarget,
      modelId: site.modelId,
      temperature: site.temperature,
      allowedTopics: site.allowedTopics,
    },
  });
  if (trace) {
    const url = getLangfuseTraceUrl(trace.id);
    console.log(`[langfuse] traceId=${trace.id}${url ? ` url=${url}` : ""}`);

    // Flush early so traces show up immediately in the UI.
    void langfuse?.flushAsync();

    // Best-effort: verify the trace exists and print Langfuse's canonical htmlPath.
    // This also helps catch "wrong project id" vs "ingestion failed" issues.
    void (async () => {
      try {
        const res = await langfuse?.api.traceGet({ traceId: trace.id } as never);
        const htmlPath =
          res && typeof res === "object" && "htmlPath" in res
            ? (res as { htmlPath?: unknown }).htmlPath
            : null;
        if (typeof htmlPath === "string" && htmlPath.length > 0) {
          const base = env.LANGFUSE_BASE_URL?.replace(/\/+$/, "") ?? "";
          console.log(`[langfuse] trace htmlPath=${base}${htmlPath}`);
        } else {
          console.log("[langfuse] traceGet ok (no htmlPath in response)");
        }
      } catch (e) {
        console.warn("[langfuse] traceGet failed:", e);
      }
    })();
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
          const main = title.split("|")[0]?.trim() || title.trim();
          const needle = norm(main);
          if (!needle) return false;
          return norm(hay).includes(needle);
        });
      };

      try {
        const debug: Record<string, unknown>[] = [];
        for await (const event of ragStream(site, messages)) {
          if (event.type === "token") {
            fullResponse += event.content;
            send(JSON.stringify({ type: "token", content: event.content }));
          } else if (event.type === "sources") {
            // Delay emitting sources until the end so we can filter to only those actually referenced.
            sources = event.sources;
          } else if (event.type === "out_of_scope") {
            // Legacy event type (kept for compatibility). We no longer hard-block answering.
            debug.push({ type: "out_of_scope", reason: event.reason ?? null });
            if (trace) {
              try {
                trace.update({ metadata: { debug } });
                void langfuse?.flushAsync();
              } catch {}
            }
          } else if (event.type === "debug") {
            debug.push({ stage: event.stage, ...event.data });
            if (trace) {
              try {
                trace.update({ metadata: { debug } });
              } catch {}
            }
          }
        }
      } catch (err) {
        const msg = "Sorry, something went wrong. Please try again.";
        send(JSON.stringify({ type: "error", message: msg }));
        console.error("[chat] stream error:", err);
      } finally {
        // Only surface sources that the model actually referenced by page title.
        const usedSources = sources.length ? filterSourcesByUsage(fullResponse, sources) : [];
        if (usedSources.length) {
          send(JSON.stringify({ type: "sources", sources: usedSources }));
          sources = usedSources;
        } else {
          sources = [];
        }

        send("[DONE]");
        controller.close();

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

            // Langfuse (best-effort)
            if (trace) {
              try {
                trace.update({
                  sessionId: resolvedSessionId,
                  output: fullResponse,
                  metadata: {
                    sources,
                  },
                });
                // Don't block response lifecycle on ingestion
                void langfuse?.flushAsync();
              } catch (e) {
                console.warn("[langfuse] trace update failed:", e);
              }
            }
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
