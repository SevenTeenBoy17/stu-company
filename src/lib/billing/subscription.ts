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
}

const TRIAL_FULL_DAYS = 1;
const TRIAL_DEGRADED_DAYS = 3;

export function resolveSubscriptionState(
  tier: SubscriptionTier | undefined,
  trialExpiresAt: string | undefined,
  now = new Date(),
): SubscriptionState {
  const effectiveTier = tier ?? "free";

  if (effectiveTier === "standard" || effectiveTier === "premium") {
    return {
      tier: effectiveTier,
      status: "active",
      canOperate: true,
      canViewHistory: true,
      aiTier: "full",
      bannerMessage: null,
      daysRemaining: null,
    };
  }

  if (!trialExpiresAt) {
    return {
      tier: "free",
      status: "expired",
      canOperate: false,
      canViewHistory: true,
      aiTier: "none",
      bannerMessage: "试用已结束。升级到标准版 (¥15/月) 即可继续操作沙盘、获取 AI 个性化诊断。",
      daysRemaining: 0,
    };
  }

  const trialEnd = new Date(trialExpiresAt);
  const msRemaining = trialEnd.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  if (daysRemaining > TRIAL_DEGRADED_DAYS) {
    return {
      tier: "free",
      status: "trial",
      canOperate: true,
      canViewHistory: true,
      aiTier: "full",
      bannerMessage: null,
      daysRemaining,
    };
  }

  if (daysRemaining > 0 && daysRemaining <= TRIAL_DEGRADED_DAYS) {
    const inFullTrial = daysRemaining > (TRIAL_DEGRADED_DAYS - TRIAL_FULL_DAYS);
    return {
      tier: "free",
      status: inFullTrial ? "trial" : "trial_degraded",
      canOperate: true,
      canViewHistory: true,
      aiTier: inFullTrial ? "full" : "basic",
      bannerMessage: `试用还剩 ${daysRemaining} 天${!inFullTrial ? "（AI 诊断已降级为通用版）" : ""}。¥15/月 即可解锁完整功能。`,
      daysRemaining,
    };
  }

  return {
    tier: "free",
    status: "expired",
    canOperate: false,
    canViewHistory: true,
    aiTier: "none",
    bannerMessage: "试用已结束。升级到标准版 (¥15/月) 即可继续操作沙盘、获取 AI 个性化诊断。",
    daysRemaining: 0,
  };
}

export function canUserOperate(
  tier: SubscriptionTier | undefined,
  trialExpiresAt: string | undefined,
): boolean {
  return resolveSubscriptionState(tier, trialExpiresAt).canOperate;
}
