-- Migration: persist AI-generated behavior persona on risk_profiles (A2a)
-- Hand-authored: drizzle-kit generate cannot run non-interactively here
-- (pre-existing rank_profiles/risk_profiles name-conflict prompt needs a TTY),
-- same approach as 0015_risk_profiles.sql. Idempotent for local rebuilds.
ALTER TABLE "risk_profiles" ADD COLUMN IF NOT EXISTS "behavior_persona" jsonb;
ALTER TABLE "risk_profiles" ADD COLUMN IF NOT EXISTS "persona_provider" varchar(16);
ALTER TABLE "risk_profiles" ADD COLUMN IF NOT EXISTS "analyzed_at" timestamp with time zone;
ALTER TABLE "risk_profiles" ADD COLUMN IF NOT EXISTS "input_digest" varchar(64);
