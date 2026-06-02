-- Migration: per-user lesson completion (learning component of power score)
-- Created: 2026-06-01
-- Context: Option A (view/learn-based) — a row means the student marked a module
--          learned. learningCompleted/learningTotal feed the 0.15-weighted
--          learning component. A future quiz gate (Option B) would add a score.

CREATE TABLE "learning_progress" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL REFERENCES "users"("id"),
  "module_key" varchar(48) NOT NULL,
  "completed_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "learning_progress_user_module_unique" ON "learning_progress" ("user_id", "module_key");
CREATE INDEX "learning_progress_user_idx" ON "learning_progress" ("user_id");
