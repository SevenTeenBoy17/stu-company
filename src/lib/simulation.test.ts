import { describe, expect, it } from "vitest";

import {
  advanceSimulationRun,
  applyEventChoice,
  applySimulationAction,
  buildPersonaShareText,
  buildSeasonLeaderboard,
  computeStreak,
  computeLearningStreak,
  computeTaskCenterTelemetry,
  createInitialRun,
  deriveInvestorPersona,
  evaluateRun,
  getPropertyValue,
  getRoundQuotes,
  getRoundQuotesForRun,
} from "@/lib/simulation";
import { currentSeasonSeed } from "@/lib/season";
import type { ScenarioRun } from "@/lib/types";

describe("simulation", () => {
  it("updates holdings and cash after a buy action", () => {
    const run = createInitialRun("student-test", "class-test");
    const updated = applySimulationAction(run, {
      type: "trade",
      assetId: "asset-etf",
      side: "buy",
      quantity: 50,
      orderMode: "market",
    });

    expect(updated.cash).toBeLessThan(run.cash);
    expect(updated.holdings.find((holding) => holding.assetId === "asset-etf")?.quantity).toBe(50);
  });

  it("advances the round and records a new snapshot", () => {
    const run = createInitialRun("student-test", "class-test");
    const progressed = advanceSimulationRun(run);

    expect(progressed.currentRound).toBe(2);
    expect(progressed.snapshots.at(-1)?.round).toBe(2);
  });

  it("property value follows a cycle with drawdowns (cooldown R4, recession R9), not a monotonic ramp", () => {
    const run = createInitialRun("student-test", "class-test");
    run.propertyUnits = 1;
    const valueAt = (round: number) => getPropertyValue(run, round);

    // Long-run appreciation holds...
    expect(valueAt(12)).toBeGreaterThan(valueAt(1));
    // ...but property pulls back in the cooldown and recession rounds, so it is not
    // a risk-free, strictly-increasing "buy early" instrument.
    expect(valueAt(4)).toBeLessThan(valueAt(3));
    expect(valueAt(9)).toBeLessThan(valueAt(8));
  });

  it("evaluates risk and net worth deterministically", () => {
    let run = createInitialRun("student-test", "class-test");
    run = applySimulationAction(run, {
      type: "bank",
      action: "loan",
      amount: 10_000,
    });

    const evaluated = evaluateRun(run);
    expect(evaluated.netWorth).toBeGreaterThan(80_000);
    expect(evaluated.riskScore).toBeGreaterThanOrEqual(24);
  });

  it("allows exiting an existing venture without a manual amount", () => {
    let run = createInitialRun("student-test", "class-test");
    run = applySimulationAction(run, {
      type: "venture",
      action: "invest",
      amount: 8_000,
    });

    const exited = applySimulationAction(run, {
      type: "venture",
      action: "exit",
    });

    expect(exited.ventureStake).toBe(0);
    expect(exited.cash).toBeGreaterThan(run.cash);
    expect(exited.actionLog[0]?.label).toContain("退出创业项目");
  });
});

describe("seeded random events", () => {
  it("assigns a reproducible 12-round event timeline from a seed", () => {
    const a = createInitialRun("student-test", "class-test", "试点", 2024);
    const b = createInitialRun("student-test", "class-test", "试点", 2024);
    expect(a.eventTimeline).toHaveLength(12);
    expect(a.eventTimeline).toEqual(b.eventTimeline);
  });

  it("varies the event timeline across different seeds", () => {
    const a = createInitialRun("student-test", "class-test", "试点", 1);
    const b = createInitialRun("student-test", "class-test", "试点", 2);
    expect(a.eventTimeline).not.toEqual(b.eventTimeline);
  });

  it("lets a bearish event pull an impacted asset below its event-free baseline", () => {
    const run = createInitialRun("student-test", "class-test", "试点", 1);
    run.eventTimeline = ["event-liquidity-crisis", ...(run.eventTimeline ?? []).slice(1)];

    const withEvent = getRoundQuotesForRun(run, 1).find((q) => q.id === "asset-stock");
    const baseline = getRoundQuotes(1).find((q) => q.id === "asset-stock");

    expect(withEvent && baseline).toBeTruthy();
    expect(withEvent!.currentPrice).toBeLessThan(baseline!.currentPrice);
  });
});

