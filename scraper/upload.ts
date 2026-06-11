import { readFile } from "fs/promises";
import { join, resolve } from "path";

import { storeKnowledgeChunks } from "./chunk-store.js";
import type { ApiStatus, UploadRequest } from "./types.js";

type PreparedChunk = {
  id: string;
  url?: string;
  title?: string | null;
  description?: string | null;
  text: string;
  page_index?: number;
  chunk_index?: number;
  chars?: number;
};

const EMBED_MODEL = "perplexity/pplx-embed-v1-0.6b";
const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";

async function embedTextsViaOpenRouter(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  const res = await fetch(OPENROUTER_EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`OpenRouter embed ${res.status}: ${err}`);
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

export async function runUpload(request: UploadRequest): Promise<ApiStatus> {
  const started = new Date();
  const runId = requireRunId(request.run_id);

  const outputRoot = resolve(process.env.SCRAPER_OUTPUT_DIR ?? ".temp/scraper-runs");
  const runDir = join(outputRoot, runId);
  const ingestionDir = request.ingestion_dir ? resolve(request.ingestion_dir) : join(runDir, "ingestion");
  const chunksPath = join(ingestionDir, "chunks.jsonl");
  const maxRecords = request.max_records == null ? null : clampInteger(request.max_records, 0, 0, 1_000_000);
  const chunks = readJsonl<PreparedChunk>(await readFile(chunksPath, "utf8"))
    .filter((chunk) => typeof chunk.text === "string" && chunk.text.trim())
    .slice(0, maxRecords ?? undefined);

  if (chunks.length === 0) {
    throw new Error("No prepared chunks found to upload");
  }

  const embedBatchSize = clampInteger(request.embed_batch_size, 64, 1, 100);
  const liveNamespace = request.staging_namespace?.trim() || makeLiveNamespace(request.live_prefix, runId);
  let embeddedCount = 0;

  // Generate embeddings via OpenRouter and attach to chunks.
  const chunksWithEmbeddings: Array<PreparedChunk & { embedding: number[] }> = [];
  for (let i = 0; i < chunks.length; i += embedBatchSize) {
    const batch = chunks.slice(i, i + embedBatchSize);
    const embeddings = await embedTextsViaOpenRouter(batch.map((c) => c.text));
    for (let j = 0; j < batch.length; j++) {
      chunksWithEmbeddings.push({ ...batch[j]!, embedding: embeddings[j] ?? [] });
      embeddedCount++;
    }
  }

  const chunkStore = await storeKnowledgeChunks({
    siteId: request.site_id,
    namespace: liveNamespace,
    runId,
    chunks: chunksWithEmbeddings,
  });

  const finished = new Date();
  return {
    ok: true,
    step: "upload",
    run_id: runId,
    live_namespace: liveNamespace,
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    message: `Embedded and stored ${embeddedCount} chunks in Neon pgvector`,
    outputs: {
      live_namespace: liveNamespace,
      namespace: liveNamespace,
      ingestion_dir: ingestionDir,
      chunks_path: chunksPath,
      embedded_count: embeddedCount,
      stored_chunk_count: chunkStore.stored,
      chunk_store_skipped: "skipped" in chunkStore ? chunkStore.skipped : false,
      chunk_store_reason: "reason" in chunkStore ? chunkStore.reason ?? null : null,
      embed_model: EMBED_MODEL,
    },
    logs: {
      summary: `Embedded ${embeddedCount} chunks via Cloudflare AI; stored ${chunkStore.stored} in Neon pgvector (${liveNamespace}).`,
    },
  };
}

function readJsonl<T>(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function makeLiveNamespace(prefix: unknown, runId: string) {
  const base = typeof prefix === "string" && prefix.trim() ? prefix.trim() : "live-v-";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const suffix = runId.replace(/[^a-zA-Z0-9-]/g, "").slice(-12);
  return `${base}${stamp}-${suffix}`;
}

function requireRunId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("upload.run_id is required");
  }
  return value.trim();
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
