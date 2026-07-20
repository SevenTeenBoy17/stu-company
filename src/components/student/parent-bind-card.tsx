"use client";

import { useState } from "react";

/**
 * LC10h P1 (LC-11): lets a student mint a guardian invite code to hand to a
 * parent. The parent registers with this code and is bound to the student,
 * unlocking family Premium sharing, adult-proxy purchase, and the weekly report.
 */
export function ParentBindCard() {
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/student/parent-invite", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { code?: string; expiresAt?: string; message?: string }
        | null;
      if (!res.ok || !data?.code) {
        setError(data?.message ?? "生成家长绑定邀请码失败，请稍后再试。");
        return;
      }
      setCode(data.code);
      setExpiresAt(data.expiresAt ?? null);
    } catch {
      setError("网络异常，请稍后再试。");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("复制失败，请手动选择邀请码复制。");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-fg-strong">邀请家长绑定</h2>
      <p className="mt-1 text-sm leading-6 text-fg-muted">
        生成一个家长绑定邀请码交给家长。家长注册时填入这个码，即可查看你的成长报告、开通并共享家庭高级版。
      </p>

      {code ? (
        <div className="mt-4 rounded-2xl bg-bg-muted px-4 py-3">
          <p className="text-xs font-semibold text-fg-muted">你的家长绑定邀请码</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <code className="select-all font-mono text-lg font-bold tracking-wide text-fg-strong">{code}</code>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-fg-default transition hover:border-brand/40"
            >
              {copied ? "已复制" : "复制"}
            </button>
          </div>
          {expiresAt ? (
            <p className="mt-2 text-xs text-fg-muted">
              有效期至 {new Date(expiresAt).toLocaleDateString("zh-CN")}，仅可绑定一位家长。
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={generate}
        disabled={pending}
        className="mt-4 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "正在生成…" : code ? "重新生成邀请码" : "生成家长绑定邀请码"}
      </button>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
