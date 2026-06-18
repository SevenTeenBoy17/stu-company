-- Migration: make prediction records follow their run/user lifecycle
-- Created: 2026-06-18
-- Context: seed/reset deletes scenario_runs before recreating them. Predictions
--          are decorative activity records, so they should cascade with the run.

ALTER TABLE "round_predictions"
  DROP CONSTRAINT IF EXISTS "round_predictions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "round_predictions"
  ADD CONSTRAINT "round_predictions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "round_predictions"
  DROP CONSTRAINT IF EXISTS "round_predictions_run_id_scenario_runs_id_fk";
--> statement-breakpoint
ALTER TABLE "round_predictions"
  ADD CONSTRAINT "round_predictions_run_id_scenario_runs_id_fk"
  FOREIGN KEY ("run_id") REFERENCES "scenario_runs"("id")
  ON DELETE cascade ON UPDATE no action;
