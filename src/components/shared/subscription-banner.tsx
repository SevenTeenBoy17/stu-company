"use client";

import { useState, useTransition } from "react";

import type { Role } from "@/lib/types";
import type { SubscriptionState } from "@/lib/billing/subscription";

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

/**
 * B1 (conversion): students can't pay directly (minors-payment compliance), but
 * the dead-end "ask a parent" copy converted nobody. This CTA lets a teen generate
 * a shareable link a parent opens to pay — turning a wish into a one-tap action.
 */
function StudentParentLinkCTA() {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      setError(null);
      setCopied(false);
      try {
        const response = await fetch("/api/billing/parent-link", { method: "POST" });
        const data = (await response.json()) as { url?: string; message?: string; error?: string };
        if (!response.ok || !data.url) {
          setError(data.message ?? "生成链接失败，请稍后再试。");
          return;
        }
        setLink(new URL(data.url, window.location.origin).toString());
      } catch {
        setError("网络异常，请稍后再试。");
      }
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {!link ? (
        <button
          type="button"
          onClick={generate}
          disabled={isPending}
          className="self-start rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--amber-600)] disabled:opacity-60"
        >
          {isPending ? "正在生成…" : "生成家长付款链接"}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--ink-200)] bg-white p-2.5">
          <input
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-lg bg-[var(--ink-50)] px-2.5 py-1.5 text-xs text-[var(--ink-700)]"
          />
          <button
            type="button"
            onClick={copy}
            className="self-start rounded-full bg-[var(--ink-900)] px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--ink-700)]"
          >
            {copied ? "已复制，发给家长吧" : "复制链接"}
          </button>
        </div>
      )}
      {error ? <p className="text-xs font-medium text-[var(--error-500)]">{error}</p> : null}
    </div>
  );
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
          className="shrink-0 rounded-full bg-[var(--brand)] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[var(--amber-600)]"
        >
          {isExpired ? "了解升级方案" : "了解方案"}
        </a>
      )}
    </div>
  );
}
