import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().optional(),
  SESSION_SECRET:
    process.env.NODE_ENV === "production"
      ? z.string().min(32, "SESSION_SECRET must be ≥32 chars in production")
      : z.string().min(16).optional(),
  DATABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_BASE_URL_PRIMARY: z.string().url().optional(),
  AI_BASE_URL_SECONDARY: z.string().url().optional(),
  BROWN_AGENT_API_KEY: z.string().optional(),
  BROWN_AGENT_BASE_URL: z.string().url().optional(),
  BROWN_AGENT_FALLBACK_BASE_URL: z.string().url().optional(),
  ALLTICK_API_KEY: z.string().optional(),
  ALLTICK_STOCK_BASE_URL: z.string().url().optional(),
  // Transactional email (Resend) for verification + password reset. Optional:
  // when absent, those flows degrade to dev-surfaced links.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  AI_API_KEY: process.env.AI_API_KEY,
  AI_MODEL: process.env.AI_MODEL,
  AI_BASE_URL_PRIMARY: process.env.AI_BASE_URL_PRIMARY,
  AI_BASE_URL_SECONDARY: process.env.AI_BASE_URL_SECONDARY,
  BROWN_AGENT_API_KEY: process.env.BROWN_AGENT_API_KEY,
  BROWN_AGENT_BASE_URL: process.env.BROWN_AGENT_BASE_URL,
  BROWN_AGENT_FALLBACK_BASE_URL: process.env.BROWN_AGENT_FALLBACK_BASE_URL,
  ALLTICK_API_KEY: process.env.ALLTICK_API_KEY,
  ALLTICK_STOCK_BASE_URL: process.env.ALLTICK_STOCK_BASE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
});
