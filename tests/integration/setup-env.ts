import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Vitest `setupFiles` entry for the integration suite. Runs BEFORE any test
 * file's (hoisted) imports evaluate, so `@/lib/env` — which reads `process.env`
 * at module-evaluation time — sees DATABASE_URL. Previously each test called
 * loadEnvFile in its own body, which ran AFTER `import "@/lib/db/repo"` had
 * already frozen `env.DATABASE_URL = undefined`, silently routing every write to
 * the in-memory store and making the raw-SQL cross-checks fail.
 *
 * Must not import anything that reads env (keep it to node:fs / node:path).
 */
function loadEnvFile(fileName: string, override = false) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
}

// override=false: an explicitly-provided DATABASE_URL (CI, or a command-line
// `DATABASE_URL=...brownzone_test`) wins over .env.local. This is what lets the
// suite target a disposable test DB instead of whatever .env.local points at.
loadEnvFile(".env", false);
loadEnvFile(".env.local", false);

// SAFETY: integration tests TRUNCATE/DELETE tables. Refuse to run against any DB
// whose name isn't clearly a test DB, so a bare `npm run test:integration` can
// never wipe the demo/prod database. Point DATABASE_URL at a `*_test` database.
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const dbName = (() => {
    try {
      return new URL(databaseUrl).pathname.replace(/^\//, "");
    } catch {
      return databaseUrl;
    }
  })();
  if (!/test/i.test(dbName)) {
    throw new Error(
      `[integration] Refusing to run against database "${dbName}" — it is not a *_test database. ` +
        `Integration tests delete/truncate data. Set DATABASE_URL to a disposable test DB, e.g.\n` +
        `  DATABASE_URL=postgres://postgres:postgres@localhost:5433/brownzone_test npm run test:integration`,
    );
  }
}
