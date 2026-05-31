-- Migration: add email verification column to users
-- Created: 2026-05-30
-- Context: Brown Zone 2.0 — A1 account integrity. `email_verified_at` is null until
--          the user confirms their email via the signed link (/api/auth/verify).
--          Verification is tracked now; enforcement (gating AI behind it) is
--          deferred until an email-sending provider is configured.

ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp;
