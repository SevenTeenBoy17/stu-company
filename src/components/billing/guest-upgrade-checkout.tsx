"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutState = "idle" | "upgrading" | "ordering" | "done" | "error";

interface OrderResult {
  outTradeNo: string;
  codeUrl?: string;
  mock?: boolean;
  expiresAt?: string;
}

export function GuestUpgradeCheckout() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CheckoutState>("idle");
  const [message, setMessage] = useState("");
  const [order, setOrder] = useState<OrderResult | null>(null);
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
          channel: "native",
          billingIntentToken: upgradePayload.billingIntentToken,
        }),
      });
      const prepayPayload = await prepayResponse.json();
      if (!prepayResponse.ok) {
        throw new Error(prepayPayload.message ?? "账号已升级，但支付订单创建失败。");
      }

      setOrder(prepayPayload);
      setState("done");
      setMessage(
        prepayPayload.mock
          ? "个人账号已创建。当前为课堂演示支付模式，可继续体验完整付费流程。"
          : "个人账号已创建，请使用微信扫码完成 15 元/月月卡支付。",
      );
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    }
  }

  return (
    <section className="mb-6 overflow-hidden rounded-[2rem] border border-amber-200/70 bg-gradient-to-r from-amber-50 via-white to-slate-50 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.08)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-amber-600">
            Guest Upgrade
          </p>
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

          <div className="sm:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center">
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
              <p
                className={`text-sm font-semibold ${
                  state === "error" ? "text-red-600" : "text-slate-600"
                }`}
              >
                {message}
              </p>
            ) : null}
          </div>

          {order ? (
            <div className="sm:col-span-3 rounded-[1.25rem] bg-slate-950 p-4 text-white">
              <p className="text-sm font-semibold text-amber-300">
                订单号：{order.outTradeNo}
              </p>
              <p className="mt-2 break-all text-sm text-slate-300">
                {order.mock
                  ? `演示支付链接：${order.codeUrl}`
                  : `微信扫码链接：${order.codeUrl ?? "请在微信内完成 JSAPI 支付"}`}
              </p>
              {order.expiresAt ? (
                <p className="mt-2 text-xs text-slate-500">订单有效期至：{order.expiresAt}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
