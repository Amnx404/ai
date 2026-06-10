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
      const batchSize = 500;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        await tx.knowledgeChunk.createMany({
          data: batch.map((chunk) => ({
            siteId: normalizedSiteId,
            namespace,
            vectorId: chunk.id,
            runId,
            url: chunk.url ?? "",
            title: chunk.title ?? null,
            description: chunk.description ?? null,
            text: chunk.text,
            source: "scraper",
            pageIndex: chunk.page_index ?? null,
            chunkIndex: chunk.chunk_index ?? null,
            chars: chunk.chars ?? chunk.text.length,
            metadata: {
              run_id: runId,
              source: "scraper",
              page_index: chunk.page_index ?? null,
              chunk_index: chunk.chunk_index ?? null,
            } satisfies Prisma.InputJsonObject,
          })),
          skipDuplicates: true,
        });
        count += batch.length;
      }
      return count;
    });

    return { stored, skipped: false };
  } finally {
    await db.$disconnect().catch(() => {});
  }
}
