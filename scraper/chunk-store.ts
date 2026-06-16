import { randomUUID } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

type StoredChunk = {
  id: string;
  url?: string;
  title?: string | null;
  description?: string | null;
  text: string;
  page_index?: number;
  chunk_index?: number;
  chars?: number;
  embedding?: number[] | null;
};

type KnowledgeChunkInsertRow = {
  id: string;
  siteId: string;
  namespace: string;
  vectorId: string;
  runId: string;
  url: string;
  title: string | null;
  description: string | null;
  text: string;
  source: string;
  pageIndex: number | null;
  chunkIndex: number | null;
  chars: number;
  metadata: Prisma.InputJsonObject;
};

export async function storeKnowledgeChunks({
  siteId,
  namespace,
  runId,
  chunks,
}: {
  siteId?: string | null;
  namespace: string;
  runId: string;
  chunks: StoredChunk[];
}) {
  const normalizedSiteId = siteId?.trim();
  if (!normalizedSiteId) {
    return { stored: 0, skipped: true, reason: "missing_site_id" };
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return { stored: 0, skipped: true, reason: "missing_database_url" };
  }

  const db = new PrismaClient();
  try {
    const stored = await db.$transaction(async (tx) => {
      await tx.knowledgeChunk.deleteMany({
        where: { siteId: normalizedSiteId, namespace },
      });

      let count = 0;
      const batchSize = 100;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const data: KnowledgeChunkInsertRow[] = batch.map((chunk) => {
          const text = sanitizeDbText(chunk.text);
          return {
            id: `kc_${randomUUID()}`,
            siteId: normalizedSiteId,
            namespace,
            vectorId: sanitizeDbText(chunk.id),
            runId: sanitizeDbText(runId),
            url: sanitizeDbText(chunk.url ?? ""),
            title: chunk.title == null ? null : sanitizeDbText(chunk.title),
            description: chunk.description == null ? null : sanitizeDbText(chunk.description),
            text,
            source: "scraper",
            pageIndex: chunk.page_index ?? null,
            chunkIndex: chunk.chunk_index ?? null,
            chars: chunk.chars ?? text.length,
            metadata: {
              run_id: runId,
              source: "scraper",
              page_index: chunk.page_index ?? null,
              chunk_index: chunk.chunk_index ?? null,
            },
          };
        });

        const inserted = await insertKnowledgeChunkRows(tx, data);

        // Store embeddings via raw SQL — Prisma createMany can't write vector columns.
        const withEmbeddings = batch.filter((c) => c.embedding?.length);
        if (withEmbeddings.length) {
          const vectorIds = withEmbeddings.map((c) => c.id);
          const embedStrs = withEmbeddings.map((c) => JSON.stringify(c.embedding));
          await tx.$executeRaw`
            UPDATE "KnowledgeChunk" AS kc
            SET "embedding" = updates.emb::vector
            FROM (
              SELECT unnest(${vectorIds}::text[]) AS vid,
                     unnest(${embedStrs}::text[]) AS emb
            ) AS updates
            WHERE kc."vectorId"   = updates.vid
              AND kc."siteId"     = ${normalizedSiteId}
              AND kc."namespace"  = ${namespace}
          `;
        }

        count += inserted;
      }
      return count;
    });

    return { stored, skipped: false };
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

function sanitizeDbText(value: string) {
  return value.replace(/\u0000/g, "");
}

async function insertKnowledgeChunkRows(tx: Prisma.TransactionClient, rows: KnowledgeChunkInsertRow[]) {
  if (!rows.length) return 0;

  const values = rows.map((row) => {
    return Prisma.sql`(
      ${row.id},
      ${row.siteId},
      ${row.namespace},
      ${row.vectorId},
      ${row.runId},
      ${row.url},
      ${row.title},
      ${row.description},
      ${row.text},
      ${row.source},
      ${row.pageIndex},
      ${row.chunkIndex},
      ${row.chars},
      ${JSON.stringify(row.metadata)}::jsonb
    )`;
  });

  return tx.$executeRaw(Prisma.sql`
    INSERT INTO "KnowledgeChunk" (
      "id",
      "siteId",
      "namespace",
      "vectorId",
      "runId",
      "url",
      "title",
      "description",
      "text",
      "source",
      "page_index",
      "chunk_index",
      "chars",
      "metadata"
    )
    VALUES ${Prisma.join(values)}
    ON CONFLICT ("namespace", "vectorId") DO NOTHING
  `);
}
