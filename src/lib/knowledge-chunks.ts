import { Prisma } from "@prisma/client";

import { db } from "~/server/db";
import type { RetrievedChunk } from "~/lib/pinecone";

type KnowledgeChunkInput = {
  vectorId: string;
  runId?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  text: string;
  source?: string | null;
  pageIndex?: number | null;
  chunkIndex?: number | null;
  chars?: number | null;
  metadata?: Prisma.InputJsonValue | null;
  embedding?: number[] | null;
};

type LexicalRow = {
  vectorId: string;
  text: string;
  title: string | null;
  url: string;
  metadata: Prisma.JsonValue | null;
  score: number | null;
};

type DenseRow = {
  vectorId: string;
  text: string;
  title: string | null;
  url: string;
  metadata: Prisma.JsonValue | null;
  score: number;
};

// Weighted full-text document: a title hit should outrank a body hit. Postgres
// ts_rank_cd honours the A/B/C/D weight classes, so we tag each field instead of
// flattening everything into one undifferentiated tsvector.
//   A = title, B = description, C = url, D = body text
const TEXT_DOCUMENT_SQL = Prisma.sql`(
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("url", '')), 'C') ||
  setweight(to_tsvector('english', coalesce("text", '')), 'D')
)`;

export async function replaceKnowledgeChunks({
  siteId,
  namespace,
  chunks,
}: {
  siteId: string;
  namespace: string;
  chunks: KnowledgeChunkInput[];
}) {
  if (!chunks.length) return { stored: 0 };

  const stored = await db.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({
      where: { siteId, namespace },
    });

    let count = 0;
    const batchSize = 500;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await tx.knowledgeChunk.createMany({
        data: batch.map((chunk) => ({
          siteId,
          namespace,
          vectorId: chunk.vectorId,
          runId: chunk.runId ?? null,
          url: chunk.url ?? "",
          title: chunk.title ?? null,
          description: chunk.description ?? null,
          text: chunk.text,
          source: chunk.source ?? "manual",
          pageIndex: chunk.pageIndex ?? null,
          chunkIndex: chunk.chunkIndex ?? null,
          chars: chunk.chars ?? chunk.text.length,
          metadata: chunk.metadata ?? Prisma.JsonNull,
        })),
        skipDuplicates: true,
      });

      // Store embeddings via raw SQL — Prisma createMany can't write Unsupported types.
      const withEmbeddings = batch.filter((c) => c.embedding?.length);
      if (withEmbeddings.length) {
        const vectorIds = withEmbeddings.map((c) => c.vectorId);
        const embedStrs = withEmbeddings.map((c) => JSON.stringify(c.embedding));
        await tx.$executeRaw`
          UPDATE "KnowledgeChunk" AS kc
          SET "embedding" = updates.emb::vector
          FROM (
            SELECT unnest(${vectorIds}::text[]) AS vid,
                   unnest(${embedStrs}::text[]) AS emb
          ) AS updates
          WHERE kc."vectorId" = updates.vid
            AND kc."siteId"    = ${siteId}
            AND kc."namespace" = ${namespace}
        `;
      }

      count += batch.length;
    }
    return count;
  });

  return { stored };
}

export async function searchKnowledgeChunks({
  siteId,
  namespace,
  query,
  limit = 12,
}: {
  siteId: string;
  namespace: string;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!siteId || !namespace || !trimmed) return [];

  const rows = await db.$queryRaw<LexicalRow[]>(Prisma.sql`
    WITH q AS (
      SELECT websearch_to_tsquery('english', ${trimmed}) AS query
    )
    SELECT
      "vectorId",
      "text",
      "title",
      "url",
      "metadata",
      ts_rank_cd(${TEXT_DOCUMENT_SQL}, q.query) AS "score"
    FROM "KnowledgeChunk", q
    WHERE "siteId" = ${siteId}
      AND "namespace" = ${namespace}
      AND ${TEXT_DOCUMENT_SQL} @@ q.query
    ORDER BY "score" DESC, "chunk_index" ASC NULLS LAST
    LIMIT ${Math.max(1, Math.min(50, Math.trunc(limit)))}
  `);

  return rows.map((row) => {
    const metadata = jsonObject(row.metadata);
    const score = Number(row.score ?? 0);
    return {
      id: row.vectorId,
      score,
      text: row.text,
      title: row.title ?? undefined,
      url: row.url || undefined,
      metadata: {
        ...metadata,
        retrieval_methods: mergeRetrievalMethods(metadata.retrieval_methods, "lexical"),
        lexical_score: score,
      },
    };
  });
}

export async function searchKnowledgeChunksDense({
  siteId,
  namespace,
  queryEmbedding,
  limit = 12,
  scoreThreshold = 0.05,
}: {
  siteId: string;
  namespace: string;
  queryEmbedding: number[];
  limit?: number;
  scoreThreshold?: number;
}): Promise<RetrievedChunk[]> {
  if (!siteId || !namespace || !queryEmbedding.length) return [];

  const vectorStr = JSON.stringify(queryEmbedding);
  const safeLimit = Math.max(1, Math.min(50, Math.trunc(limit)));

  const rows = await db.$queryRaw<DenseRow[]>(Prisma.sql`
    SELECT
      "vectorId",
      "text",
      "title",
      "url",
      "metadata",
      (1 - ("embedding" <=> ${vectorStr}::vector)) AS "score"
    FROM "KnowledgeChunk"
    WHERE "siteId"    = ${siteId}
      AND "namespace" = ${namespace}
      AND "embedding" IS NOT NULL
      AND (1 - ("embedding" <=> ${vectorStr}::vector)) >= ${scoreThreshold}
    ORDER BY "embedding" <=> ${vectorStr}::vector ASC
    LIMIT ${safeLimit}
  `);

  return rows.map((row) => {
    const metadata = jsonObject(row.metadata);
    const score = Number(row.score ?? 0);
    return {
      id: row.vectorId,
      score,
      text: row.text,
      title: row.title ?? undefined,
      url: row.url || undefined,
      metadata: {
        ...metadata,
        retrieval_methods: mergeRetrievalMethods(metadata.retrieval_methods, "dense"),
        dense_score: score,
      },
    };
  });
}

function jsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeRetrievalMethods(value: unknown, method: string) {
  const methods = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
  return Array.from(new Set([...methods, method]));
}
