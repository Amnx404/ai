import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { replaceKnowledgeChunks } from "~/lib/knowledge-chunks";
import { embedTextsForIngest } from "~/lib/embed";
import { resolvePineconeTarget } from "~/lib/pinecone-resolve";
import { env } from "~/env.js";

const bodySchema = z.object({
  siteId: z.string(),
  chunks: z.array(
    z.object({
      id: z.string(),
      text: z.string().min(1),
      title: z.string().optional(),
      url: z.string().optional(),
      metadata: z.record(z.unknown()).default({}),
    })
  ).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { siteId, chunks } = parsed.data;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  const site = await db.site.findFirst({
    where: { id: siteId, orgId: user?.orgId ?? "" },
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const { namespace } = resolvePineconeTarget(site, "", env.PINECONE_INDEX_HOST);

  const BATCH = 50;
  let embedded = 0;
  const chunksWithEmbeddings: Array<typeof chunks[number] & { embedding: number[] }> = [];

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embeddings = await embedTextsForIngest(batch.map((c) => c.text));
    for (let j = 0; j < batch.length; j++) {
      chunksWithEmbeddings.push({ ...batch[j]!, embedding: embeddings[j] ?? [] });
      embedded++;
    }
  }

  const stored = await replaceKnowledgeChunks({
    siteId,
    namespace,
    chunks: chunksWithEmbeddings.map((c) => ({
      vectorId: c.id,
      text: c.text,
      title: c.title ?? null,
      url: c.url ?? "",
      source: "manual",
      embedding: c.embedding,
      metadata: {
        ...((c.metadata ?? {}) as Record<string, string | number | boolean>),
        source: "manual",
      },
    })),
  });

  return NextResponse.json({ upserted: embedded, namespace, stored: stored.stored });
}
