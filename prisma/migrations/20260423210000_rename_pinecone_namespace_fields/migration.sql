-- Rename live namespace column on Site to snake_case.
ALTER TABLE "Site" RENAME COLUMN "livePineconeNs" TO "live_pinecone_namespace";

-- Rename KB run namespace column to explicit pinecone namespace.
ALTER TABLE "KnowledgeBaseRun" RENAME COLUMN "liveNamespace" TO "pinecone_namespace";

