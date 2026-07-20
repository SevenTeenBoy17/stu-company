import { describe, expect, it } from "vitest";

import {
  canAddFamilyMember,
  canUserOperate,
  evaluatePersonalAiAccess,
  laterExpiry,
  resolveSubscriptionState,
} from "./subscription";

// itest10 #8: family sharing may only EXTEND a student's Premium — never stamp
// the owner's earlier expiry over the student's own longer coverage.
describe("laterExpiry", () => {
  it("keeps the later of two ISO dates", () => {
    expect(laterExpiry("2026-08-01T00:00:00Z", "2030-01-01T00:00:00Z")).toBe("2030-01-01T00:00:00Z");
    expect(laterExpiry("2030-01-01T00:00:00Z", "2026-08-01T00:00:00Z")).toBe("2030-01-01T00:00:00Z");
  });

  it("treats undefined as no coverage (the real date wins)", () => {
    expect(laterExpiry(undefined, "2026-08-01T00:00:00Z")).toBe("2026-08-01T00:00:00Z");
    expect(laterExpiry("2026-08-01T00:00:00Z", undefined)).toBe("2026-08-01T00:00:00Z");
    expect(laterExpiry(undefined, undefined)).toBeUndefined();
  });
});

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

  it("grants the premium feature set for premium tier", () => {
    const features = resolveSubscriptionState("premium", undefined, now).features;
    expect(features.maxStudents).toBe(3);
    expect(features.deepAiReport).toBe(true);
    expect(features.weeklyParentEmail).toBe(true);
    expect(features.seasonReplay).toBe(true);
  });

  it("grants only the standard feature set for standard tier", () => {
    const features = resolveSubscriptionState("standard", undefined, now).features;
    expect(features.maxStudents).toBe(1);
    expect(features.deepAiReport).toBe(false);
    expect(features.weeklyParentEmail).toBe(false);
  });

  it("gives expired users no paid features", () => {
    const features = resolveSubscriptionState("free", undefined, now).features;
    expect(features.maxStudents).toBe(0);
    expect(features.deepAiReport).toBe(false);
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

describe("evaluatePersonalAiAccess (A1 verification gate)", () => {
  const now = new Date("2026-05-27T10:00:00Z");
  function trialState() {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 3);
    return resolveSubscriptionState("free", trialEnd.toISOString(), now);
  }

  it("allows trial users when verification is not required", () => {
    const access = evaluatePersonalAiAccess(trialState(), {
      emailVerified: false,
      requireVerification: false,
    });
    expect(access.ok).toBe(true);
  });

  it("blocks unverified trial users with a 'verify' reason when required", () => {
    const access = evaluatePersonalAiAccess(trialState(), {
      emailVerified: false,
      requireVerification: true,
    });
    expect(access.ok).toBe(false);
    expect(access.reason).toBe("verify");
  });

  it("allows verified trial users when verification is required", () => {
    const access = evaluatePersonalAiAccess(trialState(), {
      emailVerified: true,
      requireVerification: true,
    });
    expect(access.ok).toBe(true);
  });

  it("never gates paid subscribers on verification", () => {
    const paid = resolveSubscriptionState("standard", undefined, now);
    const access = evaluatePersonalAiAccess(paid, { emailVerified: false, requireVerification: true });
    expect(access.ok).toBe(true);
  });

  it("blocks expired users with an 'upgrade' reason regardless of verification", () => {
    const expired = resolveSubscriptionState("free", undefined, now);
    const access = evaluatePersonalAiAccess(expired, { emailVerified: true, requireVerification: false });
    expect(access.ok).toBe(false);
    expect(access.reason).toBe("upgrade");
  });

  it("returns 'upgrade' (not 'verify') for a trial_degraded user even when unverified", () => {
    const trialEnd = new Date(now);
    trialEnd.setDate(trialEnd.getDate() + 1); // final trial day → trial_degraded
    const degraded = resolveSubscriptionState("free", trialEnd.toISOString(), now);
    expect(degraded.status).toBe("trial_degraded");
    const access = evaluatePersonalAiAccess(degraded, {
      emailVerified: false,
      requireVerification: true,
    });
    expect(access.ok).toBe(false);
    expect(access.reason).toBe("upgrade");
  });
});

describe("canAddFamilyMember (premium family seats)", () => {
  it("allows adding while under the seat cap", () => {
    expect(canAddFamilyMember(0, 3)).toBe(true);
    expect(canAddFamilyMember(2, 3)).toBe(true);
  });

  it("blocks at or over the seat cap", () => {
    expect(canAddFamilyMember(3, 3)).toBe(false);
    expect(canAddFamilyMember(4, 3)).toBe(false);
  });

  it("blocks when the owner has no seats (non-premium)", () => {
    expect(canAddFamilyMember(0, 0)).toBe(false);
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
