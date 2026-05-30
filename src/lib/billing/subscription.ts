import type { SubscriptionTier } from "@/lib/types";

export type SubscriptionStatus =
  | "trial"
  | "trial_degraded"
  | "active"
  | "grace_period"
  | "expired"
  | "cancelled";

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
  };
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
    };
  }

  return expiredState("试用已结束，升级后即可继续操作沙盘并获取 AI 个性化评定。", subscriptionExpiresAt);
}

export function canUserOperate(
  tier: SubscriptionTier | undefined,
  trialExpiresAt: string | undefined,
  subscriptionExpiresAtOrNow?: string | Date | undefined,
): boolean {
  return resolveSubscriptionState(tier, trialExpiresAt, subscriptionExpiresAtOrNow).canOperate;
}
