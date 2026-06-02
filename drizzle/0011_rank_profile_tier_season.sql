-- Migration: season-scope the soft floor (decision 7)
-- Created: 2026-06-01
-- Context: the tier soft floor must hold WITHIN a season (semester) and reset
--          ACROSS seasons. Track which season the high-water last_tier belongs
--          to so recompute can reset it when the semester rolls over.

ALTER TABLE "rank_profiles" ADD COLUMN "last_tier_season" varchar(32) DEFAULT '' NOT NULL;
