-- Add user subscription tier

CREATE TYPE "UserPlan" AS ENUM ('FREE', 'PRO', 'MAX');

ALTER TABLE "User"
ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'FREE';

