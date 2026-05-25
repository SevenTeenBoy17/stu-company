import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!env.DATABASE_URL) {
    return null;
  }

  if (!dbInstance) {
    const client = postgres(env.DATABASE_URL, {
      prepare: false,
      max: 1,
    });
    dbInstance = drizzle(client);
  }

  return dbInstance;
}

export function isDatabaseConfigured() {
  return Boolean(env.DATABASE_URL);
}
