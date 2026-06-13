"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";

type ManualPaymentConfig = {
  qrUrl?: string;
  qrConfigured: boolean;
  payeeName: string;
  instruction: string;
};

type CheckoutPayload = {
  orderId: string;
  outTradeNo: string;
  codeUrl?: string;
  expiresAt: string;
  mock?: boolean;
  amountFen?: number;
  description?: string;
  paymentMode?: "wechat_native" | "wechat_jsapi" | "wechat_manual" | "mock";
  manual?: boolean;
  manualPayment?: ManualPaymentConfig;
  message?: string;
  error?: string;
};

type OrderStatusPayload = {
  orderId?: string;
  channel?: "native" | "jsapi" | "mock" | "manual";
  status?: "pending" | "paid" | "closed" | "failed";
  paid?: boolean;
  manualProofSubmitted?: boolean;
  tier?: string;
  amountFen?: number;
  description?: string;
  paidAt?: string;
  expiresAt?: string;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
    subscriptionTier?: string;
    subscriptionExpiresAt?: string;
  } | null;
  receipt?: {
    receiptNo: string;
    orderId: string;
    outTradeNo: string;
    amountLabel: string;
    channelLabel: string;
    paidAt?: string;
    paidAtLabel?: string;
    subscriptionExpiresAt?: string;
    subscriptionExpiresAtLabel?: string;
    targetName: string;
    targetEmail: string;
    description: string;
  } | null;
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

const MAX_PROOF_IMAGE_BYTES = 800 * 1024;
const ALLOWED_PROOF_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const TIER_LABEL: Record<"standard" | "premium", string> = {
  standard: "微信开通 15 元/月",
  premium: "微信开通 30 元/月",
};

function formatAmount(amountFen?: number) {
  if (amountFen == null) return "";
  return `¥${(amountFen / 100).toFixed(2).replace(/\.00$/, "")}`;
}

