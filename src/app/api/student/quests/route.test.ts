import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/billing/subscription", () => ({ canUserOperate: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  claimQuestRewardForUser: vi.fn(),
  getLearningProgress: vi.fn(),
  getSimulationStateForUser: vi.fn(),
}));
vi.mock("@/lib/quests", () => ({ buildStudentQuestPayload: vi.fn() }));

import { requireUser } from "@/lib/api-guard";
import { canUserOperate } from "@/lib/billing/subscription";
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
    vi.mocked(canUserOperate).mockReturnValue(true);
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

  it("blocks quest reward writes when the trial or subscription cannot operate", async () => {
    vi.mocked(canUserOperate).mockReturnValue(false);

    const res = await POST(makeRequest({ questId: "observe-quest" }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("forbidden");
    expect(body.message).toContain("试用已结束");
    expect(vi.mocked(claimQuestRewardForUser)).not.toHaveBeenCalled();
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
});
