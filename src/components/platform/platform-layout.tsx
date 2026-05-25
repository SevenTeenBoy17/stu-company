"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

const navMap: Record<Role, Array<{ href: string; label: string }>> = {
  student: [
    { href: "/student", label: "策略总览" },
    { href: "/student/market", label: "市场信息" },
    { href: "/student/history", label: "历史复盘" },
    { href: "/learn", label: "课程模块" },
    { href: "/demo", label: "重新登录" },
  ],
  teacher: [
    { href: "/teacher", label: "班级指挥台" },
    { href: "/learn", label: "课程模块" },
    { href: "/demo", label: "管理登录" },
  ],
  parent: [
    { href: "/parent", label: "成长报告" },
    { href: "/learn", label: "课程模块" },
    { href: "/demo", label: "账号登录" },
  ],
  admin: [
    { href: "/admin", label: "运营总览" },
    { href: "/learn", label: "课程模块" },
    { href: "/demo", label: "切换账号" },
  ],
};

export function PlatformLayout({
  role,
  heading,
  summary,
  children,
}: {
  role: Role;
  heading: string;
  summary: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeHref =
    navMap[role]
      .map((item) => item.href)
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((left, right) => right.length - left.length)[0] ?? navMap[role][0]?.href;

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,rgba(240,138,56,0.12),transparent_22%),linear-gradient(180deg,#f4f6fb_0%,#eef2f8_100%)]">
      <div className="mx-auto max-w-[1440px] px-4 py-4 md:px-5 md:py-5 lg:px-8 lg:py-6">
        <div className="xl:hidden">
          <div className="rounded-[2rem] border border-slate-900/8 bg-[#0b1020] px-5 py-5 text-white shadow-[0_28px_70px_rgba(11,16,32,0.35)] sm:px-6">
            <p className="text-xs uppercase tracking-[0.28em] text-[#f08a38]">Brown Zone</p>
            <h2 className="mt-3 text-[2.1rem] font-semibold sm:text-[2.2rem]">{heading}</h2>
            <p className="mt-3 text-[15px] leading-8 text-white/60 sm:text-base">{summary}</p>
          </div>

          <div className="mt-4 rounded-[1.8rem] border border-slate-200/70 bg-white/88 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
              {navMap[role].map((item, index) => {
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-3.5 text-[15px] font-semibold transition-colors",
                      active
                        ? "border-[#f08a38]/30 bg-[#fff4e9] text-slate-950"
                        : "border-transparent bg-slate-950/[0.04] text-slate-600",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn("ml-2 text-xs", active ? "text-[#b96621]" : "text-slate-400")}>
                      0{index + 1}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden rounded-[2rem] border border-slate-900/8 bg-[#0b1020] p-6 text-white shadow-[0_28px_70px_rgba(11,16,32,0.35)] xl:block">
            <p className="text-xs uppercase tracking-[0.28em] text-[#f08a38]">Brown Zone</p>
            <h2 className="mt-3 text-[2.1rem] font-semibold">{heading}</h2>
            <p className="mt-3 text-[15px] leading-8 text-white/60">{summary}</p>
            <div className="mt-8 space-y-2">
              {navMap[role].map((item, index) => {
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-3.5 text-[15px] font-semibold transition-colors hover:bg-white/8",
                      active ? "bg-white/10" : "bg-white/[0.04]",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn("text-white/35", active && "text-[#ffb36d]")}>
                      0{index + 1}
                    </span>
                  </Link>
                );
              })}
            </div>
          </aside>

          <main className="min-w-0 space-y-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
