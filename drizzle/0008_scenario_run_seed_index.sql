-- Migration: index scenario_runs.seed for the weekly season leaderboard
-- Created: 2026-05-30
-- Context: getSeasonLeaderboard filters runs by the current season seed; without
--          an index this scanned the whole table. Partial index (seed IS NOT NULL)
--          since legacy pre-engine runs have NULL seed.

CREATE INDEX "scenario_runs_seed_idx" ON "scenario_runs" ("seed") WHERE "seed" IS NOT NULL;
