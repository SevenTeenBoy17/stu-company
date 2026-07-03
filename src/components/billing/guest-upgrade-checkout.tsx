"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutState = "idle" | "upgrading" | "ordering" | "done" | "error";

interface OrderResult {
  outTradeNo: string;
  codeUrl?: string;
  mock?: boolean;
  paymentMode?: "wechat_native" | "wechat_jsapi" | "wechat_manual" | "mock";
  expiresAt?: string;
}

const MAX_PROOF_IMAGE_BYTES = 800 * 1024;
const ALLOWED_PROOF_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function GuestUpgradeCheckout() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CheckoutState>("idle");
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [proofNote, setProofNote] = useState("");
  const [proofImageDataUrl, setProofImageDataUrl] = useState("");
  const [proofMessage, setProofMessage] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const busy = state === "upgrading" || state === "ordering";

  async function submitUpgrade() {
    setState("upgrading");
    setMessage("");
    setOrder(null);

    try {
      const upgradeResponse = await fetch("/api/auth/guest-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const upgradePayload = await upgradeResponse.json();
      if (!upgradeResponse.ok) {
        throw new Error(upgradePayload.message ?? "游客升级失败，请检查邮箱和密码。");
      }

      setState("ordering");
      const prepayResponse = await fetch("/api/billing/prepay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: "standard",
          channel: "manual",
          billingIntentToken: upgradePayload.billingIntentToken,
        }),
      });
      const prepayPayload = await prepayResponse.json();
      if (!prepayResponse.ok) {
        throw new Error(prepayPayload.message ?? "账号已升级，但支付订单创建失败。");
      }

      setOrder(prepayPayload);
      setProofNote("");
      setProofImageDataUrl("");
      setProofMessage("");
      setState("done");
      setMessage(
        prepayPayload.mock
          ? "个人账号已创建。当前为课堂演示支付模式，可继续体验完整付费流程。"
          : "个人账号已创建，请使用微信完成 15 元/月月卡支付。",
      );
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    }
  }

  function handleProofImage(file?: File) {
    if (!file) return;
    if (!ALLOWED_PROOF_IMAGE_TYPES.has(file.type)) {
      setProofMessage("请上传 PNG、JPG 或 WebP 格式的付款截图。");
      return;
    }
    if (file.size > MAX_PROOF_IMAGE_BYTES) {
      setProofMessage("付款截图不能超过 800KB，请压缩后再上传。");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setProofMessage("付款截图读取失败，请换一张图片再试。");
        return;
      }
      setProofImageDataUrl(reader.result);
      setProofMessage("付款截图已读取，提交后管理员可在后台查看。");
    };
    reader.onerror = () => setProofMessage("付款截图读取失败，请换一张图片再试。");
    reader.readAsDataURL(file);
  }

  async function submitProof() {
    if (!order?.outTradeNo || submittingProof) return;
    setProofMessage("");
    setSubmittingProof(true);
    try {
      const response = await fetch("/api/billing/manual-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outTradeNo: order.outTradeNo,
          note: proofNote,
          proofImageDataUrl,
        }),
      });
      const payload = await response.json();
      setProofMessage(
        response.ok
          ? payload.message ?? "付款凭证已提交，等待管理员核验。"
          : payload.message ?? "提交付款凭证失败，请稍后重试。",
      );
    } catch {
      setProofMessage("网络异常，提交付款凭证失败，请稍后重试。");
    } finally {
      setSubmittingProof(false);
    }
  }

  return (
    <section
      id="guest-upgrade-checkout"
      className="mb-6 scroll-mt-24 overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-slate-50 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">Guest Upgrade</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">游客可立即开通完整 AI 评定</h2>
          <p className="mt-2 text-base leading-7 text-slate-600">
            当前游客体验使用共享账号。开通前先绑定个人邮箱，付款后的月卡权益只属于你，不会影响其他游客。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-12 rounded-full bg-slate-950 px-6 text-base font-bold text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
        >
          {open ? "收起开通表单" : "升级并开通月卡"}
        </button>
      </div>

      {open ? (
        <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-white/80 p-4 ring-1 ring-slate-200 sm:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            昵称
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="例如 小布朗"
              disabled={busy}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            邮箱
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="you@example.com"
              disabled={busy}
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            密码
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              placeholder="至少 8 位，含字母和数字"
              disabled={busy}
            />
          </label>

          <div className="flex flex-col gap-3 sm:col-span-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={submitUpgrade}
              disabled={busy}
              className="h-12 rounded-full bg-amber-500 px-6 text-base font-bold text-slate-950 shadow-[0_16px_35px_rgba(245,158,11,0.25)] transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "upgrading"
                ? "正在创建个人账号..."
                : state === "ordering"
                  ? "正在生成支付订单..."
                  : "创建个人账号并生成订单"}
            </button>
            {message ? (
              <p className={`text-sm font-semibold ${state === "error" ? "text-red-600" : "text-slate-600"}`}>
                {message}
              </p>
            ) : null}
          </div>

          {order ? (
            <div className="rounded-[1.25rem] bg-slate-950 p-4 text-white sm:col-span-3">
              <p className="text-sm font-semibold text-amber-300">订单号：{order.outTradeNo}</p>
              <p className="mt-2 break-all text-sm text-slate-300">
                {order.paymentMode === "wechat_manual"
                  ? order.codeUrl
                    ? `请使用页面中的微信收款码付款，或打开收款码图片：${order.codeUrl}`
                    : "当前未配置线上收款码图片，请使用线下微信收款码付款，并备注订单号。"
                  : order.mock
                    ? `演示支付链接：${order.codeUrl}`
                    : `微信扫码链接：${order.codeUrl ?? "请在微信内完成 JSAPI 支付"}`}
              </p>
              {order.expiresAt ? <p className="mt-2 text-xs text-slate-500">订单有效期至：{order.expiresAt}</p> : null}
              {order.paymentMode === "wechat_manual" ? (
                <div className="mt-4 rounded-2xl bg-white/10 p-3">
                  <label className="block text-xs font-bold text-slate-200">
                    付款备注 / 微信转账单号
                    <textarea
                      value={proofNote}
                      onChange={(event) => setProofNote(event.target.value)}
                      placeholder="付款后填写微信转账单号、付款昵称或备注"
                      className="mt-2 min-h-20 w-full rounded-xl border border-white/15 bg-white p-3 text-sm text-slate-950 outline-none"
                    />
                  </label>

                  <div className="mt-3 rounded-2xl bg-white/10 p-3">
                    <label className="block text-xs font-bold text-slate-200">
                      付款截图（可选）
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => handleProofImage(event.target.files?.[0])}
                        className="sr-only"
                      />
                      <span className="mt-2 inline-flex cursor-pointer rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 transition hover:bg-amber-300">
                        上传付款截图
                      </span>
                      <span className="ml-2 text-slate-400">
                        {proofImageDataUrl ? "已选择截图" : "PNG/JPG/WebP，最大 800KB"}
                      </span>
                    </label>
                    {proofImageDataUrl ? (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element -- user-selected payment proof preview */}
                        <img
                          src={proofImageDataUrl}
                          alt="付款截图预览"
                          className="max-h-56 w-full rounded-xl border border-white/20 bg-white object-contain p-2"
                        />
                        <button
                          type="button"
                          onClick={() => setProofImageDataUrl("")}
                          className="mt-2 text-xs font-bold text-slate-300 underline-offset-4 hover:text-white hover:underline"
                        >
                          移除截图
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={submitProof}
                    disabled={submittingProof || proofNote.trim().length < 2}
                    className="mt-3 rounded-full bg-amber-400 px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                  >
                    {submittingProof ? "正在提交..." : "我已付款，提交核验"}
                  </button>
                  {proofMessage ? <p className="mt-2 text-xs font-semibold text-amber-200">{proofMessage}</p> : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
