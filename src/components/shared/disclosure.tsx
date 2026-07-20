"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * v2 信息收敛四件套 · Disclosure —— 「少即是多」的统一折叠容器。
 *
 * 页面只保留一句话主张，长解说折进这里（默认收起）。展开动画用
 * grid-template-rows 0fr→1fr（无需测量高度，内容自适应），并通过
 * `motion-reduce:transition-none` 尊重系统减动效设置。
 * a11y：原生 button + aria-expanded + aria-controls，键盘天然可用。
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
  panelClassName,
  srContext,
}: {
  /** 收起态可见的那行「一句话」——按钮内容 */
  summary: ReactNode;
  /** 折叠的详情内容 */
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
  panelClassName?: string;
  /**
   * 读屏上下文（审查 #5 / WCAG 2.4.6）：循环里复用固定 summary（如「查看详情」）
   * 会让同页出现成批同名按钮，读屏按钮列表无法区分。传所属条目名（如卡片标题），
   * 以 sr-only 追加进可访问名，视觉不变。
   */
  srContext?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl px-1 py-2 text-left",
          "text-body-sm font-semibold text-fg-strong transition-colors hover:text-brand-ink",
          summaryClassName,
        )}
      >
        <span className="min-w-0 flex-1">
          {summary}
          {srContext ? <span className="sr-only">（{srContext}）</span> : null}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-fg-muted transition-transform duration-300 motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {/* 标准 WAI-ARIA disclosure 面板：不加 role="region"——同页多个折叠会产生
          多个无唯一名 landmark（axe landmark-unique，P2-1 auto-invest 实测暴露）。 */}
      <div
        id={panelId}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className={cn("min-h-0 overflow-hidden", !open && "invisible")}>
          <div className={cn("pb-2 pt-1 text-body-sm leading-7 text-fg-muted", panelClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
