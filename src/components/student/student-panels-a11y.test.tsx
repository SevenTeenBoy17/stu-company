import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { axe } from "vitest-axe";

import { buildAutoInvestPayload } from "@/lib/auto-invest";
import { buildCreditLabPayload } from "@/lib/credit-lab";
import { buildMarketBoardPayload } from "@/lib/market-watchlist";
import { buildPeerHeatPayload } from "@/lib/peer-heat";
import { buildRiskProfilePayload } from "@/lib/risk-profile";
import type { StudentQuestPayload } from "@/lib/quests";
import type { StudentSeasonChallengePayload } from "@/lib/season-challenges";
import { createInitialRun } from "@/lib/simulation";
import { buildStudentWatchlistPayload } from "@/lib/student-watchlist";

import { server } from "../../../tests/msw/server";
import { StudentAutoInvestDashboard } from "./student-auto-invest-dashboard";
import { StudentCreditLabDashboard } from "./student-credit-lab-dashboard";
import { StudentMarketBoard } from "./student-market-board";
import { StudentQuestDashboard } from "./student-quest-dashboard";
import { StudentRiskProfileDashboard } from "./student-risk-profile-dashboard";

const COMPONENT_AXE_OPTIONS = {
  rules: {
    // These panels are tested as isolated components, not full HTML documents.
    region: { enabled: false },
    "page-has-heading-one": { enabled: false },
    // jsdom cannot compute rendered color contrast reliably.
    "color-contrast": { enabled: false },
  },
};

function mockReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  );
}

function mockSvgPathLength() {
  Object.defineProperty(window.SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: vi.fn(() => 320),
  });
}

function makeRun() {
  return createInitialRun("student-a11y", "class-a11y", "a11y smoke", 20260706);
}

function makeQuestPayload(): StudentQuestPayload {
  return {
    generatedAt: "2026-07-06T08:00:00.000Z",
    overview: {
      completed: 1,
      total: 1,
      active: 0,
      streakCurrent: 2,
      streakBest: 3,
      stageLabel: "稳健训练期",
      learningCompleted: 1,
      learningTotal: 3,
    },
    quests: [
      {
        id: "observe-quest",
        title: "先写观察单",
        category: "risk",
        status: "done",
        progress: 1,
        claimable: true,
        claimed: false,
        target: "写下证据、风险和下一步验证动作。",
        reward: "装饰徽章：冷静观察者",
        coachNote: "先看证据，再判断是否进入下一次模拟配置。",
      },
    ],
    achievements: [
      {
        id: "first-note",
        title: "第一张观察单",
        unlocked: true,
        detail: "你已经完成一次观察记录。",
        decorativeReward: "头像边框：观察笔记",
      },
    ],
    benefits: {
      title: "学习留存",
      summary: "把复盘变成连续任务。",
      guardrail: "奖励只做装饰，不改变净值和学习榜。",
      items: [],
    },
    calendar: [{ round: 1, netWorth: 100000, delta: 0, tone: "flat", label: "起步记录" }],
    coach: {
      title: "继续保持证据感",
      summary: "先观察，再行动。",
      nextActions: ["下一次行动前先写一句理由。"],
    },
  };
}

function makeSeasonPayload(): StudentSeasonChallengePayload {
  return {
    id: "steady-config-week",
    title: "本周赛季：稳健配置挑战",
    summary: "完成观察、分散、保护和复盘。",
    progress: 20,
    reward: "装饰徽章：稳健挑战者",
    claimable: false,
    claimed: false,
    completedObjectives: 1,
    totalObjectives: 5,
    generatedAt: "2026-07-06T08:00:00.000Z",
    objectives: [
      {
        id: "market-observe",
        label: "市场观察",
        detail: "加入 1 个自选观察。",
        progress: 1,
        target: 1,
        href: "/student/market",
        done: true,
      },
    ],
  };
}

describe("student high-traffic panels accessibility smoke", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (window.SVGElement.prototype as unknown as { getTotalLength?: () => number }).getTotalLength;
  });

  it("renders the market board without axe-core violations", async () => {
    mockSvgPathLength();
    const run = makeRun();
    const marketPayload = buildMarketBoardPayload({ selectedSymbol: "NVDA" });
    const watchlistPayload = buildStudentWatchlistPayload(run, marketPayload);
    const peerHeatPayload = buildPeerHeatPayload([run], run, "A11y 测试班", new Date("2026-07-06T08:00:00.000Z"));

    server.use(
      http.get("/api/market/board", () => HttpResponse.json(marketPayload)),
      http.get("/api/student/watchlist", () => HttpResponse.json({ payload: watchlistPayload })),
      http.get("/api/market/peer-heat", () => HttpResponse.json({ payload: peerHeatPayload })),
    );

    const { container } = render(
      <StudentMarketBoard
        initialPayload={marketPayload}
        initialWatchlistPayload={watchlistPayload}
        initialPeerHeatPayload={peerHeatPayload}
      />,
    );

    await screen.findByRole("button", { name: /让 AI 解读/ });
    const results = await axe(container, COMPONENT_AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  }, 15_000);

  it("renders the auto-invest dashboard without axe-core violations", async () => {
    mockReducedMotion();
    const { container } = render(<StudentAutoInvestDashboard initialPayload={buildAutoInvestPayload(makeRun())} />);

    expect(screen.getByTestId("auto-invest-submit")).toBeInTheDocument();
    const results = await axe(container, COMPONENT_AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it("renders the credit lab dashboard without axe-core violations", async () => {
    mockReducedMotion();
    const { container } = render(<StudentCreditLabDashboard initialPayload={buildCreditLabPayload(makeRun())} />);

    await screen.findByRole("button", { name: /先模拟成本/ });
    const results = await axe(container, COMPONENT_AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it("renders the quest dashboard without axe-core violations", async () => {
    mockReducedMotion();
    const { container } = render(
      <StudentQuestDashboard payload={makeQuestPayload()} seasonPayload={makeSeasonPayload()} />,
    );

    await screen.findByTestId("quest-map-gallery");
    const results = await axe(container, COMPONENT_AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });

  it("renders the persisted risk profile dashboard without axe-core violations", async () => {
    mockReducedMotion();
    const { container } = render(
      <StudentRiskProfileDashboard initialPayload={buildRiskProfilePayload(makeRun())} initialAnswersPersisted />,
    );

    await screen.findByTestId("behavior-persona-submit");
    const results = await axe(container, COMPONENT_AXE_OPTIONS);
    expect(results).toHaveNoViolations();
  });
});
