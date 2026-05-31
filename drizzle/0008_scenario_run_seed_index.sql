-- Migration: index scenario_runs.seed for the weekly season leaderboard
-- Created: 2026-05-30
-- Context: getSeasonLeaderboard filters runs by the current season seed; without
--          an index this scanned the whole table. Full index to match the Drizzle
--          schema declaration (index().on(table.seed)) so db:generate stays in sync.

CREATE INDEX "scenario_runs_seed_idx" ON "scenario_runs" ("seed");
