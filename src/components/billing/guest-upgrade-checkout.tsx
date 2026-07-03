"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CheckoutState = "idle" | "upgrading" | "done" | "error";

type GuestUpgradePayload = {
  parentLinkUrl?: string;
  message?: string;
  error?: string;
};

export function GuestUpgradeCheckout() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CheckoutState>("idle");
  const [message, setMessage] = useState("");
  const [parentLink, setParentLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const busy = state === "upgrading";

  async function submitUpgrade() {
    setState("upgrading");
    setMessage("");
    setParentLink("");
    setCopied(false);

    try {
      const upgradeResponse = await fetch("/api/auth/guest-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const upgradePayload = (await upgradeResponse.json()) as GuestUpgradePayload;
      if (!upgradeResponse.ok || !upgradePayload.parentLinkUrl) {
        throw new Error(upgradePayload.message ?? "游客升级失败，请检查邮箱和密码。");
      }

      const absoluteLink = new URL(upgradePayload.parentLinkUrl, window.location.origin).toString();
      setParentLink(absoluteLink);
      setState("done");
      setMessage("个人账号已创建。请把确认链接交给家长或老师，由成年人完成开通。");
      router.refresh();
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后重试。");
    }
  }

  async function copyParentLink() {
    if (!parentLink) return;
    try {
      await navigator.clipboard.writeText(parentLink);
      setCopied(true);
    } catch {
      setCopied(false);
      setMessage("浏览器暂不支持自动复制，请手动选中链接复制。");
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
          <h2 className="mt-2 text-2xl font-bold text-slate-950">游客先绑定个人账号，再请家长确认开通</h2>
          <p className="mt-2 text-base leading-7 text-slate-600">
            当前游客体验使用共享账号。绑定邮箱后，系统会生成一条家长确认链接；完整 AI 评定由家长或老师确认后开通，权益只属于你的个人账号。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-12 rounded-full bg-slate-950 px-6 text-base font-bold text-white shadow-[0_16px_35px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
        >
          {open ? "收起绑定表单" : "绑定账号并生成确认链接"}
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
              {state === "upgrading" ? "正在创建个人账号..." : "创建个人账号并生成确认链接"}
            </button>
            {message ? (
              <p className={`text-sm font-semibold ${state === "error" ? "text-red-600" : "text-slate-600"}`}>
                {message}
              </p>
            ) : null}
          </div>

          {parentLink ? (
            <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 sm:col-span-3">
              <p className="text-sm font-black text-slate-950">家长确认链接已生成</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                把这条链接发给家长或老师。对方登录后会看到开通对象与金额，再完成微信人工核验或演示订单。
              </p>
              <div className="mt-3 flex flex-col gap-2 rounded-2xl bg-white p-3 sm:flex-row sm:items-center">
                <input
                  readOnly
                  value={parentLink}
                  onFocus={(event) => event.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none"
                />
                <button
                  type="button"
                  onClick={copyParentLink}
                  className="rounded-full bg-slate-950 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  {copied ? "已复制" : "复制给家长"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
