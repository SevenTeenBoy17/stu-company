import { describe, expect, it } from "vitest";

import { buildGoalAccountsPayload, createGoalAccountAction } from "@/lib/goal-accounts";
import { createInitialRun } from "@/lib/simulation";

describe("goal accounts", () => {
  it("builds life goals from a simulation run", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildGoalAccountsPayload(run);

    expect(payload.goals).toHaveLength(4);
    expect(payload.overview.availableCash).toBe(run.cash);
    expect(payload.overview.goalScore).toBeGreaterThan(0);
    expect(payload.coach.nextSteps.length).toBeGreaterThanOrEqual(3);
  });

  it("records a goal transfer without changing total net worth", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const before = run.cash + run.savings - run.debt;

    const outcome = createGoalAccountAction(run, {
      goalId: "laptop",
      amount: 1_200,
      note: "先为大学电脑做一笔目标储蓄。",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(outcome.run.cash).toBe(run.cash - 1_200);
    expect(outcome.run.savings).toBe(run.savings + 1_200);
    expect(outcome.run.cash + outcome.run.savings - outcome.run.debt).toBe(before);
    expect(outcome.run.actionLog[0].type).toBe("goal_account");
    expect(outcome.entry.title).toBe("大学电脑基金");
  });
});
