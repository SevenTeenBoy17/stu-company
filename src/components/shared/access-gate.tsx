import Link from "next/link";

export function AccessGate({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-slate-900/10 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,39,0.08)]">
      <p className="text-sm uppercase tracking-[0.24em] text-[#f08a38]">Demo Access</p>
      <h1 className="mt-4 text-3xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">{description}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/demo"
          className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
        >
          前往试玩入口登录
        </Link>
        <Link
          href="/learn"
          className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
        >
          先看课程模块
        </Link>
      </div>
    </div>
  );
}
