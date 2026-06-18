import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudentSandbox } from "@/components/student/student-sandbox";
import type { SimulationState } from "@/lib/types";

vi.mock("@/components/student/season-leaderboard", () => ({
  SeasonLeaderboard: () => <div data-testid="season-leaderboard" />,
}));

vi.mock("@/components/student/rank/power-rank-teaser", () => ({
  PowerRankTeaser: () => <div data-testid="power-rank-teaser" />,
}));

vi.mock("@/components/student/student-allocation-panel", () => ({
  StudentAllocationPanel: () => <div data-testid="student-allocation-panel" />,
}));

vi.mock("@/components/student/student-home-hub", () => ({
  StudentHomeHub: () => <div data-testid="student-home-hub" />,
}));

vi.mock("@/components/student/student-pet-reward-studio", () => ({
  StudentPetRewardStudio: () => <div data-testid="student-pet-reward-studio" />,
}));

vi.mock("@/components/student/student-tutor-radar", () => ({
  StudentTutorRadar: () => <div data-testid="student-tutor-radar" />,
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });
  return { promise, resolve, reject };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

function makeState(round = 1): SimulationState {
  return {
    user: {
      id: "student-1",
      name: "林知夏",
      role: "student",
      title: "沙盘学员",
    },
    classroom: {
      id: "class-1",
      name: "树德实验点班",
      region: "成都",
      teacherId: "teacher-1",
      challengeTheme: "稳健配置",
      schoolRank: 1,
    },
    run: {
      id: "run-1",
      userId: "student-1",
      classroomId: "class-1",
      scenarioName: "12 回合学期沙盘",
      currentRound: round,
      totalRounds: 12,
      cash: 57_720,
      savings: 12_000,
      debt: 0,
      propertyUnits: 0,
      propertyBasis: 0,
      ventureStake: 0,
      ventureBasis: 0,
      holdings: [{ assetId: "asset-etf", quantity: 20, averageCost: 90 }],
      eventHistory: [],
      actionLog: [],
      snapshots: [
        {
          round,
          netWorth: 125_748,
          cash: 57_720,
          savings: 12_000,
          debt: 0,
          riskScore: 53,
          disciplineScore: 82,
          reflection: "保持观察。",
        },
      ],
      netWorth: 125_748,
    },
    market: {
      round: {
        round,
        theme: "监管收紧",
        headline: "高景气赛道出现并购行情",
        summary: "训练学生识别波动与现金流。",
        assetMultipliers: {
          stock: 1,
          etf: 1,
          bond: 1,
          commodity: 1,
          fx: 1,
        },
        liquidityBoost: 0,
        eventId: "event-1",
      },
      assets: [
        {
          id: "asset-etf",
          symbol: "EDGE",
          name: "成长力量 ETF",
          category: "etf",
          description: "覆盖多行业龙头，适合学习分散投资。",
          basePrice: 90,
          risk: "中",
          currentPrice: 90,
          dayChange: 0.059,
        },
      ],
      event: {
        id: "event-1",
        title: "监管收紧",
        category: "policy",
        signal: "中性",
        description: "市场开始重新评估成长资产。",
        coachingCue: "先看现金垫，再做配置。",
      },
    },
    leaderboard: [
      {
        userId: "student-1",
        name: "林知夏",
        classroomId: "class-1",
        netWorth: 125_748,
        disciplineScore: 82,
        rank: 1,
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StudentSandbox", () => {
  it("keeps the advance-round button pending until the in-flight request finishes", async () => {
    const user = userEvent.setup();
    const advanceRequest = deferred<Response>();
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/billing/status")) {
        return Promise.resolve(
          jsonResponse({
            canUsePersonalAiAssessment: false,
            features: { seasonReplay: false },
          }),
        );
      }
      if (url.includes("/api/sim/advance-round")) {
        return advanceRequest.promise;
      }
      return Promise.resolve(jsonResponse({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StudentSandbox initialState={makeState()} />);

    const advanceButton = await screen.findByRole("button", { name: /推进下一回合/ });
    await user.click(advanceButton);

    await waitFor(() => expect(advanceButton).toBeDisabled());
    await user.click(advanceButton);

    const advanceCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes("/api/sim/advance-round"),
    );
    expect(advanceCalls).toHaveLength(1);

    advanceRequest.resolve(
      jsonResponse({
        state: makeState(2),
        message: "已推进到下一回合。",
      }),
    );

    await waitFor(() => expect(advanceButton).not.toBeDisabled());
  });
});
