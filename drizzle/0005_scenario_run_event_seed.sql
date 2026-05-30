-- Migration: add seeded random-event engine columns to scenario_runs
-- Created: 2026-05-30
-- Context: Brown Zone 2.0 — random financial event engine (src/lib/event-engine.ts).
--          `seed` makes a run reproducible; `event_timeline` stores the per-round
--          event ids chosen from that seed (index 0 = round 1). Both nullable:
--          legacy runs created before the engine fall back to the fixed script.

ALTER TABLE "scenario_runs" ADD COLUMN "seed" integer;
ALTER TABLE "scenario_runs" ADD COLUMN "event_timeline" jsonb;
