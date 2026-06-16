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
        const data = batch.map((chunk) => {
          const text = sanitizeDbText(chunk.text);
          return {
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
            } satisfies Prisma.InputJsonObject,
          };
        });

        let inserted = 0;
        try {
          const result = await tx.knowledgeChunk.createMany({
            data,
            skipDuplicates: true,
          });
          inserted = result.count;
        } catch {
          for (const row of data) {
            try {
              await tx.knowledgeChunk.create({ data: row });
              inserted++;
            } catch (error) {
              if (!isDuplicateError(error)) throw error;
            }
          }
        }

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
  return value
    .replace(/\u0000/g, "")
    .replace(/\\/g, "/");
}

function isDuplicateError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002");
}