describe("event decision cards (E3)", () => {
  function decisionRun() {
    const run = createInitialRun("student-test", "class-test", "试点", 1);
    // liquidity-crisis is a decision card with protect/gamble/hold choices.
    run.eventTimeline = ["event-liquidity-crisis", ...(run.eventTimeline ?? []).slice(1)];
    return run;
  }

  it("applies a 'protect' choice as a cash cost and logs an event action", () => {
    const run = decisionRun();
    const next = applyEventChoice(run, "lc-protect");
    expect(next.cash).toBeLessThan(run.cash);
    expect(next.actionLog[0]?.type).toBe("event");
  });

  it("rejects choosing twice in the same round", () => {
    const once = applyEventChoice(decisionRun(), "lc-protect");
    expect(() => applyEventChoice(once, "lc-protect")).toThrow();
  });

  it("rejects an unknown choice id", () => {
    expect(() => applyEventChoice(decisionRun(), "no-such-choice")).toThrow();
  });

  it("never drives cash negative on a losing choice and logs the cash delta", () => {
    const run = createInitialRun("student-test", "class-test", "试点", 1);
    run.eventTimeline = ["event-leverage-temptation", ...(run.eventTimeline ?? []).slice(1)];
    run.cash = 3_000; // less than any gamble loss → must floor at 0, never go negative
    const next = applyEventChoice(run, "lev-borrow");
    expect(next.cash).toBeGreaterThanOrEqual(0);
    expect(next.actionLog[0]?.type).toBe("event");
    expect(typeof next.actionLog[0]?.amount).toBe("number");
  });
});

function runWithNetWorths(values: number[]): ScenarioRun {
  const run = createInitialRun("s", "c", "试点", 1);
  run.snapshots = values.map((netWorth, index) => ({
    round: index + 1,
    netWorth,
    cash: netWorth,
    savings: 0,
    debt: 0,
    riskScore: 40,
    disciplineScore: 70,
    reflection: "",
  }));
  return run;
}

describe("computeStreak (retention)", () => {
  it("counts consecutive net-worth gains", () => {
    const streak = computeStreak(runWithNetWorths([100, 110, 120, 130]));
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
  });

  it("resets the current streak on a dip but remembers the best", () => {
    const streak = computeStreak(runWithNetWorths([100, 110, 120, 90, 95]));
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
  });

  it("is zero for a single-snapshot run", () => {
    expect(computeStreak(runWithNetWorths([100]))).toEqual({ current: 0, best: 0 });
  });
});

describe("buildPersonaShareText (shareable card)", () => {
  it("includes the persona label and key stats", () => {
    const run = runWithNetWorths([120_000, 130_000, 140_000]);
    const text = buildPersonaShareText(deriveInvestorPersona(run), run);
    expect(text).toContain(deriveInvestorPersona(run).label);
    expect(text).toContain("140,000");
    // 合规回归锁：分享文案用「连续学习」而非「净值连胜」运气钩子。
    expect(text).toContain("连续学习");
    expect(text).not.toContain("连胜 ");
  });
});

