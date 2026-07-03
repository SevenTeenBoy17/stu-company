"use client";

import Link from "next/link";
import { useEffect } from "react";

// 部署更新后，旧标签页的 HTML 仍引用已被替换的 chunk 文件 → 懒加载子路由时报
// "Failed to load chunk"。这类错误用 reset() 无效（会再次拉同一个已消失的 chunk），
// 必须整页刷新拉取新资源。这里识别 chunk 错误并自动刷新一次（带时间戳护栏防重载循环）。
function isChunkLoadError(error?: Error & { name?: string }) {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("chunkloaderror") ||
    text.includes("loading chunk") ||
    text.includes("failed to load chunk") ||
    text.includes("dynamically imported module") ||
    text.includes("importing a module script failed")
  );
}

const RELOAD_GUARD_KEY = "bz-chunk-reloaded-at";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError || typeof window === "undefined") return;
    // 10s 内只自动刷新一次，避免真正坏掉时无限重载。
    const last = Number(window.sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    if (Date.now() - last > 10_000) {
      window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
      window.location.reload();
    }
  }, [chunkError]);

  const handleRetry = () => {
    if (chunkError && typeof window !== "undefined") {
      window.location.reload();
      return;
    }
    reset();
  };

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">
            Sandbox Recovery
          </p>
          <h1 className="mt-3 text-3xl font-bold">
            {chunkError ? "应用已更新，正在刷新…" : "沙盘加载失败"}
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {chunkError
              ? "检测到页面资源已更新（多见于版本发布后仍打开的旧标签页）。系统正在自动刷新拉取最新版本；若没有自动跳转，请点击下方「立即刷新」。"
              : "系统没有显示英文白屏，而是把错误拦在这里。你可以先重试；如果仍然失败，请返回登录页重新进入，或联系管理员检查账号与沙盘进度。"}
          </p>
          {error?.message ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
              诊断信息：{error.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleRetry}
              className="h-12 rounded-full bg-slate-950 px-6 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
            >
              {chunkError ? "立即刷新" : "重试加载"}
            </button>
            <Link
              href="/demo?auth=login"
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50"
            >
              返回登录入口
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
