import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
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

export async function runUpload(request: UploadRequest): Promise<ApiStatus> {
  const started = new Date();
  const runId = requireRunId(request.run_id);
  const apiKey = process.env.PINECONE_API_KEY?.trim();
  if (!apiKey) throw new Error("PINECONE_API_KEY is not set");

  const indexName = process.env.PINECONE_INDEX?.trim();
  if (!indexName) throw new Error("PINECONE_INDEX is not set");

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

  const liveNamespace = request.staging_namespace?.trim() || makeLiveNamespace(request.live_prefix, runId);
  const embedModel = request.embed_model?.trim() || process.env.PINECONE_EMBED_MODEL?.trim() || "llama-text-embed-v2";
  const embedBatchSize = clampInteger(request.embed_batch_size, 64, 1, 96);
  const upsertBatchSize = clampInteger(request.batch_size, 200, 1, 1000);
  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName, process.env.PINECONE_INDEX_HOST?.trim() || undefined);
  const namespace = index.namespace(liveNamespace);
  let upsertedCount = 0;

  for (let i = 0; i < chunks.length; i += embedBatchSize) {
    const batch = chunks.slice(i, i + embedBatchSize);
    const embeddings = await embedTextsWithRetry(pc, embedModel, batch.map((chunk) => chunk.text));
    const vectors = batch.map((chunk, offset) => ({
      id: chunk.id,
      values: embeddings[offset] ?? [],
      metadata: chunkMetadata(chunk, runId),
    }));

    for (let j = 0; j < vectors.length; j += upsertBatchSize) {
      await namespace.upsert(vectors.slice(j, j + upsertBatchSize));
      upsertedCount += vectors.slice(j, j + upsertBatchSize).length;
    }
  }

  const chunkStore = await storeKnowledgeChunks({
    siteId: request.site_id,
    namespace: liveNamespace,
    runId,
    chunks,
  });

  const finished = new Date();
  return {
    ok: true,
    step: "upload",
    run_id: runId,
    live_namespace: liveNamespace,
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    message: `Uploaded ${upsertedCount} chunks to Pinecone`,
    outputs: {
      live_namespace: liveNamespace,
      namespace: liveNamespace,
      pinecone_namespace: liveNamespace,
      index_name: indexName,
      index_host: process.env.PINECONE_INDEX_HOST?.trim() || null,
      ingestion_dir: ingestionDir,
      chunks_path: chunksPath,
      upserted_count: upsertedCount,
      stored_chunk_count: chunkStore.stored,
      chunk_store_skipped: chunkStore.skipped,
      chunk_store_reason: "reason" in chunkStore ? chunkStore.reason ?? null : null,
      embed_model: embedModel,
    },
    logs: {
      summary: `Uploaded ${upsertedCount} vectors to ${indexName}/${liveNamespace}; stored ${chunkStore.stored} chunks for lexical retrieval.`,
    },
  };
}

async function embedTextsWithRetry(pc: Pinecone, model: string, texts: string[]) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await embedTexts(pc, model, texts);
    } catch (error) {
      if (attempt >= maxAttempts || !isPineconeRateLimit(error)) throw error;
      await sleep(65_000);
    }
  }
  throw new Error("Pinecone embed failed");
}

async function embedTexts(pc: Pinecone, model: string, texts: string[]) {
  const res = await pc.inference.embed(model, texts, {
    inputType: "passage",
    truncate: "END",
  });
  return res.data.map((embedding) => (embedding.values ?? []) as number[]);
}

function isPineconeRateLimit(error: unknown) {
  if (!error) return false;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : JSON.stringify(error);
  return /429|RESOURCE_EXHAUSTED|max tokens per minute/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkMetadata(chunk: PreparedChunk, runId: string): RecordMetadata {
  return {
    text: chunk.text,
    content: chunk.text,
    title: chunk.title ?? chunk.url ?? "Untitled page",
    url: chunk.url ?? "",
    description: chunk.description ?? "",
    run_id: runId,
    page_index: chunk.page_index ?? 0,
    chunk_index: chunk.chunk_index ?? 0,
    chars: chunk.chars ?? chunk.text.length,
    source: "scraper",
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
