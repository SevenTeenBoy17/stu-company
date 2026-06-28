import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StudentQuestDashboard, type QuestCardCollectionView } from "@/components/student/student-quest-dashboard";
import type { QuestCard } from "@/lib/cards";
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

const drawnCard: QuestCard = {
  id: "calm-observer",
  name: "冷静观察者",
  rarity: "rare",
  artKey: "calm-observer",
  teachingLine: "先记录证据，再决定是否行动。",
};

function makeCollectionItem(): QuestCardCollectionView {
  return {
    id: "card-row-1",
    userId: "student-1",
    cardId: drawnCard.id,
    source: "quest_claim",
    drawnAt: "2026-06-18T08:00:00.000Z",
    meta: { questId: "observe-quest", questTitle: "先写观察卡" },
    card: drawnCard,
  };
}

describe("StudentQuestDashboard quest flip", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("flips a weekly quest card to reveal reward and coach note", async () => {
    render(<StudentQuestDashboard payload={makeQuestPayload()} seasonPayload={makeSeasonPayload()} />);

    const user = userEvent.setup();
    expect(screen.getByTestId("quest-card-observe-quest")).toBeInTheDocument();
    const flipButton = screen.getByTestId("quest-flip-observe-quest");

    expect(flipButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByTestId("quest-card-front-observe-quest")).toHaveTextContent("第 1 号任务锦囊");

    await user.click(flipButton);

    expect(flipButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("quest-card-back-observe-quest")).toHaveTextContent("先写观察单");
    expect(screen.getByTestId("quest-card-back-observe-quest")).toHaveTextContent("装饰徽章：冷静观察者");
    expect(screen.getByTestId("quest-card-back-observe-quest")).toHaveTextContent("写下证据");

    // findBy* (async) waits for the post-flip a11y tree to settle — the back-face content
    // renders immediately (testids above) but the accessibility tree can update a tick later,
    // which the synchronous getByRole loses on slower CI runners (passes locally, flaked on CI).
    await user.click(await screen.findByRole("button", { name: "查看任务详情" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("先看证据");
    await user.click(await screen.findByRole("button", { name: "关闭任务详情" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("claims a completed quest, draws a card, reveals it, and adds it to the collection", async () => {
    const collectionItem = makeCollectionItem();
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/student/quests") {
        return Response.json({
          payload: {
            ...makeQuestPayload(),
            quests: [{ ...makeQuestPayload().quests[0], claimable: false, claimed: true }],
          },
          claimed: {
            questId: "observe-quest",
            title: "observe quest",
            reward: "decorative badge",
            claimedAt: "2026-06-18T08:00:00.000Z",
            summary: "claimed",
          },
        });
      }
      if (url === "/api/student/quests/draw") {
        return Response.json({ card: drawnCard, collectionItem, alreadyDrawn: false });
      }
      throw new Error("unexpected fetch " + url);
    });

    render(<StudentQuestDashboard payload={makeQuestPayload()} seasonPayload={makeSeasonPayload()} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("quest-flip-observe-quest"));
    await user.click(screen.getByTestId("quest-claim-observe-quest"));

    expect(await screen.findByTestId("quest-draw-result")).toBeInTheDocument();
    expect(await screen.findByTestId("quest-drawn-card-observe-quest")).toHaveTextContent(drawnCard.name);
    expect(screen.getByTestId("collection-card-calm-observer")).toHaveTextContent(drawnCard.name);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/student/quests")).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/student/quests/draw")).toHaveLength(1);
  });

  it("renders the persisted card collection on refresh", () => {
    render(
      <StudentQuestDashboard
        payload={makeQuestPayload()}
        seasonPayload={makeSeasonPayload()}
        initialCollection={[makeCollectionItem()]}
      />,
    );

    expect(screen.getByTestId("quest-card-collection")).toBeInTheDocument();
    expect(screen.getByTestId("collection-card-calm-observer")).toHaveTextContent(drawnCard.name);
    expect(screen.getByTestId("quest-drawn-card-observe-quest")).toHaveTextContent(drawnCard.teachingLine);
  });

  it("guards against double submit while a quest claim is pending", async () => {
    let resolveClaim!: (response: Response) => void;
    const claimPromise = new Promise<Response>((resolve) => {
      resolveClaim = resolve;
    });
    const fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "/api/student/quests") return claimPromise;
      if (url === "/api/student/quests/draw") {
        return Response.json({ card: drawnCard, collectionItem: makeCollectionItem(), alreadyDrawn: false });
      }
      throw new Error("unexpected fetch " + url);
    });

    render(<StudentQuestDashboard payload={makeQuestPayload()} seasonPayload={makeSeasonPayload()} />);

    const user = userEvent.setup();
    await user.click(screen.getByTestId("quest-flip-observe-quest"));
    await user.click(screen.getByTestId("quest-claim-observe-quest"));
    await user.click(screen.getByTestId("quest-claim-observe-quest"));

    expect(fetchMock.mock.calls.filter(([url]) => String(url) === "/api/student/quests")).toHaveLength(1);

    resolveClaim(
      Response.json({
        payload: {
          ...makeQuestPayload(),
          quests: [{ ...makeQuestPayload().quests[0], claimable: false, claimed: true }],
        },
        claimed: {
          questId: "observe-quest",
          title: "observe quest",
          reward: "decorative badge",
          claimedAt: "2026-06-18T08:00:00.000Z",
          summary: "claimed",
        },
      }),
    );
    expect(await screen.findByTestId("collection-card-calm-observer")).toBeInTheDocument();
  });
});
