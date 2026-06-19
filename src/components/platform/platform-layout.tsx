"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  group?: "primary" | "assets" | "life" | "learning" | "account";
  summary?: string;
};

const navMap: Record<Role, NavItem[]> = {
  student: [
    { href: "/student", label: "首页服务台", group: "primary", summary: "今日任务与沙盘总览" },
    { href: "/student/market", label: "市场雷达", group: "primary", summary: "观察市场温度" },
    { href: "/student/opportunity", label: "机会训练", group: "primary", summary: "写观察单而非冲动交易" },
    { href: "/student/wealth", label: "我的财富", group: "primary", summary: "持有、目标与配置" },
    { href: "/student/fund-lab", label: "基金实验", group: "assets" },
    { href: "/student/auto-invest", label: "定投机器人", group: "assets" },
    { href: "/student/risk-profile", label: "风险测评", group: "learning" },
    { href: "/student/life", label: "生活账本", group: "life" },
    { href: "/student/goal-accounts", label: "目标账户", group: "life" },
    { href: "/student/protection", label: "保护伞", group: "life" },
    { href: "/student/credit", label: "信用实验室", group: "life" },
    { href: "/student/quests", label: "任务中心", group: "learning" },
    { href: "/student/history", label: "历史复盘", group: "learning" },
    { href: "/student/rank", label: "战力榜", group: "learning" },
    { href: "/learn", label: "课程模块", group: "learning" },
    { href: "/demo", label: "重新登录", group: "account" },
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

const studentNavGroups: Array<{ key: NonNullable<NavItem["group"]>; label: string; summary: string }> = [
  { key: "assets", label: "资产成长", summary: "基金、定投和风险画像" },
  { key: "life", label: "生活理财", summary: "预算、目标、信用和保护伞" },
  { key: "learning", label: "学习留存", summary: "任务、复盘、课程与排行榜" },
  { key: "account", label: "账号", summary: "切换身份或重新登录" },
];

const roleAssets: Record<Role, { src: string; label: string }> = {
  student: { src: "/brand/role-student.svg", label: "学生端头像" },
  teacher: { src: "/brand/role-teacher.svg", label: "教师端头像" },
  parent: { src: "/brand/role-parent.svg", label: "家长端头像" },
  admin: { src: "/brand/role-admin.svg", label: "管理端头像" },
};

function navIndexLabel(index: number) {
  return String(index + 1).padStart(2, "0");
}

function isActiveNav(item: NavItem, activeHref: string) {
  return item.href === activeHref;
}

function CompactNavLink({ item, active, index }: { item: NavItem; active: boolean; index: number }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "shrink-0 rounded-full border px-4 py-3 text-body font-semibold transition-colors",
        active
          ? "border-border-brand bg-brand-soft text-slate-950"
          : "border-transparent bg-slate-950/[0.04] text-slate-600 hover:bg-slate-950/[0.07]",
      )}
    >
      <span>{item.label}</span>
      <span className={cn("ml-2 text-xs", active ? "text-brand-ink" : "text-slate-400")}>
        {navIndexLabel(index)}
      </span>
    </Link>
  );
}

