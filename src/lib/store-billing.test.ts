import { describe, expect, it } from "vitest";

import { createPaymentOrder, findUserById, fulfillPaymentOrder } from "@/lib/store";

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
});
