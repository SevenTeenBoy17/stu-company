import { createInitialRun } from "@/lib/simulation";

// Test data builder for a ScenarioRun (TEST-STRATEGY §5.7). Wraps the real
// createInitialRun so factory output always matches production invariants, then
// applies shallow overrides. A FIXED seed keeps factory-built runs deterministic
// (same eventTimeline every call) — pass a different seed for variation.
export function makeScenarioRun(
  overrides?: Partial<ReturnType<typeof createInitialRun>>,
) {
  return { ...createInitialRun("student-test", "class-test", "测试场景", 1), ...overrides };
}
