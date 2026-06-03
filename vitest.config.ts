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
    // Coverage is opt-in via `npm run test:coverage`; `npm run test` is unaffected.
    // No global thresholds yet — informational until a baseline is agreed.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/**/*.d.ts"],
      // T2: regression floor (only-up). Current ~36% lines / 27% branches; floor set
      // just below so coverage can't silently drop. Raise as suites grow.
      thresholds: { lines: 35, functions: 35, statements: 35, branches: 25 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