describe("buildSeasonLeaderboard (global weekly season)", () => {
  it("ranks only runs that used the current season seed", () => {
    const now = new Date("2026-05-25T00:00:00Z");
    const seed = currentSeasonSeed(now);
    const inSeason = createInitialRun("u1", "c", "x", seed);
    const offSeason = createInitialRun("u2", "c", "x", seed + 1);

    const board = buildSeasonLeaderboard([inSeason, offSeason], [], now);
    expect(board.some((entry) => entry.userId === "u1")).toBe(true);
    expect(board.some((entry) => entry.userId === "u2")).toBe(false);
  });

  it("按 classroomId 作用域收窄——只含本班 run，不泄露其它班的未成年人 (itest7 P1)", () => {
    const now = new Date("2026-05-25T00:00:00Z");
    const seed = currentSeasonSeed(now);
    const classA = createInitialRun("a1", "classA", "x", seed);
    const classB = createInitialRun("b1", "classB", "x", seed);

    // 不传 classroomId → 全局（两班都在）——保持旧行为的向后兼容。
    const global = buildSeasonLeaderboard([classA, classB], [], now);
    expect(global.some((e) => e.userId === "a1")).toBe(true);
    expect(global.some((e) => e.userId === "b1")).toBe(true);

    // 传 viewer 的班级 → 只含本班，另一个班的学生不出现（PII 作用域）。
    const scoped = buildSeasonLeaderboard([classA, classB], [], now, "classA");
    expect(scoped.some((e) => e.userId === "a1")).toBe(true);
    expect(scoped.some((e) => e.userId === "b1")).toBe(false);
  });

  it("defaults new runs into the current season", () => {
    const run = createInitialRun("u3", "c", "x");
    expect(run.seed).toBe(currentSeasonSeed());
  });

  it("materializes run.netWorth (for the SQL season ranking) in sync with the latest snapshot", () => {
    let run = createInitialRun("u4", "c", "x", 1);
    expect(run.netWorth).toBe(run.snapshots.at(-1)?.netWorth);
    run = advanceSimulationRun(run);
    expect(run.netWorth).toBe(run.snapshots.at(-1)?.netWorth);
  });

  // itest4 R3 P3 回归锁：贷款闸门封顶 12 万，但回合复利(×1.018)此前不再封顶 →
  // 债务可越过上限，回撤显示 >100% 误导学生。max loan 后连推所有回合，债务始终 ≤ 上限。
  it("keeps total debt at/under the teaching cap even after round-over-round interest compounding", () => {
    let run = createInitialRun("u-debt", "c", "x", 1);
    const TEACHING_DEBT_CAP = 120_000;
    // Borrow to the cap.
    run = applySimulationAction(run, { type: "bank", action: "loan", amount: TEACHING_DEBT_CAP });
    expect(run.debt).toBeLessThanOrEqual(TEACHING_DEBT_CAP);
    expect(run.debt).toBeGreaterThan(0);
    // Advance through the rest of the game; interest must never push debt past the cap.
    for (let i = run.currentRound; i < 12; i += 1) {
      run = advanceSimulationRun(run);
      expect(run.debt).toBeLessThanOrEqual(TEACHING_DEBT_CAP);
    }
  });
});

describe("investor persona (premium deep report)", () => {
  it("labels a brand-new, untraded run as a cautious observer", () => {
    const persona = deriveInvestorPersona(createInitialRun("s", "c", "试点", 1));
    expect(persona.label).toBe("谨慎观望者");
    expect(persona.summary.length).toBeGreaterThan(0);
  });

  it("is deterministic for the same run", () => {
    const run = createInitialRun("s", "c", "试点", 1);
    expect(deriveInvestorPersona(run)).toEqual(deriveInvestorPersona(run));
  });

  it("moves off 'cautious observer' once the student trades actively", () => {
    let run = createInitialRun("s", "c", "试点", 1);
    for (let i = 0; i < 3; i++) {
      run = applySimulationAction(run, {
        type: "trade",
        assetId: "asset-etf",
        side: "buy",
        quantity: 5,
        orderMode: "market",
      });
    }
    expect(deriveInvestorPersona(run).label).not.toBe("谨慎观望者");
  });
});

