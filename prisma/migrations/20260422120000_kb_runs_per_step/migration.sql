-- Make KnowledgeBaseRun store one row per (runId, step).
-- Previously, runId was unique which forced a single row per run.

-- Drop old unique index on runId (name is Prisma-default; keep IF EXISTS).
DROP INDEX IF EXISTS "KnowledgeBaseRun_runId_key";

-- Enforce uniqueness per stage within a run.
CREATE UNIQUE INDEX "KnowledgeBaseRun_runId_step_key"
ON "KnowledgeBaseRun" ("runId", "step");

-- Helpful lookup index by runId.
CREATE INDEX "KnowledgeBaseRun_runId_idx"
ON "KnowledgeBaseRun" ("runId");

