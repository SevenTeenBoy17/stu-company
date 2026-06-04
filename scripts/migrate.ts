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

async function main() {
  try {
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
