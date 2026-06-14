import { describe, expect, it } from "vitest";

import { buildPeerHeatPayload } from "@/lib/peer-heat";
import { createInitialRun } from "@/lib/simulation";

describe("buildPeerHeatPayload", () => {
  it("aggregates classroom holdings and watchlist signals without exposing users", () => {
    const first = createInitialRun("student-a", "class-1", "测试", 20260613);
    const second = createInitialRun("student-b", "class-1", "测试", 20260613);
    const outsider = createInitialRun("student-x", "class-2", "测试", 20260613);

    first.holdings = [{ assetId: "asset-stock", quantity: 8, averageCost: 120 }];
    second.holdings = [{ assetId: "asset-stock", quantity: 3, averageCost: 122 }];
    outsider.holdings = [{ assetId: "asset-etf", quantity: 99, averageCost: 90 }];
    second.actionLog.unshift({
      id: "watch-1",
      round: 2,
      type: "watchlist",
      label: "加入自选观察：微软（MSFT）",
      amount: 0,
      timestamp: "2026-06-13T00:00:00.000Z",
      meta: {
        kind: "watchlist_action",
        action: "add",
        symbol: "MSFT",
      },
    });

    const payload = buildPeerHeatPayload([first, second, outsider], first, "清波一班", new Date("2026-06-13T00:00:00.000Z"));

    expect(payload.totalStudents).toBe(2);
    expect(payload.items[0]).toMatchObject({
      symbol: "BZA",
      name: "智造先锋股票",
      count: 2,
      ratio: 100,
      source: "holding",
    });
    expect(payload.items.find((item) => item.symbol === "MSFT")).toMatchObject({
      count: 1,
      ratio: 50,
      source: "watchlist",
    });
    expect(JSON.stringify(payload)).not.toContain("student-a");
    expect(JSON.stringify(payload)).not.toContain("student-b");
    expect(JSON.stringify(payload)).not.toContain("quantity");
    expect(payload.privacyNote).toContain("不显示姓名");
  });

  it("keeps a friendly empty state before classmates create signals", () => {
    const run = createInitialRun("student-a", "class-1", "测试", 20260613);

    const payload = buildPeerHeatPayload([run], run, "清波一班", new Date("2026-06-13T00:00:00.000Z"));

    expect(payload.items).toEqual([]);
    expect(payload.headline).toContain("热度还在形成中");
    expect(payload.summary).toContain("脱敏聚合热度");
  });
});
