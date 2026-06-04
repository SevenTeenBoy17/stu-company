-- Migration: Financial Power leaderboard (V1)
-- Created: 2026-06-01
-- Context: 王者-style 财商战力 ranking. Self-input schools (no classroom
--          binding), per-user rank identity + privacy, and per-period power
--          snapshots. Scope/identity for ranking come from rank_profiles at
--          read time; snapshots hold only the computed power/tier/components.

CREATE TABLE "schools" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "name" varchar(160) NOT NULL,
  "normalized_name" varchar(160) NOT NULL,
  "province_code" varchar(8) NOT NULL,
  "city_code" varchar(8) NOT NULL,
  "status" varchar(16) DEFAULT 'approved' NOT NULL,
  "merged_into" varchar(64),
  "created_by" varchar(64) REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "schools_city_normalized_unique" ON "schools" ("city_code", "normalized_name");
CREATE INDEX "schools_city_idx" ON "schools" ("city_code");
CREATE INDEX "schools_province_idx" ON "schools" ("province_code");

CREATE TABLE "rank_profiles" (
  "user_id" varchar(64) PRIMARY KEY NOT NULL REFERENCES "users"("id"),
  "province_code" varchar(8) NOT NULL,
  "city_code" varchar(8) NOT NULL,
  "school_id" varchar(64) NOT NULL REFERENCES "schools"("id"),
  "alias" varchar(40) NOT NULL,
  "visibility" varchar(16) DEFAULT 'public' NOT NULL,
  "consent" integer DEFAULT 0 NOT NULL,
  "last_tier" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "rank_profiles_school_idx" ON "rank_profiles" ("school_id");
CREATE INDEX "rank_profiles_city_idx" ON "rank_profiles" ("city_code");
CREATE INDEX "rank_profiles_province_idx" ON "rank_profiles" ("province_code");

CREATE TABLE "leaderboard_snapshots" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL REFERENCES "users"("id"),
  "period" varchar(16) NOT NULL,
  "period_key" varchar(32) NOT NULL,
  "power" integer NOT NULL,
  "tier" integer NOT NULL,
  "net_worth" integer NOT NULL,
  "components" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "leaderboard_snapshots_user_period_unique" ON "leaderboard_snapshots" ("user_id", "period", "period_key");
CREATE INDEX "leaderboard_snapshots_rank_idx" ON "leaderboard_snapshots" ("period", "period_key", "power");
