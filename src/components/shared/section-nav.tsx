"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface SectionNavItem {
  /** 目标板块的元素 id（不带 #） */
  id: string;
  label: string;
}

/**
 * v2 信息收敛四件套 · SectionNav —— 长页锚点导航 + 滚动高亮。
 *
 * 页面信息被折叠分层后，用它给用户一条「这页有什么」的地图。
 * IntersectionObserver 做 scrollspy（当前板块 aria-current="location"），
 * 点击平滑滚动并尊重 prefers-reduced-motion（降级为瞬时跳转）。
 */
export function SectionNav({
  items,
  ariaLabel = "本页导航",
  className,
  sticky = true,
}: {
  items: SectionNavItem[];
  ariaLabel?: string;
  className?: string;
  sticky?: boolean;
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  // 点击锚点后的平滑滚动途中，scrollspy 会以「视口带内最靠上者」覆盖点击意图
  // （实测 market 页点「同学热度」落点正确却高亮上一板块）。点击后短暂抑制
  // observer，让用户的显式选择赢过滚动过程的中间态。
  const suppressSpyRef = useRef(false);
  const suppressTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = items
      .map((item) => document.getElementById(item.id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressSpyRef.current) return;
        // 取视口内最靠上的可见板块作为当前项，避免多板块同屏时高亮抖动。
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -58% 0px", threshold: [0, 0.2] },
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [items]);

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    suppressSpyRef.current = true;
    window.clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = window.setTimeout(
      () => {
        suppressSpyRef.current = false;
      },
      reduce ? 400 : 1200,
    );
    target.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex gap-1 overflow-x-auto",
        sticky && "sticky top-2 z-20",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault();
              scrollTo(item.id);
            }}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-caption font-semibold transition-colors",
              active
                ? "bg-fg-strong text-white"
                : "bg-white/70 text-fg-muted hover:bg-white hover:text-fg-strong",
            )}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
