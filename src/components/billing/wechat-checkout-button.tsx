"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";

type CheckoutPayload = {
  orderId: string;
  outTradeNo: string;
  codeUrl?: string;
  expiresAt: string;
  mock?: boolean;
  message?: string;
  error?: string;
};

type BillingTarget = {
  id: string;
  name: string;
  email: string;
  subscriptionTier?: string;
  subscriptionExpiresAt?: string;
};

type BillingStatusPayload = {
  viewer?: { role: string };
  eligibleTargets?: BillingTarget[];
};

const TIER_LABEL: Record<"standard" | "premium", string> = {
  standard: "微信开通 15 元/月",
  premium: "微信开通 30 元/月",
};

export function WechatCheckoutButton({
  tier = "standard",
}: {
  tier?: "standard" | "premium";
} = {}) {
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [targets, setTargets] = useState<BillingTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  // B1: a `?upgrade=<token>` query (from a teen's parent-payment link) carries a
  // signed intent that authorizes paying for that specific student.
  const [upgradeToken, setUpgradeToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCompleting, startCompleteTransition] = useTransition();

  useEffect(() => {
    // Read the browser-only URL param after hydration (deferring avoids an
    // SSR/client hydration mismatch on the server-rendered pricing page).
    const token = new URLSearchParams(window.location.search).get("upgrade");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL (external) once on mount
    if (token) setUpgradeToken(token);
  }, []);

  useEffect(() => {
    let alive = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as BillingStatusPayload;
      })
      .then((status) => {
        if (!alive || !status?.eligibleTargets) return;
        setTargets(status.eligibleTargets);
        setSelectedTargetId((current) => current || status.eligibleTargets?.[0]?.id || "");
      })
      .catch(() => {
        // The checkout button still works for regular logged-in users; target
        // discovery is only needed for parent/teacher sponsored payments.
      });
    return () => {
      alive = false;
    };
  }, []);

  // Render the native pay URL as a scannable QR (real WeChat pay).
  useEffect(() => {
    let alive = true;
    if (payload?.codeUrl && !payload.mock) {
      void QRCode.toDataURL(payload.codeUrl, { width: 208, margin: 1 })
        .then((url) => {
          if (alive) setQrDataUrl(url);
        })
        .catch(() => {
          /* fall back to the copyable link below */
        });
    }
    return () => {
      alive = false;
    };
  }, [payload]);

  // Poll the order status for a real payment until the notify webhook verifies it.
  useEffect(() => {
    if (!payload || payload.mock || payload.error || !payload.outTradeNo) return;
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/billing/order-status?outTradeNo=${encodeURIComponent(payload.outTradeNo)}`,
          { cache: "no-store" },
        );
        if (!response.ok) return;
        const data = (await response.json()) as { paid?: boolean };
        if (active && data.paid) {
          window.clearInterval(interval);
          setPaid(true);
          setCompleteMessage("支付成功，订阅权益已开通。");
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [payload]);

  function startCheckout() {
    startTransition(async () => {
      setPayload(null);
      setCompleteMessage(null);
      setQrDataUrl(null);
      setPaid(false);
      const response = await fetch("/api/billing/prepay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          channel: "native",
          targetUserId: upgradeToken ? undefined : selectedTargetId || undefined,
          billingIntentToken: upgradeToken ?? undefined,
        }),
      });
      const data = (await response.json()) as CheckoutPayload;
      if (response.status === 401) {
        window.location.href = "/demo?reason=login_required";
        return;
      }
      setPayload(data);
    });
  }

  function completeMockOrder() {
    if (!payload?.outTradeNo) return;
    startCompleteTransition(async () => {
      setCompleteMessage(null);
      const response = await fetch("/api/billing/mock-complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ outTradeNo: payload.outTradeNo }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setCompleteMessage(data.message ?? data.error ?? "模拟支付完成失败，请稍后重试。");
        return;
      }
      setPaid(true);
      setCompleteMessage(data.message ?? "模拟支付已完成，订阅权益已开通。");
    });
  }

  return (
    <div className="mt-8 space-y-3">
      {upgradeToken ? (
        <div className="rounded-2xl border border-[var(--amber-200)] bg-[var(--amber-50)] p-3 text-left text-xs leading-5 text-[var(--ink-600)]">
          你正在通过孩子分享的链接为 TA 开通个人月卡，支付成功后孩子的账号会自动恢复完整功能。
        </div>
      ) : null}
      {!upgradeToken && targets.length > 0 ? (
        <label className="block rounded-2xl border border-[var(--ink-200)] bg-white p-3 text-left">
          <span className="text-xs font-semibold text-[var(--ink-500)]">开通对象</span>
          <select
            value={selectedTargetId}
            onChange={(event) => setSelectedTargetId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[var(--ink-200)] bg-[var(--ink-50)] px-3 py-2 text-sm font-semibold text-[var(--ink-900)] outline-none focus:border-[var(--brand)]"
          >
            {targets.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name} · {target.email}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        onClick={startCheckout}
        disabled={isPending}
        className="block w-full rounded-full bg-[var(--brand)] px-6 py-3 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-[var(--amber-600)] hover:shadow-lg disabled:opacity-60"
      >
        {isPending ? "正在创建微信订单..." : TIER_LABEL[tier]}
      </button>
      {payload ? (
        <div className="rounded-2xl border border-[var(--amber-200)] bg-[var(--amber-50)] p-4 text-left">
          {payload.error ? (
            <p className="text-sm font-semibold leading-6 text-[var(--error-500)]">
              {payload.message ?? payload.error}
            </p>
          ) : paid ? (
            <p className="text-sm font-bold leading-6 text-[var(--up-700)]">
              ✅ {completeMessage ?? "支付成功，订阅权益已开通。"}
            </p>
          ) : (
            <>
              <p className="text-sm font-bold text-[var(--ink-900)]">
                {payload.mock ? "课堂演示订单已创建" : "微信支付订单已创建"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                订单号：{payload.outTradeNo}。
                {payload.mock
                  ? "当前未配置真实微信商户，支付不会真实扣款。"
                  : "请用微信扫描下方二维码完成支付，支付成功后本页会自动确认。"}
              </p>
              {qrDataUrl ? (
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- client-generated data URL QR */}
                  <img
                    src={qrDataUrl}
                    alt="微信支付二维码"
                    width={208}
                    height={208}
                    className="rounded-xl border border-[var(--ink-200)] bg-white p-2"
                  />
                </div>
              ) : null}
              {payload.codeUrl ? (
                <textarea
                  readOnly
                  value={payload.codeUrl}
                  className="mt-3 min-h-16 w-full rounded-xl border border-[var(--ink-200)] bg-white p-3 text-xs text-[var(--ink-700)]"
                />
              ) : null}
              {payload.mock ? (
                <button
                  type="button"
                  onClick={completeMockOrder}
                  disabled={isCompleting}
                  className="mt-3 rounded-full bg-[var(--ink-900)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--ink-700)] disabled:opacity-60"
                >
                  {isCompleting ? "正在模拟开通..." : "模拟支付成功并开通"}
                </button>
              ) : null}
              {completeMessage ? (
                <p className="mt-2 text-xs font-semibold text-[var(--ink-700)]">{completeMessage}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