function SidebarNavLink({ item, active, index }: { item: NavItem; active: boolean; index: number }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex min-w-0 items-center justify-between rounded-2xl px-4 py-3.5 text-body font-semibold transition-colors hover:bg-white/12",
        active ? "bg-white/14 text-white" : "bg-white/[0.05] text-white/70",
      )}
    >
      <span className="truncate">{item.label}</span>
      <span className={cn("shrink-0 text-white/60", active && "text-brand-warm")}>{navIndexLabel(index)}</span>
    </Link>
  );
}

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
  const navItems = navMap[role];
  const studentPrimaryItems = role === "student" ? navItems.filter((item) => item.group === "primary") : [];
  const studentSecondaryItems = role === "student" ? navItems.filter((item) => item.group !== "primary") : navItems;

  return (
    <div className="bz-page-bg min-h-screen overflow-x-clip">
      <div className="mx-auto max-w-screen-2xl px-4 py-4 md:px-5 md:py-5 lg:px-8 lg:py-6">
        <div className="xl:hidden">
          <div className="bz-ink-panel rounded-3xl px-5 py-5 sm:px-6">
            <div className="flex items-start gap-4">
              <Image
                src={roleAsset.src}
                alt={roleAsset.label}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-2xl shadow-glow"
              />
              <div className="min-w-0">
                <p className="bz-eyebrow-inverse">Brown Zone</p>
                <p className="mt-3 text-h1 font-semibold sm:text-display-lg">{heading}</p>
                <p className="mt-3 text-body leading-8 text-white/60 sm:text-body-lg">{summary}</p>
              </div>
            </div>
          </div>

          <div className="bz-surface-panel mt-4 rounded-3xl p-3">
            {role === "student" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {studentPrimaryItems.map((item, index) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-2xl border p-3 transition-colors",
                        isActiveNav(item, activeHref)
                          ? "border-border-brand bg-brand-soft text-slate-950"
                          : "border-slate-200 bg-white text-slate-700",
                      )}
                    >
                      <span className="block text-body font-black">{item.label}</span>
                      <span className="mt-1 line-clamp-1 block text-xs font-semibold text-slate-600">
                        {item.summary}
                      </span>
                      <span className="mt-2 block text-xs font-black text-brand-ink">{navIndexLabel(index)}</span>
                    </Link>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {studentSecondaryItems.map((item, index) => (
                    <CompactNavLink
                      key={item.href}
                      item={item}
                      active={isActiveNav(item, activeHref)}
                      index={index + studentPrimaryItems.length}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pb-1">
                {navItems.map((item, index) => (
                  <CompactNavLink
                    key={item.href}
                    item={item}
                    active={isActiveNav(item, activeHref)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="bz-ink-panel hidden rounded-3xl p-6 xl:block">
            <Image
              src={roleAsset.src}
              alt={roleAsset.label}
              width={80}
              height={80}
              className="h-20 w-20 rounded-3xl shadow-glow"
            />
            <p className="bz-eyebrow-inverse mt-5">Brown Zone</p>
            <p className="mt-3 text-h1 font-semibold">{heading}</p>
            <p className="mt-3 text-body leading-8 text-white/60">{summary}</p>

            {role === "student" ? (
              <div className="mt-8 space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-brand-warm">四大主域</p>
                    <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs font-bold text-white/55">
                      学 · 用 · 评
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {studentPrimaryItems.map((item, index) => {
                      const active = isActiveNav(item, activeHref);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "rounded-3xl border px-4 py-4 transition-colors hover:bg-white/12",
                            active
                              ? "border-brand-warm/55 bg-white/14 text-white"
                              : "border-white/8 bg-white/[0.05] text-white/72",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-body-lg font-black">{item.label}</span>
                            <span className={cn("text-sm font-black", active ? "text-brand-warm" : "text-white/70")}>
                              {navIndexLabel(index)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-1 text-sm font-semibold text-white/70">{item.summary}</p>
                        </Link>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {studentNavGroups.map((group) => {
                    const items = navItems.filter((item) => item.group === group.key);
                    if (items.length === 0) return null;
                    return (
                      <div key={group.key}>
                        <div className="mb-2 px-1">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/70">{group.label}</p>
                          <p className="mt-1 text-xs font-semibold text-white/70">{group.summary}</p>
                        </div>
                        <div className="space-y-2">
                          {items.map((item) => {
                            const index = navItems.findIndex((candidate) => candidate.href === item.href);
                            return (
                              <SidebarNavLink
                                key={item.href}
                                item={item}
                                active={isActiveNav(item, activeHref)}
                                index={index}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mt-8 space-y-2">
                {navItems.map((item, index) => (
                  <SidebarNavLink
                    key={item.href}
                    item={item}
                    active={isActiveNav(item, activeHref)}
                    index={index}
                  />
                ))}
              </div>
            )}
          </aside>

          {/* pb-24 keeps the last module clear of the fixed KeyAI FAB (bottom-right). */}
          <main className="min-w-0 space-y-6 pb-24 xl:pr-16 2xl:pr-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
