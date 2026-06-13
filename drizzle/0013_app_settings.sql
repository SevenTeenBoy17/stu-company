-- Migration: application-level settings
-- Created: 2026-06-12
-- Context: store operator-managed, non-secret runtime configuration such as
--          manual WeChat collection QR metadata. Secrets still belong in env.

CREATE TABLE IF NOT EXISTS "app_settings" (
  "key" varchar(120) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_by" varchar(64) REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "app_settings_updated_by_idx" ON "app_settings" ("updated_by");
