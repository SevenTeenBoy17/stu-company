"use client";

import { useEffect, useState, useTransition } from "react";

type Phase = "form" | "done";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL token once on mount
    if (value) setToken(value);
  }, []);

  function submit() {
    startTransition(async () => {
      setError(null);
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(data.message ?? data.error ?? "重置失败，请重新发起。");
        return;
      }
      setPhase("done");
    });
  }

  return (
    <div className="page-shell flex min-h-[60vh] items-center justify-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-[var(--ink-200)] bg-[var(--surface)] p-7 shadow-sm">
        <h1 className="text-xl font-semibold text-[var(--ink-900)]">重置密码</h1>

        {phase === "done" ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm leading-7 text-[var(--ink-600)]">
              密码已重置成功，旧的登录状态已失效，请用新密码重新登录。
            </p>
            <a
              href="/demo"
              className="inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--amber-600)]"
            >
              去登录
            </a>
          </div>
        ) : (
          token ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-[var(--ink-500)]">
                请设置一个新密码（至少 8 位，含字母和数字）。
              </p>
              <label className="block">
                <span className="text-xs font-semibold text-[var(--ink-500)]">新密码</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="mt-2 w-full rounded-xl border border-[var(--ink-200)] bg-[var(--ink-50)] px-3 py-2.5 text-sm text-[var(--ink-900)] outline-none focus:border-[var(--brand)]"
                  placeholder="设置新密码"
                />
              </label>
              {error ? <p className="text-sm font-medium text-[var(--error-500)]">{error}</p> : null}
              <button
                type="button"
                onClick={submit}
                disabled={isPending || password.length < 8}
                className="w-full rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--amber-600)] disabled:opacity-60"
              >
                {isPending ? "正在重置…" : "确认重置密码"}
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-[var(--ink-500)]">
                这个链接缺少有效的重置令牌，可能已过期。请重新发起找回密码。
              </p>
              <a
                href="/demo"
                className="inline-block rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--amber-600)]"
              >
                去登录页重新发起
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
}
