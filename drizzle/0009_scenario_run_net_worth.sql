-- Migration: materialize net_worth + composite season-ranking index
-- Created: 2026-05-30
-- Context: the weekly season leaderboard ranks by net worth. net_worth is now
--          stored on the run (kept in sync in commitSnapshot) so the board can be
--          answered with ORDER BY net_worth DESC LIMIT N off a composite index,
--          instead of loading every season run and sorting in the app.

ALTER TABLE "scenario_runs" ADD COLUMN "net_worth" integer;

DROP INDEX IF EXISTS "scenario_runs_seed_idx";
CREATE INDEX "scenario_runs_seed_net_worth_idx" ON "scenario_runs" ("seed", "net_worth");
