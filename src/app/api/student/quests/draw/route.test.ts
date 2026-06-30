import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/billing/subscription", () => ({ canUserOperate: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  drawCardForUser: vi.fn(),
  getLearningProgress: vi.fn(),
  getSimulationStateForUser: vi.fn(),
  listCardCollectionForUser: vi.fn(),
}));
vi.mock("@/lib/quests", () => ({ buildStudentQuestPayload: vi.fn() }));

import { requireUser } from "@/lib/api-guard";
import { apiError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import {
  drawCardForUser,
  getLearningProgress,
  getSimulationStateForUser,
  listCardCollectionForUser,
  type CardCollectionItem,
} from "@/lib/db/repo";
import { buildStudentQuestPayload, type StudentQuestItem } from "@/lib/quests";

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  role: "student",
  subscriptionTier: "premium",
  trialExpiresAt: null,
  subscriptionExpiresAt: null,
};

const run = {
  id: "run-1",
  userId: "student-1",
  classroomId: "class-test",
  currentRound: 6,
  netWorth: 125000,
  cash: 50000,
  actionLog: [],
  snapshots: [],
};

const learning = { completed: 2, total: 8, completedKeys: ["personal-finance", "stock-basic"] };

const claimableQuest: StudentQuestItem = {
  id: "review-rhythm",
  title: "完成 4 次回合复盘",
  category: "review",
  status: "done",
  progress: 1,
  claimable: true,
  claimed: false,
  target: "每回合留下复盘线索",
  reward: "装饰徽章：复盘记录员",
  coachNote: "把一次选择变成可复盘证据。",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;
const asState = (value: unknown) => value as Awaited<ReturnType<typeof getSimulationStateForUser>>;

describe("POST /api/student/quests/draw", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(canUserOperate).mockReturnValue(true);
    vi.mocked(getSimulationStateForUser).mockResolvedValue(asState({ run }));
    vi.mocked(getLearningProgress).mockResolvedValue(learning);
    vi.mocked(buildStudentQuestPayload).mockReturnValue({
      generatedAt: "2026-06-18T00:00:00.000Z",
      overview: { completed: 1, total: 1, active: 0, streakCurrent: 1, streakBest: 1, stageLabel: "测试阶段", learningCompleted: 2, learningTotal: 8 },
      quests: [claimableQuest],
      achievements: [],
      benefits: { title: "", summary: "", guardrail: "", items: [] },
      calendar: [],
      coach: { title: "", summary: "", nextActions: [] },
    });
    vi.mocked(listCardCollectionForUser).mockResolvedValue([]);
    vi.mocked(drawCardForUser).mockImplementation(async (userId, input) => ({
      id: "card-row-1",
      userId,
      cardId: input.cardId,
      source: input.source,
      drawnAt: "2026-06-18T00:00:00.000Z",
      meta: input.meta,
    }));
  });

  it("draws one decorative card for a claimable quest without changing finance state", async () => {
    const beforeNetWorth = run.netWorth;

    const res = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.card).toMatchObject({ id: expect.any(String), rarity: expect.any(String), teachingLine: expect.any(String) });
    expect(body.collectionItem).toMatchObject({
      userId: "student-1",
      cardId: body.card.id,
      source: "quest_claim",
      meta: expect.objectContaining({ questId: "review-rhythm", runId: "run-1", round: 6 }),
    });
    expect(body.alreadyDrawn).toBe(false);
    expect(run.netWorth).toBe(beforeNetWorth);
    expect(vi.mocked(drawCardForUser)).toHaveBeenCalledTimes(1);
  });

  it("returns the same stored card for the same quest trigger without writing again", async () => {
    const first = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
    const firstBody = await first.json();
    const stored: CardCollectionItem = {
      ...firstBody.collectionItem,
      meta: { ...firstBody.collectionItem.meta, questId: "review-rhythm" },
    };
    vi.mocked(listCardCollectionForUser).mockResolvedValueOnce([stored]);

    const second = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));

    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.card.id).toBe(firstBody.card.id);
    expect(secondBody.collectionItem.id).toBe(stored.id);
    expect(secondBody.alreadyDrawn).toBe(true);
    expect(vi.mocked(drawCardForUser)).toHaveBeenCalledTimes(1);
  });

  it("rejects unfinished quests and malformed requests before drawing", async () => {
    vi.mocked(buildStudentQuestPayload).mockReturnValueOnce({
      generatedAt: "2026-06-18T00:00:00.000Z",
      overview: { completed: 0, total: 1, active: 1, streakCurrent: 1, streakBest: 1, stageLabel: "测试阶段", learningCompleted: 2, learningTotal: 8 },
      quests: [{ ...claimableQuest, status: "active", progress: 0.4, claimable: false, claimed: false }],
      achievements: [],
      benefits: { title: "", summary: "", guardrail: "", items: [] },
      calendar: [],
      coach: { title: "", summary: "", nextActions: [] },
    });
    const unfinished = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
    expect(unfinished.status).toBe(403);
    expect((await unfinished.json()).error).toBe("forbidden");

    const malformed = await POST(makeRequest({ questId: "x", source: "quest_claim" }));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error).toBe("invalid_input");
    expect(vi.mocked(drawCardForUser)).not.toHaveBeenCalled();
  });

  it("blocks learning-card claims when the trial or subscription cannot operate", async () => {
    vi.mocked(canUserOperate).mockReturnValue(false);

    const res = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("试用已结束");
    expect(vi.mocked(drawCardForUser)).not.toHaveBeenCalled();
  });

  it("returns 429 with Chinese message after 20 draws from one user within the window", async () => {
    // Use a unique user id so this test has its own isolated rate-limit bucket.
    const RL_USER = { ...STUDENT, id: "student-rl-draw-test" };
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: RL_USER }));

    // Fire 20 requests — all within the 20/60s budget, so they should succeed
    // (or return alreadyDrawn on the second draw; the limiter still counts each request).
    for (let i = 0; i < 20; i++) {
      const res = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
      expect(res.status).not.toBe(429);
    }

    // The 21st request must trip the limiter.
    const over = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.error).toBe("service_unavailable");
    expect(body.message).toMatch(/请求过于频繁/);
  });

  it("propagates auth blocks and maps DB failures to db_unavailable", async () => {
    vi.mocked(requireUser).mockResolvedValueOnce(
      asRequireUser({ error: apiError("unauthorized", "请先登录后再领取任务学习卡。", 401) }),
    );
    const unauthorized = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
    expect(unauthorized.status).toBe(401);

    vi.mocked(getSimulationStateForUser).mockRejectedValueOnce(new Error("postgres connection timeout"));
    const dbError = await POST(makeRequest({ questId: "review-rhythm", source: "quest_claim" }));
    expect(dbError.status).toBe(503);
    expect((await dbError.json()).error).toBe("db_unavailable");
  });
});
