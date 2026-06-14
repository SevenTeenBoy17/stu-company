"use client";

import {
  Globe,
  LaptopMinimal,
  Menu,
  MoonStar,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Logo } from "@/components/site/logo";
import { siteNavGroups } from "@/lib/content";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { label: "首页", href: "/" },
  { label: "投资课程", href: "/learn" },
  { label: "试玩入口", href: "/demo" },
];

function isLinkActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.dataset.scrollLocked = drawerOpen ? "true" : "false";
    return () => {
      delete document.body.dataset.scrollLocked;
    };
  }, [drawerOpen]);

  const menuButtonClasses = useMemo(
    () =>
      cn(
        "inline-flex min-h-12 min-w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-5 py-3 text-[16px] font-bold leading-none tracking-[0.01em] transition-all 2xl:px-6 2xl:text-[17px]",
        "border-transparent !text-white drop-shadow-sm hover:border-white/20 hover:bg-white/[0.08] hover:!text-white focus-visible:border-white/30 focus-visible:bg-white/[0.1] focus-visible:!text-white",
      ),
    [],
  );

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/8 bg-bg-inverse/95 backdrop-blur-xl"
      onMouseLeave={() => setMenuOpen(false)}
    >
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-3 py-3 sm:px-4 lg:gap-4 lg:px-8 lg:py-4">
        <Link href="/" className="shrink-0" onClick={() => setDrawerOpen(false)}>
          <Logo />
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-white/55 2xl:flex 2xl:max-w-[280px]">
          <Search className="size-4" />
          <span className="truncate whitespace-nowrap text-sm">搜索场景、课程或报告</span>
        </div>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-2 xl:flex">
          {primaryLinks.map((item) => {
            const active = isLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-motion-button
                className={cn(
                  menuButtonClasses,
                  active &&
                    "border-white/24 bg-white/[0.14] !text-white shadow-lg shadow-slate-950/20 ring-1 ring-inset ring-white/10",
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            data-motion-button
            onMouseEnter={() => setMenuOpen(true)}
            onFocus={() => setMenuOpen(true)}
            onClick={() => setMenuOpen((current) => !current)}
            className={cn(
              menuButtonClasses,
              menuOpen &&
                "border-white/24 bg-white/[0.14] !text-white shadow-lg shadow-slate-950/20 ring-1 ring-inset ring-white/10",
            )}
          >
            产品矩阵
          </button>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 text-white/74 md:gap-3">
          <div className="hidden items-center gap-3 md:flex">
            <MoonStar className="size-4" aria-hidden />
            <LaptopMinimal className="size-4" aria-hidden />
            <Globe className="size-4" aria-hidden />
            <Link
              href="/demo?auth=login"
              data-motion-button
              className="inline-flex min-h-11 items-center rounded-full px-2 text-sm font-bold !text-white transition-colors hover:!text-white"
            >
              登录
            </Link>
          </div>

          <Link
            href="/demo?auth=register"
            data-motion-button
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-4 text-sm font-bold !text-slate-950 shadow-xl shadow-brand/30 transition-transform hover:-translate-y-0.5 hover:bg-brand-hover sm:px-5"
          >
            <Sparkles className="hidden size-4 sm:block" />
            立即体验
          </Link>

          <button
            type="button"
            data-motion-button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white transition-colors hover:bg-white/[0.08] xl:hidden"
            aria-label="打开导航菜单"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </div>

      {menuOpen ? (
          <div
            data-motion-drawer
            data-motion-side="none"
            className="hidden border-t border-white/8 bg-bg-inverse/95 xl:block"
          >
            <div className="mx-auto grid max-w-[1440px] gap-6 px-4 py-8 lg:grid-cols-[280px_1fr] lg:px-8">
              <div className="max-w-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-brand">Product Matrix</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  登录后按账号权限进入对应工作台，公共站点只保留课程、试玩和产品能力说明。
                </p>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  从官网叙事到沙盘体验、教师组织、家长报告和运营管理，能力都收在同一套账号体系里。
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {siteNavGroups.map((group) => (
                  <div
                    key={group.title}
                    className="rounded-[1.8rem] border border-white/8 bg-white/[0.04] p-5"
                  >
                    <p className="text-sm uppercase tracking-[0.24em] text-brand">{group.title}</p>
                    <p className="mt-3 text-sm leading-7 text-white/60">{group.summary}</p>
                    <div className="mt-4 space-y-3">
                      {group.items.map((item) => (
                        <Link
                          key={`${item.href}-${item.label}`}
                          href={item.href}
                          data-motion-card
                          className="group block rounded-2xl bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.08]"
                        >
                          <p className="font-semibold text-white">{item.label}</p>
                          <p className="mt-1 text-sm leading-6 text-white/54">{item.description}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

      {drawerOpen ? (
          <>
            <button
              type="button"
              aria-label="关闭导航菜单"
              data-motion-overlay
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-[2px] xl:hidden"
            />

            <aside
              data-motion-drawer
              data-motion-side="right"
              className="safe-drawer-offset fixed inset-y-0 right-0 z-[61] flex w-[min(420px,100vw)] flex-col overflow-y-auto border-l border-white/10 bg-bg-inverse px-5 pb-5 pt-4 text-white shadow-2xl shadow-slate-950/25 xl:hidden"
            >
              <div className="flex items-center justify-between gap-3">
                <Logo />
                <button
                  type="button"
                  data-motion-button
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-white"
                  aria-label="关闭菜单"
                >
                  <X className="size-5" />
                </button>
              </div>

              <label className="mt-5 flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-white/60">
                <Search className="size-4" />
                <input
                  placeholder="搜索场景、课程或报告"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/42"
                />
              </label>

              <div className="mt-6 space-y-2">
                {primaryLinks.map((item) => {
                  const active = isLinkActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-motion-card
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex min-h-12 items-center justify-between rounded-[1.35rem] border px-4 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "border-white/16 bg-white/[0.08] text-white"
                          : "border-transparent bg-white/[0.04] text-white/82",
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="text-xs text-white/38">入口</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mt-7 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-brand">产品矩阵</p>
                <div className="mt-4 space-y-4">
                  {siteNavGroups.map((group) => (
                    <div key={group.title} className="rounded-[1.3rem] bg-white/[0.04] p-4">
                      <p className="text-sm font-semibold text-white">{group.title}</p>
                      <p className="mt-2 text-sm leading-6 text-white/58">{group.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.items.map((item) => (
                          <Link
                            key={`${item.href}-${item.label}`}
                            href={item.href}
                            data-motion-button
                            onClick={() => setDrawerOpen(false)}
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-white/76"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-7 grid gap-3 rounded-[1.7rem] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/74">
                <div className="flex items-center gap-3">
                  <MoonStar className="size-4" />
                  深色沉浸视觉
                </div>
                <div className="flex items-center gap-3">
                  <LaptopMinimal className="size-4" />
                  跨端一致体验
                </div>
                <div className="flex items-center gap-3">
                  <Globe className="size-4" />
                  浏览器即开即用
                </div>
              </div>
            </aside>
          </>
        ) : null}
    </header>
  );
}
