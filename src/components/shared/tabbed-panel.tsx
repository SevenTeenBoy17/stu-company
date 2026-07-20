"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface TabbedPanelTab {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

/**
 * v2 信息收敛四件套 · TabbedPanel —— 并列长内容改成分页浏览。
 *
 * a11y 遵循 WAI-ARIA tabs 模式（与 itest7 的 radiogroup roving 同款约定）：
 * role=tablist/tab/tabpanel、aria-selected、roving tabIndex、←→/Home/End 键切换。
 */
export function TabbedPanel({
  tabs,
  defaultTabId,
  ariaLabel,
  className,
  listClassName,
  panelClassName,
}: {
  tabs: TabbedPanelTab[];
  defaultTabId?: string;
  ariaLabel: string;
  className?: string;
  listClassName?: string;
  panelClassName?: string;
}) {
  const baseId = useId();
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id ?? "");
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const activate = (id: string) => {
    setActiveId(id);
    tabRefs.current.get(id)?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    activate(tabs[next].id);
  };

  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className={className}>
      <div role="tablist" aria-label={ariaLabel} className={cn("flex flex-wrap gap-1.5", listClassName)}>
        {tabs.map((tab, index) => {
          const selected = tab.id === active?.id;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                if (node) tabRefs.current.set(tab.id, node);
                else tabRefs.current.delete(tab.id);
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-caption font-semibold transition-colors",
                selected
                  ? "bg-fg-strong text-white"
                  : "bg-black/[0.04] text-fg-muted hover:bg-black/[0.08] hover:text-fg-strong",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {active ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active.id}`}
          aria-labelledby={`${baseId}-tab-${active.id}`}
          tabIndex={0}
          className={cn("mt-4 focus-visible:outline-none", panelClassName)}
        >
          {active.content}
        </div>
      ) : null}
    </div>
  );
}
