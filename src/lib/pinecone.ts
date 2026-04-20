import { Pinecone, type RecordMetadata } from "@pinecone-database/pinecone";
import { env } from "~/env.js";

let _pinecone: Pinecone | null = null;

export function getPinecone() {
  if (!_pinecone) {
    _pinecone = new Pinecone({ apiKey: env.PINECONE_API_KEY });
  }
  return _pinecone;
}

export function getNamespace(siteId: string, liveVersion?: number) {
  if (liveVersion && liveVersion > 0) {
    return `site-${siteId}-live-v${liveVersion}`;
  }
  return `site-${siteId}`;
}

export interface RetrievedChunk {
  id: string;
  score: number;
  text: string;
  title?: string;
  url?: string;
  metadata: Record<string, unknown>;
}

export async function queryPinecone({
  indexName,
  namespace,
  queryEmbedding,
  topK = 5,
  scoreThreshold = 0.5,
}: {
  indexName: string;
  namespace: string;
  queryEmbedding: number[];
  topK?: number;
  scoreThreshold?: number;
}): Promise<RetrievedChunk[]> {
  const pinecone = getPinecone();
  const index = pinecone.index(indexName);

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
      metadata: (m.metadata as Record<string, unknown>) ?? {},
    }));
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
  const pinecone = getPinecone();
  const index = pinecone.index(indexName);
  await index.namespace(namespace).upsert(vectors);
}
