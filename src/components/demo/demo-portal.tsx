"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type Credentials = { label: string; email: string; password: string; trial?: boolean };
type InviteHint = { role: string; code: string; note: string };

export function DemoPortal({
  credentials,
  inviteHints,
}: {
  credentials: Credentials[];
  inviteHints: InviteHint[];
}) {
  const router = useRouter();
  const [loginForm, setLoginForm] = useState({ email: credentials[0]?.email ?? "", password: credentials[0]?.password ?? "" });
  const [inviteForm, setInviteForm] = useState({
    name: "体验用户",
    email: "newuser@brownzone.ai",
    password: "BrownZone2026!",
    inviteCode: inviteHints[0]?.code ?? "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitLogin(nextLogin = loginForm) {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextLogin),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "登录失败。");
      }

      setMessage("登录成功，正在跳转到对应角色页面。");
      startTransition(() => {
        router.push(payload.redirectTo ?? "/demo");
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败。");
    } finally {
      setBusy(false);
    }
  }

  async function submitCredential(item: Credentials) {
    if (item.trial) {
      const key = "brown-zone-guest-trial-count";
      const nextCount = Number(window.localStorage.getItem(key) ?? "0") + 1;
      if (nextCount > 3) {
        setMessage("游客试玩次数已达上限。请使用邀请码注册，或登录学生/教师/家长账号继续体验完整沙盘。");
        return;
      }
      window.localStorage.setItem(key, String(nextCount));
    }

    const nextLogin = { email: item.email, password: item.password };
    setLoginForm(nextLogin);
    await submitLogin(nextLogin);
  }

  async function submitInvite() {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register-by-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const payload = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "注册失败。");
      }

      setMessage("邀请码注册完成，正在进入对应角色界面。");
      startTransition(() => {
        router.push(payload.redirectTo ?? "/demo");
        router.refresh();
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "注册失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="panel rounded-3xl p-6">
        <p className="bz-eyebrow">样例登录</p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-950">一键进入不同角色视角</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {credentials.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => void submitCredential(item)}
              className="bz-muted-tile min-h-[88px] border border-slate-200 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-border-brand hover:bg-brand-subtle"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-2 truncate text-sm text-slate-600">{item.email}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
                  {item.trial ? "限 3 次" : "一键进入"}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">账号 / 邮箱</span>
            <input
              name="email"
              autoComplete="username"
              value={loginForm.email}
              onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
              className="bz-field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">密码</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={loginForm.password}
              onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
              className="bz-field"
            />
          </label>
          <button
            type="button"
            onClick={() => void submitLogin()}
            disabled={busy}
            className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "处理中..." : "登录并进入面板"}
          </button>
        </div>
      </section>

      <section className="panel rounded-3xl p-6">
        <p className="bz-eyebrow">邀请码注册</p>
        <h2 className="mt-4 text-3xl font-semibold text-slate-950">模拟真实试点开通流程</h2>
        <div className="mt-6 grid gap-3">
          {inviteHints.map((item) => (
            <div key={item.code} className="bz-muted-tile border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-slate-950">{item.role}</p>
                <span className="bz-brand-chip rounded-full px-3 py-1 text-xs font-semibold">
                  {item.code}
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.note}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">姓名</span>
            <input
              value={inviteForm.name}
              onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
              className="bz-field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">邮箱</span>
            <input
              value={inviteForm.email}
              onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
              className="bz-field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">密码</span>
            <input
              type="password"
              value={inviteForm.password}
              onChange={(event) => setInviteForm((current) => ({ ...current, password: event.target.value }))}
              className="bz-field"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-600">邀请码</span>
            <input
              value={inviteForm.inviteCode}
              onChange={(event) => setInviteForm((current) => ({ ...current, inviteCode: event.target.value }))}
              className="bz-field"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={submitInvite}
          disabled={busy}
          className="bz-primary-action mt-6 px-6 py-3 text-sm disabled:opacity-60"
        >
          {busy ? "处理中..." : "邀请码注册并进入"}
        </button>
      </section>

      {message ? (
        <div className="bz-brand-note rounded-2xl px-5 py-4 text-sm font-medium lg:col-span-2">
          {message}
        </div>
      ) : null}
    </div>
  );
}
