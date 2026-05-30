import { describe, expect, it } from "vitest";

import { canUserOperate, resolveSubscriptionState } from "./subscription";

describe("resolveSubscriptionState", () => {
  const now = new Date("2026-05-27T10:00:00Z");

  it("returns active for standard tier", () => {
    const state = resolveSubscriptionState("standard", undefined, now);
    expect(state.status).toBe("active");
    expect(state.canOperate).toBe(true);
    expect(state.aiTier).toBe("full");
    expect(state.bannerMessage).toBeNull();
    expect(state.canUsePersonalAiAssessment).toBe(true);
  });

  it("expires a standard tier when subscriptionExpiresAt has passed", () => {
    const expiredAt = new Date(now);
    expiredAt.setDate(expiredAt.getDate() - 1);
    const state = resolveSubscriptionState("standard", undefined, expiredAt.toISOString(), now);
    expect(state.status).toBe("expired");
    expect(state.canOperate).toBe(false);
    expect(state.canUsePersonalAiAssessment).toBe(false);
  });

  it("returns active for premium tier", () => {
    const state = resolveSubscriptionState("premium", undefined, now);
    expect(state.status).toBe("active");
    expect(state.canOperate).toBe(true);
  });

  it("returns full trial on day one of a three-day trial", () => {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 3);
    const state = resolveSubscriptionState("free", trialEnd.toISOString(), now);
    expect(state.status).toBe("trial");
    expect(state.canOperate).toBe(true);
    expect(state.aiTier).toBe("full");
    expect(state.canUsePersonalAiAssessment).toBe(true);
  });

  it("keeps full AI while more than one day of the trial remains", () => {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 2);
    const state = resolveSubscriptionState("free", trialEnd.toISOString(), now);
    expect(state.status).toBe("trial");
    expect(state.aiTier).toBe("full");
    expect(state.canUsePersonalAiAssessment).toBe(true);
  });

  it("degrades to basic AI only on the final trial day", () => {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 1);
    const state = resolveSubscriptionState("free", trialEnd.toISOString(), now);
    expect(state.status).toBe("trial_degraded");
    expect(state.canOperate).toBe(true);
    expect(state.aiTier).toBe("basic");
    expect(state.canUsePersonalAiAssessment).toBe(false);
    expect(state.bannerMessage).toContain("基础 AI 试用还剩");
  });

  it("returns expired when trial has passed", () => {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() - 1);
    const state = resolveSubscriptionState("free", trialEnd.toISOString(), now);
    expect(state.status).toBe("expired");
    expect(state.canOperate).toBe(false);
    expect(state.canViewHistory).toBe(true);
    expect(state.aiTier).toBe("none");
    expect(state.bannerMessage).toContain("试用已结束");
  });

  it("returns expired when no trial date is set for free tier", () => {
    const state = resolveSubscriptionState("free", undefined, now);
    expect(state.status).toBe("expired");
    expect(state.canOperate).toBe(false);
  });

  it("defaults undefined tier to free", () => {
    const state = resolveSubscriptionState(undefined, undefined, now);
    expect(state.tier).toBe("free");
    expect(state.status).toBe("expired");
  });
});

describe("canUserOperate", () => {
  it("allows standard subscribers", () => {
    expect(canUserOperate("standard", undefined)).toBe(true);
  });

  it("blocks expired free users", () => {
    const expired = new Date();
    expired.setDate(expired.getDate() - 2);
    expect(canUserOperate("free", expired.toISOString())).toBe(false);
  });

  it("allows active trial users", () => {
    const future = new Date();
    future.setDate(future.getDate() + 3);
    expect(canUserOperate("free", future.toISOString())).toBe(true);
  });
});
