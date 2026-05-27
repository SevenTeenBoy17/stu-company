-- Migration: add trial/subscription/onboarding columns to users table
-- Created: 2026-05-27
-- Context: Brown Zone 2.0 — email registration, trial system, onboarding flow

ALTER TABLE "users" ADD COLUMN "trial_expires_at" timestamp;
ALTER TABLE "users" ADD COLUMN "subscription_tier" varchar(20) NOT NULL DEFAULT 'free';
ALTER TABLE "users" ADD COLUMN "onboarding_completed" integer NOT NULL DEFAULT 0;

-- Backfill existing users: mark them as having completed onboarding (they're pre-2.0 users)
UPDATE "users" SET "onboarding_completed" = 1 WHERE "onboarding_completed" = 0;
