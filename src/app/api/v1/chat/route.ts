import { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { ragStream } from "~/lib/rag";
import { verifyWidgetToken } from "~/lib/widget-jwt";
import { getRealIp, rateLimit } from "~/lib/rate-limit";

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

      try {
        for await (const event of ragStream(site, messages)) {
          if (event.type === "token") {
            fullResponse += event.content;
            send(JSON.stringify({ type: "token", content: event.content }));
          } else if (event.type === "sources") {
            sources = event.sources;
            send(JSON.stringify({ type: "sources", sources }));
          } else if (event.type === "out_of_scope") {
            const msg =
              "I can only answer questions related to the topics I'm configured for. Please rephrase or ask something else.";
            send(JSON.stringify({ type: "token", content: msg }));
            fullResponse = msg;

            await db.analyticsEvent.create({
              data: { siteId, type: "out_of_scope" },
            });
          }
        }
      } catch (err) {
        const msg = "Sorry, something went wrong. Please try again.";
        send(JSON.stringify({ type: "error", message: msg }));
        console.error("[chat] stream error:", err);
      } finally {
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
