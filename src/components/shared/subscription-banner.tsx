"use client";

import { useEffect, useState } from "react";
import type { SubscriptionTier } from "@/lib/types";
import { resolveSubscriptionState, type SubscriptionState } from "@/lib/billing/subscription";

interface Props {
  tier: SubscriptionTier | undefined;
  trialExpiresAt: string | undefined;
}

export function SubscriptionBanner({ tier, trialExpiresAt }: Props) {
  const [state, setState] = useState<SubscriptionState>(() =>
    resolveSubscriptionState(tier, trialExpiresAt),
  );

  useEffect(() => {
    setState(resolveSubscriptionState(tier, trialExpiresAt));
  }, [tier, trialExpiresAt]);

  if (!state.bannerMessage) return null;

  const isExpired = state.status === "expired";
  const bgClass = isExpired
    ? "bg-[var(--error-50)] border-[var(--error-400)]"
    : "bg-[var(--warning-50)] border-[var(--warning-400)]";
  const textClass = isExpired ? "text-[var(--error-500)]" : "text-[var(--warning-600)]";

  return (
    <div className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${bgClass}`}>
      <p className={`text-sm font-medium ${textClass}`}>
        {state.bannerMessage}
      </p>
      <a
        href="/pricing"
        className="shrink-0 rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--amber-600)]"
      >
        {isExpired ? "立即升级" : "了解方案"}
      </a>
    </div>
  );
}
