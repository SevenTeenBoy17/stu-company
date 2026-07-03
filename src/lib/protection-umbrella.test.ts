import { describe, expect, it } from "vitest";

import { buildProtectionUmbrellaPayload, createProtectionUmbrellaAction } from "@/lib/protection-umbrella";
import { createInitialRun } from "@/lib/simulation";

describe("protection umbrella", () => {
  it("builds six protection dimensions and stress events", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const payload = buildProtectionUmbrellaPayload(run, "basic");

    expect(payload.dimensions).toHaveLength(6);
    expect(payload.scenarios.length).toBeGreaterThanOrEqual(3);
    expect(payload.overview.protectionScore).toBeGreaterThan(0);
    expect(payload.coach.nextSteps).toHaveLength(3);
  });

  it("records a protection review without mutating wealth balances", () => {
    const run = createInitialRun("student-1", "classroom-1");
    const before = { cash: run.cash, savings: run.savings, debt: run.debt, netWorth: run.netWorth };

    const outcome = createProtectionUmbrellaAction(run, {
      planId: "plus",
      stressId: "sports-injury",
      note: "比较家庭协同守护对运动受伤门诊的现金流保护。",
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(outcome.run.cash).toBe(before.cash);
    expect(outcome.run.savings).toBe(before.savings);
    expect(outcome.run.debt).toBe(before.debt);
    expect(outcome.run.netWorth).toBe(before.netWorth);
    expect(outcome.run.actionLog[0].type).toBe("protection");
    expect(outcome.entry.planTitle).toBe("家庭协同守护");
    expect(outcome.payload.history[0]).toMatchObject({
      planTitle: "家庭协同守护",
      stressTitle: "运动受伤门诊",
      note: "比较家庭协同守护对运动受伤门诊的现金流保护。",
    });
  });

  it("lets students preview how different plans change a stress event", () => {
    const run = createInitialRun("student-1", "classroom-1");

    const noInsurance = buildProtectionUmbrellaPayload(run, "none");
    const plus = buildProtectionUmbrellaPayload(run, "plus");
    const noInsuranceFamily = noInsurance.scenarios.find((scenario) => scenario.id === "family-support");
    const plusFamily = plus.scenarios.find((scenario) => scenario.id === "family-support");

    expect(noInsurance.overview.monthlyPremium).toBe(0);
    expect(plus.overview.monthlyPremium).toBeGreaterThan(noInsurance.overview.monthlyPremium);
    expect(noInsuranceFamily?.coveredAmount).toBe(0);
    expect(plusFamily?.coveredAmount).toBeGreaterThan(0);
    expect(plusFamily?.outOfPocket).toBeLessThan(noInsuranceFamily?.outOfPocket ?? Infinity);
  });

  it("hides unreadable legacy notes from the protection history", () => {
    const run = createInitialRun("student-1", "classroom-1");
    run.actionLog.unshift({
      id: "legacy-protection",
      round: 2,
      type: "protection",
      label: "保护伞复盘：基础守护",
      amount: 90,
      timestamp: "2026-06-01T00:00:00.000Z",
      meta: {
        kind: "protection_review",
        planId: "basic",
        stressTitle: "????????????",
        score: 72,
        note: "????????????",
      },
    });

    const payload = buildProtectionUmbrellaPayload(run, "basic");

    expect(payload.history[0].stressTitle).toBe("保护方案复盘");
    expect(payload.history[0].note).toBe("这条旧记录的文字无法识别，建议重新记录一条保护复盘。");
  });

  it("deduplicates repeated protection reviews in the visible history", () => {
    const run = createInitialRun("student-1", "classroom-1");
    for (const id of ["repeat-1", "repeat-2"]) {
      run.actionLog.unshift({
        id,
        round: 3,
        type: "protection",
        label: "保护伞复盘：基础守护",
        amount: 90,
        timestamp: "2026-06-01T00:00:00.000Z",
        meta: {
          kind: "protection_review",
          planId: "basic",
          stressTitle: "手机屏幕维修",
          score: 72,
          note: "同一条保护复盘不应该在看板里重复刷屏。",
        },
      });
    }

    const payload = buildProtectionUmbrellaPayload(run, "basic");

    expect(payload.history).toHaveLength(1);
    expect(payload.history[0].note).toBe("同一条保护复盘不应该在看板里重复刷屏。");
  });
});