function formatDateLabel(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function WechatCheckoutButton({
  tier = "standard",
  authed = true,
}: {
  tier?: "standard" | "premium";
  authed?: boolean;
} = {}) {
  const router = useRouter();
  const [payload, setPayload] = useState<CheckoutPayload | null>(null);
  const [targets, setTargets] = useState<BillingTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [statusPayload, setStatusPayload] = useState<OrderStatusPayload | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [proofImageDataUrl, setProofImageDataUrl] = useState("");
  const [proofMessage, setProofMessage] = useState<string | null>(null);
  const [upgradeToken, setUpgradeToken] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isCompleting, startCompleteTransition] = useTransition();
  const [isSubmittingProof, startProofTransition] = useTransition();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("upgrade");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external URL state sync on mount
    if (token) setUpgradeToken(token);
  }, []);

  useEffect(() => {
    if (!authed) return;
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
        // Target discovery is optional for normal self checkout.
      });
    return () => {
      alive = false;
    };
  }, [authed]);

  useEffect(() => {
    let alive = true;
    if (payload?.codeUrl && payload.paymentMode !== "wechat_manual") {
      void QRCode.toDataURL(payload.codeUrl, { width: 208, margin: 1 })
        .then((url) => {
          if (alive) setQrDataUrl(url);
        })
        .catch(() => {
          /* fall back to the copyable link */
        });
    }
    return () => {
      alive = false;
    };
  }, [payload]);

  useEffect(() => {
    if (!payload || payload.error || !payload.outTradeNo || paid) return;
    let active = true;
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await fetch(
          `/api/billing/order-status?outTradeNo=${encodeURIComponent(payload.outTradeNo)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as OrderStatusPayload;
        if (!response.ok) {
          if (active) setStatusMessage(data.message ?? data.error ?? "订单状态查询失败，稍后会自动重试。");
          return;
        }
        if (active) {
          setStatusPayload(data);
          if (payload.paymentMode === "wechat_manual" && data.manualProofSubmitted && !data.paid) {
            setStatusMessage("付款凭证已提交，正在等待管理员核验到账。核验后会自动开通订阅。");
          }
        }
        if (active && data.paid) {
          window.clearInterval(interval);
          setPaid(true);
          setCompleteMessage("支付成功，订阅权益已开通。");
          setStatusMessage(null);
          router.refresh();
        } else if (active && (data.status === "closed" || data.status === "failed")) {
          window.clearInterval(interval);
          setStatusMessage("这笔订单未完成支付，请重新创建订单。");
        } else if (active && attempts >= 120) {
          window.clearInterval(interval);
          setStatusMessage(
            payload.paymentMode === "wechat_manual"
              ? "正在等待管理员核验到账。若已付款，请确认已提交付款备注或联系管理员核对订单号。"
              : "暂未收到微信支付确认。若已付款，请稍后刷新或联系管理员核对订单号。",
          );
        }
      } catch {
        if (active) setStatusMessage("网络波动，正在继续查询支付结果。");
      }
    }, payload.mock ? 2500 : payload.paymentMode === "wechat_manual" ? 5000 : 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [payload, paid, router]);

  function startCheckout() {
    startTransition(async () => {
      setPayload(null);
      setCompleteMessage(null);
      setStatusPayload(null);
      setStatusMessage(null);
      setQrDataUrl(null);
      setProofNote("");
      setProofImageDataUrl("");
      setProofMessage(null);
      setPaid(false);
      const response = await fetch("/api/billing/prepay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tier,
          channel: "manual",
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
      void fetch(`/api/billing/order-status?outTradeNo=${encodeURIComponent(payload.outTradeNo)}`, {
        cache: "no-store",
      })
        .then(async (statusResponse) =>
          statusResponse.ok ? ((await statusResponse.json()) as OrderStatusPayload) : null,
        )
        .then((status) => {
          if (status) setStatusPayload(status);
        })
        .catch(() => {
          /* successful fulfillment response is enough */
        });
      router.refresh();
    });
  }

  function handleProofImage(file?: File) {
    if (!file) return;
    if (!ALLOWED_PROOF_IMAGE_TYPES.has(file.type)) {
      setProofMessage("请上传 PNG、JPG 或 WebP 格式的付款截图。");
      return;
    }
    if (file.size > MAX_PROOF_IMAGE_BYTES) {
      setProofMessage("付款截图太大，请压缩到 800KB 以内后再上传。");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setProofMessage("付款截图读取失败，请换一张图片再试。");
        return;
      }
      setProofImageDataUrl(reader.result);
      setProofMessage("付款截图已读取，提交凭证后管理员可在后台查看。");
    };
    reader.onerror = () => setProofMessage("付款截图读取失败，请换一张图片再试。");
    reader.readAsDataURL(file);
  }

  function submitManualProof() {
    if (!payload?.outTradeNo) return;
    startProofTransition(async () => {
      setProofMessage(null);
      const response = await fetch("/api/billing/manual-proof", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          outTradeNo: payload.outTradeNo,
          note: proofNote,
          proofImageDataUrl,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setProofMessage(data.message ?? data.error ?? "提交付款凭证失败，请稍后重试。");
        return;
      }
      setProofMessage(data.message ?? "付款凭证已提交，等待管理员核验。");
      setStatusMessage("付款凭证已提交，正在等待管理员核验到账。");
    });
  }

  const amountLabel = formatAmount(payload?.amountFen);
  const targetName = statusPayload?.targetUser?.name ?? targets.find((target) => target.id === selectedTargetId)?.name;
  const manualConfig = payload?.manualPayment;
  const receipt = statusPayload?.receipt;
  const receiptTargetEmail = receipt?.targetEmail ?? statusPayload?.targetUser?.email ?? "";
  const receiptExpiresAtLabel =
    receipt?.subscriptionExpiresAtLabel ??
    formatDateLabel(statusPayload?.targetUser?.subscriptionExpiresAt) ??
    "";

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
            <div className="rounded-2xl border border-[var(--up-300)] bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-[var(--ink-900)]">订阅已开通</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[var(--up-700)]">
                    ✓ {completeMessage ?? "支付成功，订阅权益已开通。"}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--up-50)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--up-700)]">
                  Paid
                </span>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-[var(--ink-500)] sm:grid-cols-2">
                <div className="rounded-xl bg-[var(--ink-50)] p-3">
                  <span className="block">回执号</span>
                  <strong className="mt-1 block break-all text-sm text-[var(--ink-900)]">
                    {receipt?.receiptNo ?? `BZ-${payload.outTradeNo}`}
                  </strong>
                </div>
                <div className="rounded-xl bg-[var(--ink-50)] p-3">
                  <span className="block">支付金额</span>
                  <strong className="mt-1 block text-sm text-[var(--brand)]">
                    {receipt?.amountLabel || amountLabel || "已支付"}
                  </strong>
                </div>
                <div className="rounded-xl bg-[var(--ink-50)] p-3">
                  <span className="block">开通账号</span>
                  <strong className="mt-1 block text-sm text-[var(--ink-900)]">
                    {receipt?.targetName ?? targetName ?? "当前账号"}
                  </strong>
                  {receiptTargetEmail ? (
                    <span className="mt-1 block break-all text-[11px]">{receiptTargetEmail}</span>
                  ) : null}
                </div>
                <div className="rounded-xl bg-[var(--ink-50)] p-3">
                  <span className="block">支付方式</span>
                  <strong className="mt-1 block text-sm text-[var(--ink-900)]">
                    {receipt?.channelLabel ??
                      (payload.paymentMode === "wechat_manual" ? "微信收款码人工核验" : "微信支付")}
                  </strong>
                </div>
                {(receipt?.paidAtLabel ?? formatDateLabel(statusPayload?.paidAt)) ? (
                  <div className="rounded-xl bg-[var(--ink-50)] p-3">
                    <span className="block">支付时间</span>
                    <strong className="mt-1 block text-sm text-[var(--ink-900)]">
                      {receipt?.paidAtLabel ?? formatDateLabel(statusPayload?.paidAt)}
                    </strong>
                  </div>
                ) : null}
                {receiptExpiresAtLabel ? (
                  <div className="rounded-xl bg-[var(--ink-50)] p-3">
                    <span className="block">有效期至</span>
                    <strong className="mt-1 block text-sm text-[var(--ink-900)]">{receiptExpiresAtLabel}</strong>
                  </div>
                ) : null}
              </div>
              <Link
                href="/student"
                className="mt-4 inline-flex rounded-full bg-[var(--brand)] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[var(--amber-600)]"
              >
                进入学生策略台
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold text-[var(--ink-900)]">
                {payload.paymentMode === "wechat_manual"
                  ? "微信人工收款订单已生成"
                  : payload.mock
                    ? "课堂演示收款码已生成"
                    : "微信支付收款码已生成"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                订单号：{payload.outTradeNo}。{" "}
                {payload.mock
                  ? "当前为课堂演示模式，不会真实扣款；点击下方按钮可模拟微信回调并开通权益。"
                  : payload.paymentMode === "wechat_manual"
                    ? manualConfig?.instruction ?? payload.message
                    : "请用微信扫描下方二维码完成支付，支付成功后本页会自动确认并刷新订阅状态。"}
              </p>

              {amountLabel || targetName ? (
                <div className="mt-3 grid gap-2 rounded-2xl bg-white/70 p-3 text-xs text-[var(--ink-600)] sm:grid-cols-2">
                  {amountLabel ? (
                    <div>
                      <span className="block text-[var(--ink-400)]">支付金额</span>
                      <strong className="text-base text-[var(--brand)]">{amountLabel}</strong>
                    </div>
                  ) : null}
                  {targetName ? (
                    <div>
                      <span className="block text-[var(--ink-400)]">开通账号</span>
                      <strong className="text-[var(--ink-900)]">{targetName}</strong>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {payload.paymentMode === "wechat_manual" && payload.codeUrl ? (
                <div className="mt-3 flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- administrator-provided WeChat collection QR image */}
                  <img
                    src={payload.codeUrl}
                    alt="微信收款码"
                    width={208}
                    height={208}
                    className="rounded-xl border border-[var(--ink-200)] bg-white p-2"
                  />
                  <p className="text-xs font-semibold text-[var(--ink-500)]">
                    收款方：{manualConfig?.payeeName ?? "Brown Zone"}
                  </p>
                </div>
              ) : qrDataUrl ? (
                <div className="mt-3 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element -- client-generated data URL QR */}
                  <img
                    src={qrDataUrl}
                    alt={payload.mock ? "课堂演示收款码" : "微信支付收款码"}
                    width={208}
                    height={208}
                    className="rounded-xl border border-[var(--ink-200)] bg-white p-2"
                  />
                </div>
              ) : null}

              {payload.paymentMode === "wechat_manual" && !payload.codeUrl ? (
                <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold leading-5 text-[var(--ink-600)]">
                  当前未配置线上收款码图片。请复制订单号，使用线下微信收款码付款后，在下方提交转账单号或付款备注。
                </p>
              ) : null}

              {payload.codeUrl && payload.paymentMode !== "wechat_manual" ? (
                <textarea
                  readOnly
                  value={payload.codeUrl}
                  className="mt-3 min-h-16 w-full rounded-xl border border-[var(--ink-200)] bg-white p-3 text-xs text-[var(--ink-700)]"
                />
              ) : null}

              {payload.paymentMode === "wechat_manual" ? (
                <div className="mt-3 rounded-2xl border border-[var(--amber-200)] bg-white/80 p-3">
                  <label className="block text-xs font-bold text-[var(--ink-600)]">
                    付款备注 / 微信转账单号
                    <textarea
                      value={proofNote}
                      onChange={(event) => setProofNote(event.target.value)}
                      placeholder="例如：微信转账单号 4200...，付款昵称，或已在微信备注订单号"
                      className="mt-2 min-h-20 w-full rounded-xl border border-[var(--ink-200)] bg-white p-3 text-sm text-[var(--ink-800)] outline-none focus:border-[var(--brand)]"
                    />
                  </label>
                  <div className="mt-3 rounded-2xl border border-[var(--ink-200)] bg-white/80 p-3">
                    <label className="block text-xs font-bold text-[var(--ink-600)]">
                      付款截图（可选）
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => handleProofImage(event.target.files?.[0])}
                        className="sr-only"
                      />
                      <span className="mt-2 inline-flex cursor-pointer rounded-full bg-[var(--amber-100)] px-4 py-2 text-xs font-black text-[var(--amber-700)] transition hover:bg-[var(--amber-200)]">
                        上传付款截图
                      </span>
                      <span className="ml-2 text-[var(--ink-400)]">
                        {proofImageDataUrl ? "已选择截图" : "PNG/JPG/WebP，最大 800KB"}
                      </span>
                    </label>
                    {proofImageDataUrl ? (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- user-selected payment proof preview */}
                        <img
                          src={proofImageDataUrl}
                          alt="付款截图预览"
                          className="max-h-56 w-full rounded-xl border border-[var(--ink-200)] bg-white object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={() => setProofImageDataUrl("")}
                          className="mt-2 text-xs font-bold text-[var(--ink-500)] underline-offset-4 hover:text-[var(--ink-900)] hover:underline"
                        >
                          移除截图
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={submitManualProof}
                    disabled={isSubmittingProof || proofNote.trim().length < 2}
                    className="mt-3 rounded-full bg-[var(--ink-900)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--ink-700)] disabled:opacity-60"
                  >
                    {isSubmittingProof ? "正在提交..." : "我已付款，提交核验"}
                  </button>
                  {proofMessage ? (
                    <p className="mt-2 text-xs font-semibold text-[var(--warning-600)]">{proofMessage}</p>
                  ) : null}
                </div>
              ) : !payload.mock ? (
                <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ink-600)]">
                  正在等待微信支付结果返回。请勿关闭本页；如果已完成付款，通常几秒内会自动开通。
                </p>
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
                <div className="mt-3 rounded-xl border border-[var(--up-300)] bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--up-700)]">{completeMessage}</p>
                  {statusPayload?.targetUser?.subscriptionExpiresAt ? (
                    <p className="mt-1 text-xs text-[var(--ink-500)]">
                      到期时间：{new Date(statusPayload.targetUser.subscriptionExpiresAt).toLocaleDateString("zh-CN")}
                    </p>
                  ) : null}
                  <Link
                    href="/student"
                    className="mt-2 inline-flex rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-bold text-white"
                  >
                    进入学生策略台
                  </Link>
                </div>
              ) : null}
              {statusMessage ? (
                <p className="mt-2 text-xs font-semibold text-[var(--warning-600)]">{statusMessage}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
