-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "livePineconeNs" TEXT;
ALTER TABLE "Site" ADD COLUMN     "scrapeConfig" JSONB;

-- CreateTable
CREATE TABLE "KnowledgeBaseRun" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "params" JSONB,
    "outputs" JSONB,
    "logs" JSONB,
    "message" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBaseRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeBaseRun_runId_key" ON "KnowledgeBaseRun"("runId");

-- CreateIndex
CREATE INDEX "KnowledgeBaseRun_siteId_createdAt_idx" ON "KnowledgeBaseRun"("siteId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeBaseRun" ADD CONSTRAINT "KnowledgeBaseRun_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

