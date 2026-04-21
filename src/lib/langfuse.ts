import { Langfuse } from "langfuse";

import { env } from "~/env.js";

let _langfuse: Langfuse | null = null;
let _langfuseHandlersAttached = false;

function normalizeBaseUrl(raw?: string) {
  if (!raw) return undefined;
  let s = raw.trim();
  // Guard against accidentally persisted quotes in some env setups
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\/+$/, "");
}

export function getLangfuse() {
  const publicKey = env.LANGFUSE_PUBLIC_KEY;
  const secretKey = env.LANGFUSE_SECRET_KEY;
  const baseUrl = normalizeBaseUrl(env.LANGFUSE_BASE_URL);
  const environment = env.NODE_ENV;

  if (!publicKey || !secretKey || !baseUrl) return null;

  if (!_langfuse) {
    _langfuse = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      environment,
    });
  }

  // Surface ingestion issues in the server logs (otherwise it's easy to miss).
  if (!_langfuseHandlersAttached) {
    _langfuseHandlersAttached = true;
    _langfuse.on("warning", (e: unknown) => {
      console.warn("[langfuse] warning:", e);
    });
    _langfuse.on("error", (e: unknown) => {
      console.error("[langfuse] error:", e);
    });
  }

  return _langfuse;
}

export function getLangfuseTraceUrl(traceId: string) {
  const baseUrl = normalizeBaseUrl(env.LANGFUSE_BASE_URL);
  const projectId = env.LANGFUSE_PROJECT_ID;
  if (!baseUrl || !projectId) return null;
  return `${baseUrl}/project/${projectId}/traces/${traceId}`;
}

