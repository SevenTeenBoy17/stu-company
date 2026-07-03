-- Migration: persist student risk-profile questionnaire results
-- Created: 2026-06-17
-- Context: drizzle-kit generate prompts for a rank_profiles/risk_profiles table
--          name conflict in non-TTY Codex runs. Hand-authored to match schema.ts
--          and kept idempotent for local rebuilds.

CREATE TABLE IF NOT EXISTS "risk_profiles" (
  "user_id" varchar(64) PRIMARY KEY NOT NULL,
  "risk_label" text NOT NULL,
  "answers" jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "risk_profiles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE no action ON UPDATE no action
);
