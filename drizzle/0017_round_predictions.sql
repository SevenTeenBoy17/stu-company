-- Migration: decorative guess-the-direction activity
-- Created: 2026-06-18
-- Context: Phase 3.2 Step 1. Predictions are activity records only:
--          they must never affect net worth or financial-power scoring.

CREATE TABLE IF NOT EXISTS "round_predictions" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "run_id" varchar(64) NOT NULL,
  "round" integer NOT NULL,
  "guess" varchar(8) NOT NULL,
  "resolved" boolean DEFAULT false NOT NULL,
  "correct" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "resolved_at" timestamp,
  CONSTRAINT "round_predictions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "round_predictions_run_id_scenario_runs_id_fk"
    FOREIGN KEY ("run_id") REFERENCES "scenario_runs"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "round_predictions_user_run_round_unique"
  ON "round_predictions" ("user_id", "run_id", "round");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_predictions_run_round_idx"
  ON "round_predictions" ("run_id", "round");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "round_predictions_user_id_idx"
  ON "round_predictions" ("user_id");
