"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
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

const roleAssets: Record<Role, { src: string; label: string }> = {
  student: { src: "/brand/role-student.svg", label: "学生端头像" },
  teacher: { src: "/brand/role-teacher.svg", label: "教师端头像" },
  parent: { src: "/brand/role-parent.svg", label: "家长端头像" },
  admin: { src: "/brand/role-admin.svg", label: "管理端头像" },
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
  const roleAsset = roleAssets[role];

  return (
    <div className="bz-page-bg min-h-screen overflow-x-clip">
      <div className="mx-auto max-w-screen-2xl px-4 py-4 md:px-5 md:py-5 lg:px-8 lg:py-6">
        <div className="xl:hidden">
          <div className="bz-ink-panel rounded-3xl px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <Image src={roleAsset.src} alt={roleAsset.label} width={64} height={64} className="h-16 w-16 shrink-0 rounded-2xl shadow-glow" />
              <div className="min-w-0">
                <p className="bz-eyebrow-inverse">Brown Zone</p>
                <h2 className="mt-3 text-h1 font-semibold sm:text-display-lg">{heading}</h2>
                <p className="mt-3 text-body leading-8 text-white/60 sm:text-body-lg">{summary}</p>
              </div>
            </div>
          </div>

          <div className="bz-surface-panel mt-4 rounded-3xl p-3">
            <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
              {navMap[role].map((item, index) => {
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-3.5 text-body font-semibold transition-colors",
                      active
                        ? "border-border-brand bg-brand-soft text-slate-950"
                        : "border-transparent bg-slate-950/[0.04] text-slate-600",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn("ml-2 text-xs", active ? "text-brand-ink" : "text-slate-400")}>
                      0{index + 1}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="bz-ink-panel hidden rounded-3xl p-6 xl:block">
            <Image src={roleAsset.src} alt={roleAsset.label} width={80} height={80} className="h-20 w-20 rounded-3xl shadow-glow" />
            <p className="bz-eyebrow-inverse mt-5">Brown Zone</p>
            <h2 className="mt-3 text-h1 font-semibold">{heading}</h2>
            <p className="mt-3 text-body leading-8 text-white/60">{summary}</p>
            <div className="mt-8 space-y-2">
              {navMap[role].map((item, index) => {
                const active = item.href === activeHref;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between rounded-2xl px-4 py-3.5 text-body font-semibold transition-colors hover:bg-white/8",
                      active ? "bg-white/10" : "bg-white/[0.04]",
                    )}
                  >
                    <span>{item.label}</span>
                    <span className={cn("text-white/35", active && "text-brand-warm")}>
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
