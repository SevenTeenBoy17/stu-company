import { describe, expect, it } from "vitest";

import { buildStudentHomeHubPayload, studentServiceGroups } from "@/lib/student-service-map";
import { createInitialRun } from "@/lib/simulation";
import type { ActionLog, ScenarioRun } from "@/lib/types";

function addAction(run: ScenarioRun, type: ActionLog["type"], label: string, meta: Record<string, unknown>) {
  run.actionLog.unshift({
    id: `home-hub-${type}-${run.actionLog.length}`,
    round: run.currentRound,
    type,
    label,
    amount: 0,
    timestamp: new Date("2026-06-13T12:00:00.000Z").toISOString(),
    meta,
  });
}

describe("student home hub service map", () => {
  it("starts with four concrete daily learning actions", () => {
    const run = createInitialRun("student-1", "classroom-1", "测试学期", 20260613);
    const payload = buildStudentHomeHubPayload(run);

    expect(payload.today.map((item) => item.id)).toEqual([
      "read-market",
      "opportunity-note",
      "fund-lab",
      "safety-base",
    ]);
    expect(payload.today.every((item) => item.done === false)).toBe(true);
    expect(payload.today.find((item) => item.id === "fund-lab")).toMatchObject({
      title: "做一次基金/ETF 实验",
      actionLabel: "进入实验室",
      concept: "分散投资",
    });
  });

  it("builds a four-lane finance learning map with grouped services", () => {
    const run = createInitialRun("student-1", "classroom-1", "测试学期", 20260613);
    const payload = buildStudentHomeHubPayload(run);

    expect(payload.serviceMap.map((group) => group.key)).toEqual(["strategy", "assets", "life", "learning"]);
    expect(payload.serviceMap.map((group) => group.label)).toEqual([
      studentServiceGroups.strategy,
      studentServiceGroups.assets,
      studentServiceGroups.life,
      studentServiceGroups.learning,
    ]);
    expect(payload.serviceMap.every((group) => group.href.startsWith("/student"))).toBe(true);
    expect(payload.serviceMap.every((group) => group.serviceIds.length >= 2)).toBe(true);
    expect(payload.serviceMap.find((group) => group.key === "life")).toMatchObject({
      concept: "目标储蓄 / 风险缓冲",
      primaryActionLabel: "设置生活目标",
    });
  });

  it("recalls opportunity notes and fund lab records as completed daily actions", () => {
    const run = createInitialRun("student-1", "classroom-1", "测试学期", 20260613);
    addAction(run, "watchlist", "加入自选观察：英伟达", { kind: "watchlist_action" });
    addAction(run, "opportunity", "机会观察：AI 算力与基础设施", { kind: "opportunity_note" });
    addAction(run, "fund_lab", "基金实验：均衡组合", { kind: "fund_lab_action" });
    addAction(run, "goal_account", "目标账户：转入电脑基金", { kind: "goal_account_action" });
    addAction(run, "protection", "保护伞复盘：基础方案", { kind: "protection_review" });

    const payload = buildStudentHomeHubPayload(run);
    const byId = Object.fromEntries(payload.today.map((item) => [item.id, item]));

    expect(byId["read-market"]).toMatchObject({ done: true, progressLabel: "已记录 1 次" });
    expect(byId["opportunity-note"]).toMatchObject({ done: true, progressLabel: "已写 1 张" });
    expect(byId["fund-lab"]).toMatchObject({ done: true, title: "复查组合分散度", actionLabel: "看财富地图" });
    expect(byId["safety-base"]).toMatchObject({ done: true, progressLabel: "目标 1 次 · 保护 1 次" });

    const groupByKey = Object.fromEntries(payload.serviceMap.map((group) => [group.key, group]));
    expect(groupByKey.strategy).toMatchObject({
      completedCount: 2,
      completionLabel: "1 次观察 · 1 张机会单",
    });
    expect(groupByKey.assets?.completedCount).toBeGreaterThanOrEqual(1);
    expect(groupByKey.life?.completedCount).toBeGreaterThanOrEqual(2);
  });
});
