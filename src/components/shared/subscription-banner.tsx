import type { Role } from "@/lib/types";
import type { SubscriptionState } from "@/lib/billing/subscription";

import { StudentParentLinkCTA } from "@/components/shared/student-parent-link-cta";

interface Props {
  state: SubscriptionState;
  role?: Role;
}

function studentSafeBannerMessage(state: SubscriptionState): string | null {
  if (!state.bannerMessage) return null;
  if (state.status === "expired") {
    return "试用已结束。点下面的按钮生成一个付款链接发给家长，家长用微信支付即可帮你解锁完整功能。";
  }
  if (state.status === "trial_degraded") {
    return `试用最后一天啦（AI 诊断已切换为通用版）。生成家长付款链接，解锁完整个性化评定。`;
  }
  return state.bannerMessage;
}

export function SubscriptionBanner({ state, role }: Props) {
  if (!state.bannerMessage) return null;

  const isStudent = role === "student";
  const displayMessage = isStudent ? studentSafeBannerMessage(state) : state.bannerMessage;
  if (!displayMessage) return null;

  const isExpired = state.status === "expired";
  const showStudentCta = isStudent && (state.status === "expired" || state.status === "trial_degraded");
  const bgClass = isExpired
    ? "bg-[var(--error-50)] border-[var(--error-400)]"
    : "bg-[var(--warning-50)] border-[var(--warning-400)]";
  const textClass = isExpired ? "text-[var(--error-500)]" : "text-[var(--warning-600)]";

  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3 ${bgClass}`}>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${textClass}`}>{displayMessage}</p>
        {showStudentCta ? <StudentParentLinkCTA /> : null}
      </div>
      {!isStudent && (
        <a
          href="/pricing"
          className="shrink-0 rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-slate-950 transition-colors hover:bg-[var(--amber-600)]"
        >
          {isExpired ? "了解升级方案" : "了解方案"}
        </a>
      )}
    </div>
  );
}
