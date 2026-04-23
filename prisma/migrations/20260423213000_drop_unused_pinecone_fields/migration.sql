-- Drop unused per-site Pinecone override fields.
ALTER TABLE "Site" DROP COLUMN IF EXISTS "pineconeIndex";
ALTER TABLE "Site" DROP COLUMN IF EXISTS "pineconeNs";
ALTER TABLE "Site" DROP COLUMN IF EXISTS "liveVersion";

