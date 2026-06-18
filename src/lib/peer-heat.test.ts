import { describe, expect, it } from "vitest";

import { buildPeerHeatPayload } from "@/lib/peer-heat";

import { makeScenarioRun } from "../../tests/factories/run";

describe("peer heat aggregation", () => {
  it("aggregates only classmates' holdings and watchlist signals", () => {
    const current = makeScenarioRun({
      id: "run-a",
      userId: "student-secret-a",
      classroomId: "class-heat",
      holdings: [{ assetId: "asset-stock", quantity: 9, averageCost: 127 }],
    });
    const peer = makeScenarioRun({
      id: "run-b",
      userId: "student-secret-b",
      classroomId: "class-heat",
      holdings: [{ assetId: "asset-stock", quantity: 3, averageCost: 111 }],
    });
    const outsider = makeScenarioRun({
      id: "run-c",
      userId: "student-secret-c",
      classroomId: "another-class",
      holdings: [{ assetId: "asset-etf", quantity: 99, averageCost: 90 }],
    });

    peer.actionLog = [
      {
        id: "watch-1",
        round: 2,
        type: "watchlist",
        label: "加入自选观察：微软（MSFT）",
        amount: 0,
        timestamp: "2026-06-18T00:00:00.000Z",
        meta: {
          kind: "watchlist_action",
          action: "add",
          symbol: "MSFT",
        },
      },
      ...peer.actionLog,
    ];

    const payload = buildPeerHeatPayload(
      [current, peer, outsider],
      current,
      "高一 1 班",
      new Date("2026-06-18T00:00:00.000Z"),
    );
    const microsoft = payload.items.find((item) => item.symbol === "MSFT");

    expect(payload.totalStudents).toBe(2);
    expect(payload.items[0]).toMatchObject({
      symbol: "BZA",
      count: 2,
      ratio: 100,
      source: "holding",
    });
    expect(microsoft).toMatchObject({
      count: 1,
      ratio: 50,
      source: "watchlist",
    });
    expect(payload.items.some((item) => item.symbol === "EDGE")).toBe(false);
    expect(payload.privacyNote).toContain("不显示姓名");
  });

  it("returns only anonymized aggregate counts, never per-user holdings or identity", () => {
    const current = makeScenarioRun({
      id: "run-a",
      userId: "student-secret-a",
      classroomId: "class-heat",
      holdings: [{ assetId: "asset-stock", quantity: 9, averageCost: 127 }],
    });
    const peer = makeScenarioRun({
      id: "run-b",
      userId: "student-secret-b",
      classroomId: "class-heat",
      holdings: [{ assetId: "asset-stock", quantity: 3, averageCost: 111 }],
    });

    const payload = buildPeerHeatPayload([current, peer], current, "高一 1 班", new Date("2026-06-18T00:00:00.000Z"));
    const serialized = JSON.stringify(payload);

    expect(payload.items[0]).toMatchObject({
      count: 2,
      ratio: 100,
      source: "holding",
    });
    expect(serialized).not.toContain("student-secret");
    expect(serialized).not.toContain("userId");
    expect(serialized).not.toContain("quantity");
    expect(serialized).not.toContain("averageCost");
    expect(serialized).toContain("热门不等于适合你");
  });

  it("returns a friendly empty state when the class has no holdings or watchlist signals yet", () => {
    const current = {
      ...makeScenarioRun({ id: "run-empty", userId: "student-empty", classroomId: "class-empty" }),
      holdings: [],
      actionLog: [],
    };

    const payload = buildPeerHeatPayload([], current, "空态班级", new Date("2026-06-18T00:00:00.000Z"));

    expect(payload.totalStudents).toBe(1);
    expect(payload.items).toEqual([]);
    expect(payload.sourceMix).toEqual({ holdings: 0, watchlist: 0 });
    expect(payload.summary).toMatch(/脱敏|聚合|热度|观察/);
  });
});
