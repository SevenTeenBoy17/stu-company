-- PR-B schema changes
--
-- H2: token_version on users so logout / password changes can invalidate
--     outstanding JWTs.
-- H6: remove 7 zombie tables that schema.ts defined but repo.ts never wrote
--     to. Data lives in scenario_runs JSONB columns.
-- H7: ai_messages child table so appending one message stops rewriting the
--     entire session blob.
-- H8: unique(student_user_id) on growth_reports so the upsert path is race
--     free.
--
-- All changes are idempotent so this file can be re-applied without harm.

-- H2 ----------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "token_version" integer NOT NULL DEFAULT 0;

-- H6 ----------------------------------------------------------------------
DROP TABLE IF EXISTS "portfolio_snapshots" CASCADE;
DROP TABLE IF EXISTS "holdings" CASCADE;
DROP TABLE IF EXISTS "cash_ledger" CASCADE;
DROP TABLE IF EXISTS "property_positions" CASCADE;
DROP TABLE IF EXISTS "venture_positions" CASCADE;
DROP TABLE IF EXISTS "event_cards" CASCADE;
DROP TABLE IF EXISTS "leaderboards" CASCADE;

-- H7 ----------------------------------------------------------------------
ALTER TABLE "ai_sessions"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS "ai_messages" (
  "id" varchar(64) PRIMARY KEY,
  "session_id" varchar(64) NOT NULL
    REFERENCES "ai_sessions"("id") ON DELETE CASCADE,
  "role" varchar(16) NOT NULL,
  "text" text NOT NULL,
  "meta" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_messages_session_created_idx"
  ON "ai_messages" ("session_id", "created_at");

-- Backfill messages from existing ai_sessions.payload->messages, if any.
INSERT INTO "ai_messages" ("id", "session_id", "role", "text", "meta", "created_at")
SELECT
  COALESCE(msg->>'id', s.id || '-' || ord::text) AS id,
  s.id                                            AS session_id,
  msg->>'role'                                    AS role,
  msg->>'text'                                    AS text,
  msg->'meta'                                     AS meta,
  COALESCE((msg->>'createdAt')::timestamp, s.created_at) AS created_at
FROM "ai_sessions" s,
     LATERAL jsonb_array_elements(COALESCE(s.payload->'messages', '[]'::jsonb))
       WITH ORDINALITY AS arr(msg, ord)
WHERE msg->>'role' IN ('user', 'assistant')
ON CONFLICT (id) DO NOTHING;

-- H8 ----------------------------------------------------------------------
-- Collapse any duplicate growth_reports rows (keep the row with the largest
-- id lexicographically) before adding the unique index.
DELETE FROM "growth_reports" g1
USING "growth_reports" g2
WHERE g1.student_user_id = g2.student_user_id
  AND g1.id < g2.id;

CREATE UNIQUE INDEX IF NOT EXISTS "growth_reports_student_unique"
  ON "growth_reports" ("student_user_id");
