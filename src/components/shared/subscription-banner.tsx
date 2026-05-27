"use client";

import { useEffect, useState } from "react";
import type { Role, SubscriptionTier } from "@/lib/types";
import { resolveSubscriptionState, type SubscriptionState } from "@/lib/billing/subscription";

interface Props {
  tier: SubscriptionTier | undefined;
  trialExpiresAt: string | undefined;
  role?: Role;
}

function studentSafeBannerMessage(state: SubscriptionState): string | null {
  if (!state.bannerMessage) return null;
  if (state.status === "expired") {
    return "试用已结束，请让家长或老师帮你解锁完整功能。";
  }
  if (state.status === "trial_degraded") {
    return `试用还剩 ${state.daysRemaining ?? 0} 天（AI 诊断已切换为通用版），请让家长帮你继续使用。`;
  }
  return state.bannerMessage;
}

export function SubscriptionBanner({ tier, trialExpiresAt, role }: Props) {
  const [state, setState] = useState<SubscriptionState>(() =>
    resolveSubscriptionState(tier, trialExpiresAt),
  );

  useEffect(() => {
    setState(resolveSubscriptionState(tier, trialExpiresAt));
  }, [tier, trialExpiresAt]);

  if (!state.bannerMessage) return null;

  const isStudent = role === "student";
  const displayMessage = isStudent ? studentSafeBannerMessage(state) : state.bannerMessage;
  if (!displayMessage) return null;

  const isExpired = state.status === "expired";
  const bgClass = isExpired
    ? "bg-[var(--error-50)] border-[var(--error-400)]"
    : "bg-[var(--warning-50)] border-[var(--warning-400)]";
  const textClass = isExpired ? "text-[var(--error-500)]" : "text-[var(--warning-600)]";

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${bgClass}`}>
      <p className={`text-sm font-medium ${textClass}`}>
        {displayMessage}
      </p>
      {!isStudent && (
        <a
          href="/demo"
          className="shrink-0 rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--amber-600)]"
        >
          {isExpired ? "了解升级方案" : "了解方案"}
        </a>
      )}
    </div>
  );
}
