-- Migration: family group membership (Option B)
-- Created: 2026-05-30
-- Context: Brown Zone 2.0 — Premium "family" entitlement. A Premium owner (parent)
--          hosts up to features.maxStudents students who inherit Premium while the
--          owner's subscription is active. studentUserId is unique (a student
--          belongs to at most one family).

CREATE TABLE "family_members" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "owner_user_id" varchar(64) NOT NULL REFERENCES "users"("id"),
  "student_user_id" varchar(64) NOT NULL UNIQUE REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "family_members_owner_user_id_idx" ON "family_members" ("owner_user_id");
