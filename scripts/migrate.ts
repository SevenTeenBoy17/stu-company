/**
 * Apply pending Drizzle migrations to DATABASE_URL using the official
 * drizzle-orm migrator (decision is by each journal entry's `when` vs the last
 * recorded `created_at` in drizzle.__drizzle_migrations). This is the canonical
 * forward path: `drizzle-kit push` is unusable against this database (an
 * introspection bug crashes on an existing CHECK constraint), so migrations are
 * tracked as files and applied here. Run after `npm run db:generate`.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required. See docs/ENV-CHECKLIST.md");
  process.exit(1);
}

const client = postgres(databaseUrl, { prepare: false, max: 1 });

/**
 * LC10h P1 (LC-05/LC-06): migration 0002 (RLS) defines `app_private.*` helpers
 * that call Supabase's `auth.jwt()`. On a vanilla Postgres (self-host, CI,
 * local WSL, DR rebuild) that function does not exist, so the whole migration
 * batch fails and rolls back — a virgin DB can never be migrated. Supabase ships
 * a real `auth.jwt()`, so we ONLY create a compatibility stub when it is absent
 * (reading `request.jwt.claims`, the GUC `withRls()` already sets). This makes
 * `npm run db:migrate` self-sufficient everywhere without editing any applied
 * migration file (which would break hash tracking on the live database).
 */
async function ensureAuthJwtStub() {
  const [{ exists }] = await client<{ exists: boolean }[]>`
    select exists (
      select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid
      where n.nspname = 'auth' and p.proname = 'jwt'
    ) as exists
  `;
  if (exists) return;
  await client.unsafe(`
    create schema if not exists auth;
    create or replace function auth.jwt() returns jsonb
    language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
  `);
  console.log("Vanilla Postgres detected: created auth.jwt() compatibility stub.");
}

async function main() {
  try {
    await ensureAuthJwtStub();
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    console.log("Migrations up to date");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
