import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  getRiskProfile: vi.fn(),
  getSimulationStateForUser: vi.fn(),
  upsertRiskProfile: vi.fn(),
  cancelAutoInvestPlanForUser: vi.fn(),
  createAutoInvestPlanForUser: vi.fn(),
  applyLifeCashflowChallengeForUser: vi.fn(),
  applyCreditLabActionForUser: vi.fn(),
}));

import { requireUser } from "@/lib/api-guard";

import { POST as riskProfilePost } from "./risk-profile/route";
import { POST as autoInvestPost } from "./auto-invest/route";
import { POST as lifeCashflowPost } from "./life-cashflow/route";
import { POST as creditLabPost } from "./credit-lab/route";

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;

function makeRequest(body: unknown): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request;
}

const EXPIRED_STUDENT = {
  id: "student-expired",
  role: "student",
  subscriptionTier: "free",
  trialExpiresAt: "2020-01-01T00:00:00.000Z",
  subscriptionExpiresAt: null,
};

// 内测 rank4（B 决策）回归锁：理财 4 条实质写库路由与其余 9 条学生路由同口径门控。
// 若本组用例失败，说明有人移除了 canUserOperate——装饰性领卡的放开边界不适用于实质写库。
describe("理财写库路由订阅门控（rank4·B）", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: EXPIRED_STUDENT }));
  });

  const cases: Array<[string, (request: Request) => Promise<Response>]> = [
    ["risk-profile", riskProfilePost],
    ["auto-invest", autoInvestPost],
    ["life-cashflow", lifeCashflowPost],
    ["credit-lab", creditLabPost],
  ];

  for (const [name, post] of cases) {
    it(`${name} POST 对过期试用返回 403 forbidden（GET 读取不受影响）`, async () => {
      const res = await post(makeRequest({}));

      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe("forbidden");
      expect(body.message).toContain("试用已结束");
    });
  }
});
