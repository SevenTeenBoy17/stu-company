import { describe, expect, it } from "vitest";

import {
  attachManualPaymentProof,
  createPaymentOrder,
  findUserById,
  fulfillPaymentOrder,
  getAppSetting,
  markOnboardingCompleted,
  upsertAppSetting,
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

  it("opens a subscription after manual WeChat proof is confirmed by admin", async () => {
    await createPaymentOrder({
      userId: "parent-1",
      targetUserId: "student-1",
      tier: "standard",
      channel: "manual",
      amountFen: 1500,
      description: "Mr.Brown AI 经济沙盘 · 标准版月卡",
      outTradeNo: "wxtest-manual-proof",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const proofOrder = await attachManualPaymentProof("wxtest-manual-proof", {
      note: "微信转账单号 420000-test",
      proofImageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
      submittedBy: "parent-1",
    });

    expect(JSON.stringify(proofOrder.rawNotify)).toContain("420000-test");
    expect(JSON.stringify(proofOrder.rawNotify)).toContain("data:image/png;base64,iVBORw0KGgo=");

    const result = await fulfillPaymentOrder({
      outTradeNo: "wxtest-manual-proof",
      transactionId: "manual-wxtest-manual-proof",
      paidAmountFen: 1500,
      rawNotify: { manualConfirmed: true, confirmedBy: "superadmin" },
    });

    expect(result.order.status).toBe("paid");
    expect(result.grant?.tier).toBe("standard");
    expect(findUserById("student-1")?.subscriptionTier).toBe("standard");
  });

  it("stores manual WeChat settings in the offline fallback store", async () => {
    const saved = await upsertAppSetting("billing.manual_wechat", {
      qrUrl: "https://cdn.example.com/wechat.png",
      payeeName: "Brown Zone",
      instruction: "Use the order number as transfer note.",
    }, "superadmin");

    expect(saved.updatedBy).toBe("superadmin");
    await expect(getAppSetting("billing.manual_wechat")).resolves.toMatchObject({
      value: expect.objectContaining({
        qrUrl: "https://cdn.example.com/wechat.png",
      }),
    });
  });
});
