import { describe, expect, it } from "vitest";

import { buildRiskProfilePayload, riskProfileQuestions, type RiskProfileAnswer } from "@/lib/risk-profile";
import { applySimulationAction, createInitialRun } from "@/lib/simulation";

function answersAt(optionIndex: number): RiskProfileAnswer[] {
  return riskProfileQuestions.map((question) => ({
    questionId: question.id,
    optionId: question.options[optionIndex]?.id ?? question.options.at(-1)!.id,
  }));
}

describe("risk profile", () => {
  it("maps defensive answers to a conservative profile with a larger safety target", () => {
    const run = createInitialRun("student-risk-1", "classroom-1");
    const payload = buildRiskProfilePayload(run, answersAt(0), new Date("2026-06-01T00:00:00.000Z"));

    expect(payload.label).toBe("保守守门员");
    expect(payload.score).toBeLessThanOrEqual(38);
    expect(payload.allocation.find((item) => item.id === "safety")?.target).toBeGreaterThan(
      payload.allocation.find((item) => item.id === "growth")?.target ?? 0,
    );
    expect(payload.coach.summary).toContain("教育模拟");
  });

  it("maps aggressive answers to a growth profile while keeping risk-control coaching", () => {
    let run = createInitialRun("student-risk-2", "classroom-1");
    run = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-stock",
      side: "buy",
      quantity: 220,
      orderMode: "market",
    });
    run = applySimulationAction(run, {
      type: "venture",
      action: "invest",
      amount: 18_000,
    });

    const payload = buildRiskProfilePayload(run, answersAt(2), new Date("2026-06-01T00:00:00.000Z"));

    expect(payload.label).toBe("进取挑战者");
    expect(payload.allocation.find((item) => item.id === "growth")?.target).toBeGreaterThan(40);
    expect(payload.coach.nextSteps.join("")).toMatch(/风险|回撤|集中度|流动性/);
  });

  it("reflects current allocation gaps from the live sandbox run", () => {
    let run = createInitialRun("student-risk-3", "classroom-1");
    run = applySimulationAction(run, {
      type: "bank",
      action: "deposit",
      amount: 35_000,
    });

    const payload = buildRiskProfilePayload(run, answersAt(1), new Date("2026-06-01T00:00:00.000Z"));
    const safety = payload.allocation.find((item) => item.id === "safety");

    expect(safety?.current).toBeGreaterThan(50);
    expect(safety?.tone).toBe("high");
    expect(payload.radar).toHaveLength(6);
    expect(payload.questions).toHaveLength(6);
  });
});

