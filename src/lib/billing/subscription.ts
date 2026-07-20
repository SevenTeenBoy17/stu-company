import type { SubscriptionTier } from "@/lib/types";

export type SubscriptionStatus =
  | "trial"
  | "trial_degraded"
  | "active"
  | "grace_period"
  | "expired"
  | "cancelled";

/** Capability differences between Standard (¥15) and Premium (¥30) tiers. */
export interface TierFeatures {
  /** Number of student accounts the payer can keep active (Premium = family). */
  maxStudents: number;
  /** Deep AI review + shareable investor-personality report (Premium only). */
  deepAiReport: boolean;
  /** Weekly parent growth report delivered by email (Premium only). */
  weeklyParentEmail: boolean;
  /** Multi-run archive + replay with new seeds / seasons (Premium only). */
  seasonReplay: boolean;
}

const FEATURES_NONE: TierFeatures = {
  maxStudents: 0,
  deepAiReport: false,
  weeklyParentEmail: false,
  seasonReplay: false,
};
const FEATURES_STANDARD: TierFeatures = {
  maxStudents: 1,
  deepAiReport: false,
  weeklyParentEmail: false,
  seasonReplay: false,
};
const FEATURES_PREMIUM: TierFeatures = {
  maxStudents: 3,
  deepAiReport: true,
  weeklyParentEmail: true,
  seasonReplay: true,
};

export interface SubscriptionState {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  canOperate: boolean;
  canViewHistory: boolean;
  aiTier: "full" | "basic" | "none";
  bannerMessage: string | null;
  daysRemaining: number | null;
  trialMode: "full" | "basic" | "expired" | null;
  trialDaysRemaining: number | null;
  subscriptionExpiresAt: string | null;
  canUsePersonalAiAssessment: boolean;
  features: TierFeatures;
}

// B2 (conversion): keep full AI for the bulk of the trial so teens experience the
// real value and form a habit; only the final day degrades to basic as an upgrade
// nudge. Full while daysRemaining > (TOTAL - FULL) = > 1.
const TRIAL_FULL_DAYS = 2;
const TRIAL_TOTAL_DAYS = 3;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function daysUntil(date: Date, now: Date) {
  return Math.max(0, Math.ceil((date.getTime() - now.getTime()) / MS_PER_DAY));
}

function expiredState(message: string, subscriptionExpiresAt?: string): SubscriptionState {
  return {
    tier: "free",
    status: "expired",
    canOperate: false,
    canViewHistory: true,
    aiTier: "none",
    bannerMessage: message,
    daysRemaining: 0,
    trialMode: "expired",
    trialDaysRemaining: 0,
    subscriptionExpiresAt: subscriptionExpiresAt ?? null,
    canUsePersonalAiAssessment: false,
    features: FEATURES_NONE,
  };
}

/**
 * Pick the later of two subscription expiry timestamps (ISO strings), treating
 * `undefined` as "no coverage" (loses to any real date). Used so family sharing
 * only ever EXTENDS a student's Premium, never shortens their own longer one
 * (itest10 #8).
 */
export function laterExpiry(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function resolveSubscriptionState(
  tier: SubscriptionTier | undefined,
  trialExpiresAt: string | undefined,
  subscriptionExpiresAtOrNow?: string | Date | undefined,
  maybeNow?: Date,
): SubscriptionState {
  const subscriptionExpiresAt =
    subscriptionExpiresAtOrNow instanceof Date ? undefined : subscriptionExpiresAtOrNow;
  const now = subscriptionExpiresAtOrNow instanceof Date
    ? subscriptionExpiresAtOrNow
    : (maybeNow ?? new Date());
  const effectiveTier = tier ?? "free";

  if (effectiveTier === "standard" || effectiveTier === "premium") {
    const expiresAt = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      return expiredState(
        "订阅已到期，续费后即可继续操作沙盘并获取 AI 个性化评定。",
        subscriptionExpiresAt,
      );
    }

    return {
      tier: effectiveTier,
      status: "active",
      canOperate: true,
      canViewHistory: true,
      aiTier: "full",
      bannerMessage: null,
      daysRemaining: expiresAt ? daysUntil(expiresAt, now) : null,
      trialMode: null,
      trialDaysRemaining: null,
      subscriptionExpiresAt: subscriptionExpiresAt ?? null,
      canUsePersonalAiAssessment: true,
      features: effectiveTier === "premium" ? FEATURES_PREMIUM : FEATURES_STANDARD,
    };
  }

  if (!trialExpiresAt) {
    return expiredState("试用已结束，升级后即可继续操作沙盘并获取 AI 个性化评定。");
  }

  const trialEnd = new Date(trialExpiresAt);
  const daysRemaining = daysUntil(trialEnd, now);

  if (daysRemaining > TRIAL_TOTAL_DAYS - TRIAL_FULL_DAYS) {
    return {
      tier: "free",
      status: "trial",
      canOperate: true,
      canViewHistory: true,
      aiTier: "full",
      bannerMessage: null,
      daysRemaining,
      trialMode: "full",
      trialDaysRemaining: daysRemaining,
      subscriptionExpiresAt: subscriptionExpiresAt ?? null,
      canUsePersonalAiAssessment: true,
      features: FEATURES_STANDARD,
    };
  }

  if (daysRemaining > 0) {
    return {
      tier: "free",
      status: "trial_degraded",
      canOperate: true,
      canViewHistory: true,
      aiTier: "basic",
      bannerMessage: `基础 AI 试用还剩 ${daysRemaining} 天。升级后可解锁完整个性化评定，并继续推进沙盘。`,
      daysRemaining,
      trialMode: "basic",
      trialDaysRemaining: daysRemaining,
      subscriptionExpiresAt: subscriptionExpiresAt ?? null,
      canUsePersonalAiAssessment: false,
      features: FEATURES_STANDARD,
    };
  }

  return expiredState("试用已结束，升级后即可继续操作沙盘并获取 AI 个性化评定。", subscriptionExpiresAt);
}

/**
 * A1 enforcement: decide whether a user may use the personalized AI assessment,
 * factoring email verification when it is required (gray-launch). Paid
 * subscribers are never gated on verification (they are real users); only
 * trial/free users are, which is the trial-farming surface.
 */
export function evaluatePersonalAiAccess(
  state: SubscriptionState,
  opts: { emailVerified: boolean; requireVerification: boolean },
): { ok: boolean; reason: "ok" | "upgrade" | "verify" } {
  if (!state.canUsePersonalAiAssessment) return { ok: false, reason: "upgrade" };
  if (opts.requireVerification && state.status !== "active" && !opts.emailVerified) {
    return { ok: false, reason: "verify" };
  }
  return { ok: true, reason: "ok" };
}

/**
 * Family seats (Option B): a Premium owner can host up to features.maxStudents
 * members. Pure cap check used when adding a student to a family group.
 */
export function canAddFamilyMember(currentCount: number, maxSeats: number): boolean {
  return currentCount < maxSeats;
}

export function canUserOperate(
  tier: SubscriptionTier | undefined,
  trialExpiresAt: string | undefined,
  subscriptionExpiresAtOrNow?: string | Date | undefined,
): boolean {
  return resolveSubscriptionState(tier, trialExpiresAt, subscriptionExpiresAtOrNow).canOperate;
}
