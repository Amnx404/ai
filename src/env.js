import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url(),
    RESEND_API_KEY: z.string().min(1).optional(),
    /** e.g. `RoboRacer <noreply@yourdomain.com>` — must be a domain verified in Resend */
    RESEND_FROM: z.string().min(1).optional(),
    LANGFUSE_SECRET_KEY: z.string().min(1).optional(),
    LANGFUSE_PUBLIC_KEY: z.string().min(1).optional(),
    LANGFUSE_BASE_URL: z.string().min(1).optional(),
    LANGFUSE_PROJECT_ID: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1),
    PINECONE_API_KEY: z.string().min(1),
    PINECONE_INDEX: z.string().min(1),
    // Optional: Pinecone data-plane host for this index (copied from Pinecone console).
    // When set, we can bypass controller lookup and hit the index endpoint directly.
    PINECONE_INDEX_HOST: z.string().url().optional(),
    // Optional: Pinecone Inference embedding model id (must match index dimension).
    PINECONE_EMBED_MODEL: z.string().min(1).optional(),
    // Internal scraper pipeline service (FastAPI) base URL.
    SCRAPER_PIPELINE_BASE_URL: z.string().url().optional(),
    // Public base URL that the scraper pipeline can POST callbacks to.
    // Example: https://app.yourdomain.com
    callback_URL: z.string().url().optional(),
    // Optional: default finetune model id used by /prepare when finetune=true.
    SCRAPER_FINETUNE_MODEL: z.string().min(1).optional(),
    // Prompt used by scraper pipeline when finetune=true (markdown cleaner).
    FINETUNE_PROMPT: z.string().min(1).optional(),
    WIDGET_JWT_SECRET: z.string().min(1),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {},
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL,
    LANGFUSE_PROJECT_ID: process.env.LANGFUSE_PROJECT_ID,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX,
    PINECONE_INDEX_HOST: process.env.PINECONE_INDEX_HOST,
    PINECONE_EMBED_MODEL: process.env.PINECONE_EMBED_MODEL,
    SCRAPER_PIPELINE_BASE_URL: process.env.SCRAPER_PIPELINE_BASE_URL,
    callback_URL: process.env.callback_URL,
    SCRAPER_FINETUNE_MODEL: process.env.SCRAPER_FINETUNE_MODEL,
    FINETUNE_PROMPT: process.env.FINETUNE_PROMPT,
    WIDGET_JWT_SECRET: process.env.WIDGET_JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
