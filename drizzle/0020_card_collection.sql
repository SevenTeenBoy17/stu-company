-- Migration: decorative quest card collection
-- Created: 2026-06-18
-- Context: Phase B2a. Collection cards are cosmetic rewards only:
--          they must never affect net worth, power scoring, or leaderboards.

CREATE TABLE IF NOT EXISTS "card_collection" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" varchar(64) NOT NULL,
  "card_id" varchar(64) NOT NULL,
  "source" varchar(24) NOT NULL,
  "drawn_at" timestamp with time zone DEFAULT now() NOT NULL,
  "meta" jsonb,
  CONSTRAINT "card_collection_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_collection_user_card_unique"
  ON "card_collection" ("user_id", "card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_collection_user_id_idx"
  ON "card_collection" ("user_id");
