CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "namespace" TEXT NOT NULL,
    "vectorId" TEXT NOT NULL,
    "runId" TEXT,
    "url" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "description" TEXT,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'firecrawl',
    "page_index" INTEGER,
    "chunk_index" INTEGER,
    "chars" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunk_namespace_vectorId_key" ON "KnowledgeChunk"("namespace", "vectorId");
CREATE INDEX "KnowledgeChunk_siteId_namespace_idx" ON "KnowledgeChunk"("siteId", "namespace");
CREATE INDEX "KnowledgeChunk_siteId_namespace_url_idx" ON "KnowledgeChunk"("siteId", "namespace", "url");

ALTER TABLE "KnowledgeChunk"
ADD CONSTRAINT "KnowledgeChunk_siteId_fkey"
FOREIGN KEY ("siteId") REFERENCES "Site"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
