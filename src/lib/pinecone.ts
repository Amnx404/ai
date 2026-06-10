import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "~/env.js";

export { resolvePineconeTarget } from "./pinecone-resolve";

let _pinecone: Pinecone | null = null;

export function getPinecone() {
  if (!_pinecone) {
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
  model = env.PINECONE_RERANK_MODEL ?? "bge-reranker-v2-m3",
}: {
  query: string;
  chunks: RetrievedChunk[];
  topN: number;
  model?: string;
}): Promise<RerankResult> {
  if (!query.trim() || chunks.length === 0) {
    return { chunks: chunks.slice(0, topN), model };
  }

  const pinecone = getPinecone();
  const documents = chunks.map((chunk) => ({
    title: chunk.title ?? "",
    url: chunk.url ?? "",
    text: chunk.text.slice(0, 6_000),
  }));

  const result = await pinecone.inference.rerank(model, query, documents, {
    topN,
    returnDocuments: false,
    rankFields: ["text"],
    parameters: { truncate: "END" },
  });

  const rankedChunks: RetrievedChunk[] = [];
  for (const ranked of result.data) {
    const original = chunks[ranked.index];
    if (!original) continue;
    rankedChunks.push({
      ...original,
      score: ranked.score,
      metadata: {
        ...original.metadata,
        rerank_score: ranked.score,
        rerank_model: result.model,
      },
    });
  }

  return {
    chunks: rankedChunks,
    model: result.model,
    usage: result.usage,
  };
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
