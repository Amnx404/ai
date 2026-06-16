import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "~/env.js";

export { resolvePineconeTarget } from "./pinecone-resolve";

let _pinecone: Pinecone | null = null;

export function getPinecone() {
  if (!_pinecone) {
    if (!env.PINECONE_API_KEY) throw new Error("PINECONE_API_KEY is not set");
    _pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return _pinecone;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  text: string;
  title?: string;
  url?: string;
  metadata: Record<string, unknown>;
}

export type RerankResult = {
  chunks: RetrievedChunk[];
  model: string;
  usage?: unknown;
};

let rerankDisabledUntil = 0;
const OPENROUTER_RERANK_URL = "https://openrouter.ai/api/v1/rerank";
const DEFAULT_RERANK_MODEL = "cohere/rerank-4-pro";

export async function queryPinecone({
  indexName,
  namespace,
  indexHostUrl,
  queryEmbedding,
  topK = 5,
  scoreThreshold = 0.5,
}: {
  indexName: string;
  namespace: string;
  indexHostUrl?: string;
  queryEmbedding: number[];
  topK?: number;
  scoreThreshold?: number;
}): Promise<RetrievedChunk[]> {
  const pinecone = getPinecone();
  const index = pinecone.index(indexName, indexHostUrl);

  const result = await index.namespace(namespace).query({
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
  });

  return (result.matches ?? [])
    .filter((m) => (m.score ?? 0) >= scoreThreshold)
    .map((m) => ({
      id: m.id,
      score: m.score ?? 0,
      text: String(m.metadata?.text ?? m.metadata?.content ?? ""),
      title: m.metadata?.title ? String(m.metadata.title) : undefined,
      url: m.metadata?.url ? String(m.metadata.url) : undefined,
      metadata: {
        ...((m.metadata as Record<string, unknown>) ?? {}),
        retrieval_methods: ["dense"],
        dense_score: m.score ?? 0,
      },
    }));
}

export async function rerankChunks({
  query,
  chunks,
  topN,
  model = env.OPENROUTER_RERANK_MODEL ?? DEFAULT_RERANK_MODEL,
}: {
  query: string;
  chunks: RetrievedChunk[];
  topN: number;
  model?: string;
}): Promise<RerankResult> {
  if (!query.trim() || chunks.length === 0) {
    return { chunks: chunks.slice(0, topN), model };
  }

  if (Date.now() < rerankDisabledUntil) {
    throw new Error("OpenRouter rerank temporarily disabled after rate limiting");
  }

  const documents = chunks.map((chunk) =>
    [
      chunk.title ? `Title: ${chunk.title}` : "",
      chunk.url ? `URL: ${chunk.url}` : "",
      chunk.text,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 6_000),
  );

  let result: OpenRouterRerankResponse;
  try {
    result = await openRouterRerank({ model, query, documents, topN });
  } catch (error) {
    if (isRerankRateLimitError(error)) {
      rerankDisabledUntil = Date.now() + 5 * 60 * 1000;
    }
    throw error;
  }

  const rankedChunks: RetrievedChunk[] = [];
  for (const ranked of result.results ?? []) {
    const original = chunks[ranked.index];
    const score = typeof ranked.relevance_score === "number" ? ranked.relevance_score : ranked.score;
    if (!original) continue;
    if (typeof score !== "number" || !Number.isFinite(score)) continue;
    rankedChunks.push({
      ...original,
      score,
      metadata: {
        ...original.metadata,
        rerank_score: score,
        rerank_model: result.model,
        rerank_provider: result.provider ?? "openrouter",
      },
    });
  }

  return {
    chunks: rankedChunks,
    model: result.model ?? model,
    usage: {
      ...(isRecord(result.usage) ? result.usage : { usage: result.usage }),
      id: result.id,
      provider: result.provider,
    },
  };
}

type OpenRouterRerankResponse = {
  id?: string;
  model?: string;
  provider?: string;
  results?: Array<{
    index: number;
    relevance_score?: number;
    score?: number;
  }>;
  usage?: unknown;
};

async function openRouterRerank({
  model,
  query,
  documents,
  topN,
}: {
  model: string;
  query: string;
  documents: string[];
  topN: number;
}): Promise<OpenRouterRerankResponse> {
  const response = await fetch(OPENROUTER_RERANK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXTAUTH_URL,
      "X-Title": "ALT EGO",
    },
    body: JSON.stringify({
      model,
      query,
      documents,
      top_n: topN,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`OpenRouter rerank failed (${response.status}): ${text.slice(0, 500)}`);
  }

  try {
    return JSON.parse(text) as OpenRouterRerankResponse;
  } catch {
    throw new Error(`OpenRouter rerank returned invalid JSON: ${text.slice(0, 500)}`);
  }
}

function isRerankRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|rerank request limit|status:?\s*429|\(429\)/i.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function upsertChunks(
  indexName: string,
  namespace: string,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: RecordMetadata;
  }>
) {
  return upsertChunksToHost(indexName, namespace, vectors);
}

export async function upsertChunksToHost(
  indexName: string,
  namespace: string,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: RecordMetadata;
  }>,
  indexHostUrl?: string
) {
  const pinecone = getPinecone();
  const index = pinecone.index(indexName, indexHostUrl);
  await index.namespace(namespace).upsert(vectors);
}
