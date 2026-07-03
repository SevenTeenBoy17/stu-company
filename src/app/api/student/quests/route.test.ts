import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  claimQuestRewardForUser: vi.fn(),
  getLearningProgress: vi.fn(),
  getSimulationStateForUser: vi.fn(),
}));
vi.mock("@/lib/quests", () => ({ buildStudentQuestPayload: vi.fn() }));

import { requireUser } from "@/lib/api-guard";
import { claimQuestRewardForUser } from "@/lib/db/repo";

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  role: "student",
  subscriptionTier: "standard",
  trialExpiresAt: null,
  subscriptionExpiresAt: "2099-01-01T00:00:00.000Z",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;

describe("POST /api/student/quests", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(claimQuestRewardForUser).mockResolvedValue({
      payload: { overview: { completed: 1, total: 1 } },
      claimed: {
        questId: "observe-quest",
        title: "先写观察单",
        reward: "学习卡：冷静观察者",
        claimedAt: "2026-06-18T00:00:00.000Z",
        summary: "已领取",
      },
    } as never);
  });

  it("去付费墙回归锁：试用已过期的学生仍可领取装饰任务奖励（不得 403 推送升级）", async () => {
    // 合规（未成年人）：任务奖励纯装饰，领取不做订阅门控——若本用例失败，
    // 说明有人把 canUserOperate 加回了领取路径，请先阅读评审会 P1 结论。
    vi.mocked(requireUser).mockResolvedValue(
      asRequireUser({
        user: {
          ...STUDENT,
          subscriptionTier: "free",
          trialExpiresAt: "2020-01-01T00:00:00.000Z",
          subscriptionExpiresAt: null,
        },
      }),
    );

    const res = await POST(makeRequest({ questId: "observe-quest" }));

    expect(res.status).toBe(200);
    expect(vi.mocked(claimQuestRewardForUser)).toHaveBeenCalledWith("student-1", "observe-quest");
  });

  it("claims a learning card for an active student", async () => {
    const res = await POST(makeRequest({ questId: "observe-quest" }));

    expect(res.status).toBe(200);
    expect(vi.mocked(claimQuestRewardForUser)).toHaveBeenCalledWith("student-1", "observe-quest");
  });

  it("rejects malformed quest ids with a stable error shape", async () => {
    const res = await POST(makeRequest({ questId: "x" }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: "invalid_input", message: "请选择要领取的任务学习卡。" });
    expect(vi.mocked(claimQuestRewardForUser)).not.toHaveBeenCalled();
  });

  it("returns 429 with Chinese message after 20 claims from one user within the window", async () => {
    // 专属 user id 隔离限流桶（进程内限流器跨用例共享 Map）。
    const RL_USER = { ...STUDENT, id: "student-rl-claim-test" };
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: RL_USER }));

    for (let i = 0; i < 20; i++) {
      const res = await POST(makeRequest({ questId: "observe-quest" }));
      expect(res.status).not.toBe(429);
    }

    const over = await POST(makeRequest({ questId: "observe-quest" }));
    expect(over.status).toBe(429);
    const body = await over.json();
    expect(body.error).toBe("service_unavailable");
    expect(body.message).toMatch(/请求过于频繁/);
  });
});
