import { describe, expect, it } from "vitest";

import { applyCreditLabAction, buildCreditLabPayload } from "@/lib/credit-lab";
import { evaluateRun, createInitialRun } from "@/lib/simulation";

describe("credit lab", () => {
  it("builds a teaching payload with installment cost and debt metrics", () => {
    const run = createInitialRun("student-credit-1", "classroom-1");
    run.debt = 6000;

    const payload = buildCreditLabPayload(run, "device-installment", new Date("2026-06-01T00:00:00.000Z"));

    expect(payload.overview.creditScore).toBeGreaterThan(50);
    expect(payload.selectedScenario.monthlyPayment).toBeGreaterThan(0);
    expect(payload.selectedScenario.totalInterest).toBeGreaterThan(0);
    expect(payload.repaymentOptions.length).toBe(3);
  });

  it("borrowing increases cash and debt together without inflating net worth", () => {
    const run = createInitialRun("student-credit-2", "classroom-1");
    const before = evaluateRun(run).netWorth;

    const outcome = applyCreditLabAction(run, {
      intent: "borrow",
      scenarioId: "device-installment",
      amount: 3600,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(outcome.run.cash).toBe(run.cash + 3600);
    expect(outcome.run.debt).toBe(run.debt + 3600);
    expect(evaluateRun(outcome.run).netWorth).toBe(before);
    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "bank",
      amount: 3600,
      meta: expect.objectContaining({ kind: "credit_lab_action", intent: "borrow" }),
    });
  });

  it("repayment lowers cash and debt together without changing net worth", () => {
    const run = createInitialRun("student-credit-3", "classroom-1");
    run.debt = 8000;
    const before = evaluateRun(run).netWorth;

    const outcome = applyCreditLabAction(run, {
      intent: "repay",
      amount: 2000,
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(outcome.run.cash).toBe(run.cash - 2000);
    expect(outcome.run.debt).toBe(6000);
    expect(evaluateRun(outcome.run).netWorth).toBe(before);
    expect(outcome.result.summary).toContain("提前还款");
  });

  it("blocks borrowing when it would push leverage too high", () => {
    const run = createInitialRun("student-credit-4", "classroom-1");
    run.cash = 1000;
    run.debt = 100000;

    expect(() =>
      applyCreditLabAction(run, {
        intent: "borrow",
        scenarioId: "startup-bridge",
        amount: 9000,
      }),
    ).toThrow("债务率过高");
  });

  it("consumer-credit risk uses personal capacity, not the investment portfolio (#5 part 2)", () => {
    const run = createInitialRun("student-credit-5", "classroom-1");
    const payload = buildCreditLabPayload(run, "device-installment", new Date("2026-06-01T00:00:00.000Z"));
    // On a fresh six-figure-cash run, at least one scenario must carry real leverage risk.
    expect(payload.scenarios.some((scenario) => scenario.status !== "healthy")).toBe(true);
    // ...and the 0.58 leverage guard is reachable: a large loan vs capacity is blocked.
    expect(() =>
      applyCreditLabAction(run, { intent: "borrow", scenarioId: "startup-bridge", amount: 9000 }),
    ).toThrow("债务率过高");
  });
});
