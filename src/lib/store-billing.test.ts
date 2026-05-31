import { describe, expect, it } from "vitest";

import {
  createPaymentOrder,
  findUserById,
  fulfillPaymentOrder,
  markOnboardingCompleted,
} from "@/lib/store";

describe("markOnboardingCompleted (store fallback)", () => {
  it("persists onboardingCompleted=1 so onboarding can actually be skipped offline", () => {
    expect(markOnboardingCompleted("student-1")).toBe(true);
    expect(findUserById("student-1")?.onboardingCompleted).toBe(1);
  });

  it("returns false for an unknown user", () => {
    expect(markOnboardingCompleted("nope")).toBe(false);
  });
});

describe("fulfillPaymentOrder session safety", () => {
  it("does not invalidate the payer's session on a family self-purchase", async () => {
    const before = findUserById("parent-1")?.tokenVersion ?? 0;

    await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "parent-1", // self-purchase (parent buys Premium for their family)
      tier: "premium",
      channel: "mock",
      amountFen: 3000,
      description: "高级版月卡",
      outTradeNo: "wxtest-self-purchase",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await fulfillPaymentOrder({ outTradeNo: "wxtest-self-purchase", transactionId: "tx-test" });

    const after = findUserById("parent-1");
    // tokenVersion MUST be unchanged so the payer's live session survives.
    expect(after?.tokenVersion ?? 0).toBe(before);
    expect(after?.subscriptionTier).toBe("premium");
  });

  it("rejects a callback whose amount does not match the order", async () => {
    await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "parent-1",
      tier: "standard",
      channel: "mock",
      amountFen: 1500,
      description: "标准版月卡",
      outTradeNo: "wxtest-amount-mismatch",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
    await expect(
      fulfillPaymentOrder({
        outTradeNo: "wxtest-amount-mismatch",
        transactionId: "tx-bad",
        paidAmountFen: 1, // attacker/underpay: 1 fen vs 1500
      }),
    ).rejects.toThrow();
  });
});
