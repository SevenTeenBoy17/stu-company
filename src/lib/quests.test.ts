import { describe, expect, it } from "vitest";

import { buildStudentQuestPayload, claimQuestReward } from "@/lib/quests";
import { createInitialRun } from "@/lib/simulation";
import type { LearningProgressSummary, ScenarioRun } from "@/lib/types";

function learning(overrides: Partial<LearningProgressSummary> = {}): LearningProgressSummary {
  return {
    completed: 0,
    total: 8,
    completedKeys: [],
    ...overrides,
  };
}

function runWithSnapshots(values: number[]): ScenarioRun {
  const run = createInitialRun("student-1", "classroom-1");
  run.snapshots = values.map((netWorth, index) => ({
    round: index + 1,
    netWorth,
    cash: Math.max(0, run.cash - index * 1000),
    savings: run.savings,
    debt: run.debt,
    riskScore: 50 + index,
    disciplineScore: 70,
    reflection: `第 ${index + 1} 回合复盘`,
  }));
  run.currentRound = values.length;
  run.netWorth = values[values.length - 1] ?? run.netWorth;
  return run;
}

describe("buildStudentQuestPayload", () => {
  it("derives quests from real sandbox and learning behavior without power rewards", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 2,
      type: "bank",
      label: "提取储蓄",
      amount: 2000,
      timestamp: new Date("2026-06-02T00:00:00.000Z").toISOString(),
    });

    const payload = buildStudentQuestPayload(run, learning({ completed: 2, completedKeys: ["stock", "etf"] }));

    expect(payload.quests.find((quest) => quest.id === "cash-management")?.status).toBe("done");
    expect(payload.quests.find((quest) => quest.id === "learn-two-modules")?.status).toBe("done");
    expect(payload.quests.every((quest) => !/战力|power/i.test(quest.reward))).toBe(true);
    expect(payload.achievements.find((item) => item.id === "learning-spark")?.unlocked).toBe(true);
  });

  it("builds an earnings calendar with round deltas and tones", () => {
    const payload = buildStudentQuestPayload(runWithSnapshots([100000, 103000, 101000]), learning());

    expect(payload.calendar).toEqual([
      expect.objectContaining({ round: 1, delta: 0, tone: "flat" }),
      expect.objectContaining({ round: 2, delta: 3000, tone: "up" }),
      expect.objectContaining({ round: 3, delta: -2000, tone: "down" }),
    ]);
  });

  it("学习型 streak：overview 按连续学习回合数派生（净值连跌也不归零，去运气钩子）", () => {
    const run = runWithSnapshots([100000, 99000, 98000]); // 净值连跌——旧的净值连升会得 0
    const ts = (value: string) => new Date(value).toISOString();
    run.actionLog.unshift({ id: "lr-1", round: 1, type: "wealth_review", label: "复盘", amount: 0, timestamp: ts("2026-06-01T00:00:00.000Z") });
    run.actionLog.unshift({ id: "lr-2", round: 2, type: "opportunity", label: "机会观察", amount: 0, timestamp: ts("2026-06-02T00:00:00.000Z") });
    run.actionLog.unshift({ id: "lr-3", round: 3, type: "fund_lab", label: "组合实验", amount: 0, timestamp: ts("2026-06-03T00:00:00.000Z") });

    const payload = buildStudentQuestPayload(run, learning());

    expect(payload.overview.streakBest).toBe(3);
    expect(payload.overview.streakCurrent).toBe(3);
  });

  it("locks the cooldown quest before the first trade", () => {
    const payload = buildStudentQuestPayload(runWithSnapshots([100000, 101000]), learning());

    const cooldown = payload.quests.find((quest) => quest.id === "cooldown-after-trade");
    expect(cooldown).toMatchObject({ status: "locked", progress: 0 });
  });

  it("集卡完成度回归锁：任务触发器数量 ≥ 牌库卡数（每任务一卡，确定性领取，12 卡全可达）", async () => {
    const { questCardDeck } = await import("@/lib/content");
    const payload = buildStudentQuestPayload(runWithSnapshots([100000]), learning());

    expect(payload.quests.length).toBeGreaterThanOrEqual(questCardDeck.length);
    expect(new Set(payload.quests.map((quest) => quest.id)).size).toBe(payload.quests.length);
  });

  it("toolkit-composer：用过 4 种不同理财工具即完成（跨工具广度=系统思维，无运气依赖）", () => {
    const run = runWithSnapshots([100000, 101000]);
    const ts = (value: string) => new Date(value).toISOString();
    run.actionLog.unshift(
      { id: "t-1", round: 1, type: "bank", label: "转入储蓄", amount: -5000, timestamp: ts("2026-06-01T00:00:00.000Z") },
      { id: "t-2", round: 1, type: "opportunity", label: "机会观察", amount: 0, timestamp: ts("2026-06-01T00:00:01.000Z") },
      { id: "t-3", round: 2, type: "fund_lab", label: "组合实验", amount: 0, timestamp: ts("2026-06-02T00:00:00.000Z") },
    );

    const threeTools = buildStudentQuestPayload(run, learning());
    expect(threeTools.quests.find((quest) => quest.id === "toolkit-composer")).toMatchObject({
      status: "active",
      progress: 0.75,
    });

    run.actionLog.unshift({
      id: "t-4",
      round: 2,
      type: "protection",
      label: "保护伞压力测试",
      amount: 0,
      timestamp: ts("2026-06-02T00:00:01.000Z"),
    });
    const fourTools = buildStudentQuestPayload(run, learning());
    expect(fourTools.quests.find((quest) => quest.id === "toolkit-composer")).toMatchObject({
      status: "done",
      claimable: true,
    });
  });

  it("black-swan-drill：保护伞与持有复盘须在同一回合配对才算完成（跨回合不算）", () => {
    const run = runWithSnapshots([100000, 101000, 102000]);
    const ts = (value: string) => new Date(value).toISOString();
    run.actionLog.unshift(
      { id: "p-1", round: 1, type: "protection", label: "保护伞压力测试", amount: 0, timestamp: ts("2026-06-01T00:00:00.000Z") },
      { id: "w-1", round: 2, type: "wealth_review", label: "持有计划复盘", amount: 0, timestamp: ts("2026-06-02T00:00:00.000Z") },
    );

    const crossRound = buildStudentQuestPayload(run, learning());
    expect(crossRound.quests.find((quest) => quest.id === "black-swan-drill")).toMatchObject({
      status: "active",
      progress: 0.5,
    });

    run.actionLog.unshift({
      id: "w-2",
      round: 1,
      type: "wealth_review",
      label: "持有计划复盘",
      amount: 0,
      timestamp: ts("2026-06-01T00:00:01.000Z"),
    });
    const paired = buildStudentQuestPayload(run, learning());
    expect(paired.quests.find((quest) => quest.id === "black-swan-drill")).toMatchObject({
      status: "done",
      claimable: true,
    });
  });

  it("已领取任务永不回退：指标回落后 status/progress 仍锁定为 done/100%（防习得性无助）", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "trade-1",
      round: 1,
      type: "trade",
      label: "买入模拟资产",
      amount: -1000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.currentRound = 2; // 距上次交易 1 回合 → cooldown done
    const claimedOutcome = claimQuestReward(run, learning(), "cooldown-after-trade", new Date("2026-06-02T00:00:00.000Z"));

    // 领取后学生又交易 → 实时指标回退，但已领取任务必须锁定为完成。
    claimedOutcome.run.actionLog.unshift({
      id: "trade-2",
      round: 2,
      type: "trade",
      label: "再次买入",
      amount: -1000,
      timestamp: new Date("2026-06-02T00:00:01.000Z").toISOString(),
    });
    const after = buildStudentQuestPayload(claimedOutcome.run, learning());
    expect(after.quests.find((quest) => quest.id === "cooldown-after-trade")).toMatchObject({
      status: "done",
      progress: 1,
      claimed: true,
      claimable: false,
    });
  });

  it("turns new diversified finance modules into claimable learning quests", () => {
    const run = runWithSnapshots([100000, 101500]);
    run.actionLog.unshift(
      {
        id: "opportunity-1",
        round: 2,
        type: "opportunity",
        label: "机会观察单：AI 算力主题",
        amount: 0,
        timestamp: new Date("2026-06-02T00:00:00.000Z").toISOString(),
        meta: { kind: "opportunity_note" },
      },
      {
        id: "fund-1",
        round: 2,
        type: "fund_lab",
        label: "基金实验：均衡组合",
        amount: 0,
        timestamp: new Date("2026-06-02T00:00:01.000Z").toISOString(),
        meta: { kind: "fund_lab_action" },
      },
      {
        id: "goal-1",
        round: 2,
        type: "goal_account",
        label: "目标账户：转入研学基金",
        amount: -800,
        timestamp: new Date("2026-06-02T00:00:02.000Z").toISOString(),
        meta: { kind: "goal_account_action" },
      },
      {
        id: "protection-1",
        round: 2,
        type: "protection",
        label: "保护伞：突发事件压力测试",
        amount: 0,
        timestamp: new Date("2026-06-02T00:00:03.000Z").toISOString(),
        meta: { kind: "protection_review" },
      },
      {
        id: "wealth-1",
        round: 2,
        type: "wealth_review",
        label: "财富复盘：持有计划",
        amount: 0,
        timestamp: new Date("2026-06-02T00:00:04.000Z").toISOString(),
        meta: { kind: "wealth_review" },
      },
    );

    const payload = buildStudentQuestPayload(run, learning());

    expect(payload.quests.find((quest) => quest.id === "opportunity-first-note")).toMatchObject({
      status: "done",
      claimable: true,
    });
    expect(payload.quests.find((quest) => quest.id === "fund-lab-first-plan")).toMatchObject({
      status: "done",
      claimable: true,
    });
    expect(payload.quests.find((quest) => quest.id === "goal-protection-pair")).toMatchObject({
      status: "done",
      claimable: true,
    });
    expect(payload.quests.find((quest) => quest.id === "wealth-review-plan")).toMatchObject({
      status: "done",
      claimable: true,
    });
    expect(payload.achievements.find((item) => item.id === "opportunity-scout")?.unlocked).toBe(true);
    expect(payload.achievements.find((item) => item.id === "portfolio-researcher")?.unlocked).toBe(true);
    expect(payload.achievements.find((item) => item.id === "life-planner")?.unlocked).toBe(true);
    expect(payload.quests.every((quest) => !/战力|power/i.test(quest.reward))).toBe(true);
  });

  it("builds an activity benefit shelf without power or net-worth rewards", () => {
    const run = runWithSnapshots([100000, 101500]);
    run.actionLog.unshift(
      {
        id: "trade-1",
        round: 2,
        type: "trade",
        label: "买入模拟资产",
        amount: -1000,
        timestamp: new Date("2026-06-02T00:00:00.000Z").toISOString(),
      },
      {
        id: "opportunity-1",
        round: 2,
        type: "opportunity",
        label: "机会观察单：AI 算力主题",
        amount: 0,
        timestamp: new Date("2026-06-02T00:00:01.000Z").toISOString(),
        meta: { kind: "opportunity_note" },
      },
    );

    const payload = buildStudentQuestPayload(run, learning({ completed: 1, completedKeys: ["stock"] }));

    expect(payload.benefits.title).toBe("活动权益中心");
    expect(payload.benefits.items).toHaveLength(5);
    expect(payload.benefits.items.find((item) => item.id === "guess-direction")).toMatchObject({
      status: "claimed",
      reward: expect.stringContaining("波动侦探"),
    });
    expect(payload.benefits.items.find((item) => item.id === "trial-cash-lab")).toMatchObject({
      status: "claimed",
      reward: expect.stringContaining("第一笔模拟单"),
    });
    expect(payload.benefits.guardrail).toContain("不直接改变净值、学习点");
    const prohibitedBenefitWords = new RegExp(
      ["真实资金", "保证收益", "战力奖励", "红" + "包", "体验" + "金"].join("|"),
    );
    expect(payload.benefits.items.every((item) => !prohibitedBenefitWords.test(item.summary + item.reward + item.label))).toBe(true);
  });

  it("claims a completed decorative quest reward without changing net worth", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 1,
      type: "bank",
      label: "偿还债务",
      amount: -1000,
      timestamp: new Date("2026-06-01T00:00:01.000Z").toISOString(),
    });

    const outcome = claimQuestReward(run, learning(), "cash-management", new Date("2026-06-02T00:00:00.000Z"));

    expect(outcome.claimed.reward).toContain("现金流队长");
    expect(outcome.run.netWorth).toBe(run.netWorth);
    expect(outcome.run.actionLog[0]).toMatchObject({
      type: "quest",
      amount: 0,
      meta: expect.objectContaining({ kind: "quest_reward_claim", questId: "cash-management" }),
    });
    expect(outcome.payload.quests.find((quest) => quest.id === "cash-management")).toMatchObject({
      status: "done",
      claimed: true,
      claimable: false,
    });
  });

  it("prevents claiming the same quest twice", () => {
    const run = runWithSnapshots([100000]);
    run.actionLog.unshift({
      id: "bank-1",
      round: 1,
      type: "bank",
      label: "转入储蓄",
      amount: -5000,
      timestamp: new Date("2026-06-01T00:00:00.000Z").toISOString(),
    });
    run.actionLog.unshift({
      id: "bank-2",
      round: 1,
      type: "bank",
      label: "偿还债务",
      amount: -1000,
      timestamp: new Date("2026-06-01T00:00:01.000Z").toISOString(),
    });

    const first = claimQuestReward(run, learning(), "cash-management");
    expect(() => claimQuestReward(first.run, learning(), "cash-management")).toThrow("已经领取");
  });
});
