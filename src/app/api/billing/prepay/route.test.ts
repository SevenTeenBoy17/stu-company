// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  buildRateLimitMessage: vi.fn(() => "请求过于频繁，请稍后再试。"),
  rateLimit: vi.fn(() => ({ ok: true })),
  rateLimitKey: vi.fn(() => "test-rate-limit-key"),
}));
vi.mock("@/lib/billing/manual-wechat", () => ({ getManualWechatCollectionConfig: vi.fn() }));
vi.mock("@/lib/billing/wechat-pay", () => ({
  createPrepayOrder: vi.fn(),
  isWechatMockAllowed: vi.fn(() => true),
  isWechatPayConfigured: vi.fn(() => false),
}));
vi.mock("@/lib/db/repo", () => ({
  canUserPayForTarget: vi.fn(),
  createPaymentOrder: vi.fn(),
  findUserById: vi.fn(),
  updatePaymentOrderProviderFields: vi.fn(),
}));

import { requireUser } from "@/lib/api-guard";
import { createBillingIntent } from "@/lib/billing/billing-intent";
import {
  canUserPayForTarget,
  createPaymentOrder,
  findUserById,
  updatePaymentOrderProviderFields,
} from "@/lib/db/repo";

import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return { json: async () => body, headers: new Headers() } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  email: "student@brownzone.ai",
  name: "学生",
  role: "student",
};

const PARENT = {
  id: "parent-1",
  email: "parent@brownzone.ai",
  name: "家长",
  role: "parent",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;

describe("POST /api/billing/prepay", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(findUserById).mockResolvedValue(STUDENT as never);
    vi.mocked(canUserPayForTarget).mockResolvedValue(false);
    vi.mocked(createPaymentOrder).mockResolvedValue({ id: "order-1" } as never);
    vi.mocked(updatePaymentOrderProviderFields).mockResolvedValue({
      id: "order-1",
      outTradeNo: "wxorder_test",
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      amountFen: 1500,
      description: "Mr.Brown AI 经济沙盘 · 标准版月卡",
    } as never);
  });

  it("blocks ordinary student self-pay without creating an order", async () => {
    const res = await POST(makeRequest({ tier: "standard", channel: "native" }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: "forbidden",
      message: "学生账号不能直接发起付款，请让家长或老师查看开通说明。",
    });
    expect(vi.mocked(createPaymentOrder)).not.toHaveBeenCalled();
  });

  it("blocks a student even when they hold a parent-link billing intent", async () => {
    const { token } = await createBillingIntent({
      purpose: "parent-link-prepay",
      userId: "student-1",
      tier: "standard",
    });

    const res = await POST(
      makeRequest({ tier: "standard", channel: "native", billingIntentToken: token }),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      error: "forbidden",
      message: "学生账号不能直接发起付款，请让家长或老师查看开通说明。",
    });
    expect(vi.mocked(createPaymentOrder)).not.toHaveBeenCalled();
  });

  it("lets a non-student payer use a parent-link intent for the linked student target", async () => {
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: PARENT }));
    const { token } = await createBillingIntent({
      purpose: "parent-link-prepay",
      userId: "student-1",
      tier: "standard",
    });

    const res = await POST(
      makeRequest({ tier: "standard", channel: "native", billingIntentToken: token }),
    );

    expect(res.status).toBe(200);
    expect(vi.mocked(canUserPayForTarget)).not.toHaveBeenCalled();
    expect(vi.mocked(createPaymentOrder)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "parent-1",
        targetUserId: "student-1",
        tier: "standard",
        channel: "mock",
        amountFen: 1500,
      }),
    );
  });
});
