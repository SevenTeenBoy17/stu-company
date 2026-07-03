-- Migration: require post-module quiz before learning credit
-- Created: 2026-06-17
-- Context: Phase 2.2 closes the pure-click scoring loophole. Existing
--          completed rows predate the quiz gate, so they are trusted and
--          backfilled as passed; new rows must be explicitly marked by the
--          server-side quiz grader.

ALTER TABLE "learning_progress"
  ADD COLUMN IF NOT EXISTS "quiz_passed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "learning_progress"
SET "quiz_passed" = true
WHERE "completed_at" IS NOT NULL
  AND "quiz_passed" = false;
