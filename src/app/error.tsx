"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">Recovery</p>
          <h1 className="mt-3 text-3xl font-bold">页面加载出错了</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            系统已拦截异常，没有显示英文白屏。可以先重试；如果仍然失败，请返回首页或联系管理员检查服务状态。
          </p>
          {error?.digest ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
              诊断编号：{error.digest}。如果多次重试仍失败，请把这个编号交给管理员。
            </p>
          ) : (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-500">
              诊断提示：请检查数据库、登录状态或本地服务是否正在运行。
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={reset}
              className="h-12 rounded-full bg-slate-950 px-6 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
            >
              重试
            </button>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50"
            >
              返回首页
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
