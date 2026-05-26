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
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
