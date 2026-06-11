/**
 * Backfill pgvector embeddings for KnowledgeChunk rows that have no embedding yet.
 * Run once after the pgvector migration:
 *   npx tsx scripts/backfill-embeddings.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const BATCH = 50;
const EMBED_MODEL = "perplexity/pplx-embed-v1-0.6b";
const OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings";

async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch(OPENROUTER_EMBED_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`OpenRouter embed ${res.status}: ${raw}`);
  const json = JSON.parse(raw) as { data?: Array<{ embedding: number[] }> };
  if (!json.data) throw new Error(`OpenRouter embed: unexpected response: ${raw.slice(0, 200)}`);
  return json.data.map((d) => d.embedding);
}

const db = new PrismaClient();

async function main() {
  const [{ count }] = await db.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*)::bigint AS count FROM "KnowledgeChunk" WHERE "embedding" IS NULL
  `;
  const total = Number(count);
  console.log(`Chunks to backfill: ${total}`);
  if (!total) { console.log("Nothing to do."); return; }

  let done = 0;
  while (true) {
    const rows = await db.$queryRaw<Array<{ id: string; text: string }>>`
      SELECT id, text FROM "KnowledgeChunk" WHERE "embedding" IS NULL LIMIT ${BATCH}
    `;
    if (!rows.length) break;

    const embeddings = await embedBatch(rows.map((r) => r.text));
    const ids = rows.map((r) => r.id);
    const embedStrs = embeddings.map((e) => JSON.stringify(e));

    await db.$executeRaw`
      UPDATE "KnowledgeChunk" AS kc
      SET "embedding" = updates.emb::vector
      FROM (
        SELECT unnest(${ids}::text[]) AS rid,
               unnest(${embedStrs}::text[]) AS emb
      ) AS updates
      WHERE kc.id = updates.rid
    `;

    done += rows.length;
    console.log(`  ${done}/${total} (${Math.round((done / total) * 100)}%)`);
  }

  console.log(`Done — ${done} chunks backfilled.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
