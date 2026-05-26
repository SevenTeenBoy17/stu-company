import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // M7: keep unit (src/**) and integration (tests/integration/**) split.
    // Default `npm run test` runs only unit; integration goes via
    // `npm run test:integration` which expects DATABASE_URL pointed at a
    // test schema, not production.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**", "tests/integration/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
