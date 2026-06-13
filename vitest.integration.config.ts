import path from "node:path";
import { defineConfig } from "vitest/config";

// M7: integration suite runs ONLY tests/integration/**. Hits a real Postgres
// indicated by DATABASE_URL — point this at a disposable test schema, never
// production. CI should set DATABASE_URL before invoking this config.
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/integration/**/*.test.ts"],
    // Load .env.local BEFORE any test-file import evaluates, so @/lib/env (which
    // reads process.env at import time) picks up DATABASE_URL. Without this the
    // repo layer froze env undefined → silent in-memory fallback → false failures.
    setupFiles: ["./tests/integration/setup-env.ts"],
    // Integration files share one real DB and write persistently — run them
    // sequentially so they can't race each other on the same rows.
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
