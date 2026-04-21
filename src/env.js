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
    OPENROUTER_API_KEY: z.string().min(1),
    PINECONE_API_KEY: z.string().min(1),
    PINECONE_INDEX: z.string().min(1),
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
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    PINECONE_API_KEY: process.env.PINECONE_API_KEY,
    PINECONE_INDEX: process.env.PINECONE_INDEX,
    WIDGET_JWT_SECRET: process.env.WIDGET_JWT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
