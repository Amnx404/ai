-- Store the full pipeline JSON response per stage.

ALTER TABLE "KnowledgeBaseRun"
ADD COLUMN IF NOT EXISTS "response" JSONB;

