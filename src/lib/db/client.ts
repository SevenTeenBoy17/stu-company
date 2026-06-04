import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";
import type { Role } from "@/lib/types";

// "owner" — superuser-style connection (Supabase pooler "postgres" role).
//           RLS is bypassed; authorisation must be enforced in repo.ts.
// "authenticated" — opt in to RLS policies defined in drizzle/policies.sql.
//                   Requires every query to run inside withRls() so the JWT
//                   claims are injected via set_config().
const DB_ROLE = (process.env.DATABASE_ROLE ?? "owner") as "owner" | "authenticated";

const globalForDb = globalThis as unknown as {
  __brownZoneDb?: ReturnType<typeof drizzle>;
};
let dbInstance: ReturnType<typeof drizzle> | null = globalForDb.__brownZoneDb ?? null;

export function getDb() {
  if (!env.DATABASE_URL) {
    return null;
  }

  if (!dbInstance) {
    const client = postgres(env.DATABASE_URL, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      // P3: server-side statement timeout so Postgres ABORTS a slow query (and
      // frees the connection) instead of it running on after the client-side race
      // in repo.ts gives up. Matches DB_QUERY_TIMEOUT_MS (default 5s).
      connection: { statement_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 5000) },
    });
    dbInstance = drizzle(client);
    if (process.env.NODE_ENV !== "production") {
      globalForDb.__brownZoneDb = dbInstance;
    }
  }

  return dbInstance;
}

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL);
}

export interface RlsClaims {
  sub: string;
  role: Role;
  classroomId?: string | null;
}

/**
 * Run a transaction with the current user's JWT claims injected via
 * Postgres `set_config(..., true)` so that RLS policies in
 * drizzle/policies.sql evaluate correctly. No-op when DATABASE_ROLE=owner.
 */
export async function withRls<T>(
  db: NonNullable<ReturnType<typeof getDb>>,
  claims: RlsClaims,
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    if (DB_ROLE === "authenticated") {
      await tx.execute(sql`select set_config('request.jwt.claim.sub', ${claims.sub}, true)`);
      await tx.execute(sql`select set_config('request.jwt.claim.role', ${claims.role}, true)`);
      if (claims.classroomId) {
        await tx.execute(
          sql`select set_config('request.jwt.claim.classroomId', ${claims.classroomId}, true)`,
        );
      }
    }
    return fn(tx);
  });
}