describe("computeTaskCenterTelemetry（H3 学习护栏遥测）", () => {
  const ts = new Date("2026-06-01T00:00:00.000Z").toISOString();
  const make = (id: string, round: number, type: "trade" | "wealth_review" | "opportunity" | "fund_lab") => ({
    id,
    round,
    type,
    label: type,
    amount: 0,
    timestamp: ts,
  });

  it("从 actionLog 纯派生交易占比 / 学习量 / 护栏健康", () => {
    const run = createInitialRun("s1", "c1");
    run.actionLog = [make("1", 1, "trade"), make("2", 1, "wealth_review"), make("3", 2, "opportunity"), make("4", 2, "fund_lab")];
    const t = computeTaskCenterTelemetry(run);
    expect(t.totalActions).toBe(4);
    expect(t.tradeActions).toBe(1);
    expect(t.learningActions).toBe(3);
    expect(t.tradeShare).toBeCloseTo(0.25);
    expect(t.guardrailHealthy).toBe(true);
  });

  it("交易占比超阈值 → guardrail alert（H3 证伪条件）", () => {
    const run = createInitialRun("s1", "c1");
    run.actionLog = [make("1", 1, "trade"), make("2", 1, "trade"), make("3", 1, "trade"), make("4", 2, "wealth_review")];
    const t = computeTaskCenterTelemetry(run, { maxTradeShare: 0.5 });
    expect(t.tradeShare).toBeCloseTo(0.75);
    expect(t.guardrailHealthy).toBe(false);
  });

  it("空 actionLog → 全 0、护栏健康", () => {
    const run = createInitialRun("s1", "c1");
    run.actionLog = [];
    expect(computeTaskCenterTelemetry(run)).toMatchObject({ totalActions: 0, tradeShare: 0, guardrailHealthy: true });
  });
});

describe("教学贷款上限（内测 rank5：防债务失控→净值为负）", () => {
  it("总债务将超过 120,000 的贷款被拒绝，并给出教育性中文提示", () => {
    const run = createInitialRun("s", "c", "试点", 1);
    run.debt = 100_000;
    expect(() => applySimulationAction(run, { type: "bank", action: "loan", amount: 30_000 })).toThrow(
      /教学贷款有上限/,
    );
  });

  it("上限内贷款正常记账：cash 与 debt 同增", () => {
    const run = createInitialRun("s", "c", "试点", 1);
    const beforeCash = run.cash;
    const next = applySimulationAction(run, { type: "bank", action: "loan", amount: 20_000 });
    expect(next.debt).toBe(20_000);
    expect(next.cash).toBe(beforeCash + 20_000);
  });
});

describe("computeLearningStreak（合规学习连续·直测，内测 rank12）", () => {
  function runWithLearningRounds(rounds: number[], currentRound: number) {
    const run = createInitialRun("s", "c", "试点", 1);
    run.currentRound = currentRound;
    run.actionLog = rounds.map((round, index) => ({
      id: `lr-${index}`,
      round,
      type: "wealth_review" as const,
      label: "复盘",
      amount: 0,
      timestamp: new Date(2026, 5, index + 1).toISOString(),
    }));
    return run;
  }

  it("连续段抵达当前回合：current=best=段长", () => {
    expect(computeLearningStreak(runWithLearningRounds([1, 2, 3], 3))).toEqual({ current: 3, best: 3 });
  });

  it("断档后 current 归零、best 保留（防 UI 虚高）", () => {
    expect(computeLearningStreak(runWithLearningRounds([1, 2], 5))).toEqual({ current: 0, best: 2 });
  });

  it("进行中回合宽限：末段到 currentRound-1 仍算 current", () => {
    expect(computeLearningStreak(runWithLearningRounds([2, 3], 4))).toEqual({ current: 2, best: 2 });
  });

  it("advance/trade 不计入学习（口径与治本②一致）", () => {
    const run = createInitialRun("s", "c", "试点", 1);
    run.currentRound = 3;
    run.actionLog = [
      { id: "a1", round: 1, type: "advance" as const, label: "推进", amount: 0, timestamp: new Date(2026, 5, 1).toISOString() },
      { id: "t1", round: 2, type: "trade" as const, label: "交易", amount: -100, timestamp: new Date(2026, 5, 2).toISOString() },
    ];
    expect(computeLearningStreak(run)).toEqual({ current: 0, best: 0 });
  });
});
