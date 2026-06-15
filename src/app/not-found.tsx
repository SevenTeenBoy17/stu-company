import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-600">404 · Not Found</p>
          <h1 className="mt-3 text-3xl font-bold">这个页面走丢了</h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            你访问的链接不存在或已调整。可以回到首页，或直接进入试玩沙盘继续体验。
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
            >
              {/* White label on a <span>: the global `a { color: inherit }` reset
                  beats text-white on the anchor itself, but not on a child span. */}
              <span className="text-base font-bold text-white">回到首页</span>
            </Link>
            <Link
              href="/demo"
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 px-6 text-base font-bold text-slate-700 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50"
            >
              去试玩沙盘
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
