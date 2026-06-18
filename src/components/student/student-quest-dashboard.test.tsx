import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StudentQuestDashboard } from "@/components/student/student-quest-dashboard";
import type { StudentQuestPayload } from "@/lib/quests";
import type { StudentSeasonChallengePayload } from "@/lib/season-challenges";

function makeQuestPayload(): StudentQuestPayload {
  return {
    generatedAt: "2026-06-18T08:00:00.000Z",
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
      guardrail: "奖励只做装饰，不改变净值和排行榜。",
      items: [],
    },
    calendar: [
      {
        round: 1,
        netWorth: 100000,
        delta: 0,
        tone: "flat",
        label: "起步记录",
      },
    ],
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
    generatedAt: "2026-06-18T08:00:00.000Z",
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

describe("StudentQuestDashboard quest flip", () => {
  it("flips a weekly quest card to reveal reward and coach note", async () => {
    render(<StudentQuestDashboard payload={makeQuestPayload()} seasonPayload={makeSeasonPayload()} />);

    const user = userEvent.setup();
    expect(screen.getByTestId("quest-card-observe-quest")).toBeInTheDocument();
    const flipButton = screen.getByTestId("quest-flip-observe-quest");

    expect(flipButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("quest-card-front-observe-quest")).toHaveTextContent("先写观察单");

    await user.click(flipButton);

    expect(flipButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("quest-card-back-observe-quest")).toHaveTextContent("装饰徽章：冷静观察者");
    expect(screen.getByTestId("quest-card-back-observe-quest")).toHaveTextContent("先看证据");
  });
});
