import { useEffect, useRef, type RefObject } from "react";
import { CheckCircle2, CircleDot, Clock3, Lock } from "lucide-react";

import type { CardCollectionItem } from "@/lib/db/repo";
import type { QuestCard } from "@/lib/cards";
import type { StudentQuestStatus } from "@/lib/quests";

export type QuestCardCollectionView = CardCollectionItem & {
  card: QuestCard;
};

export const statusMeta: Record<
  StudentQuestStatus,
  {
    label: string;
    icon: typeof CircleDot;
    className: string;
  }
> = {
  done: {
    label: "已完成",
    icon: CheckCircle2,
    className: "bg-down-soft text-[var(--down-700)]",
  },
  active: {
    label: "进行中",
    icon: CircleDot,
    className: "bg-brand-soft text-brand-ink",
  },
  watch: {
    label: "需观察",
    icon: Clock3,
    className: "bg-warning/10 text-warning",
  },
  locked: {
    label: "待解锁",
    icon: Lock,
    className: "bg-slate-100 text-slate-600",
  },
};

export const tierMeta: Record<QuestCard["tier"], { label: string; className: string }> = {
  basic: { label: "基础", className: "border-slate-200 bg-slate-50 text-slate-700" },
  advanced: { label: "进阶", className: "border-brand/25 bg-brand-subtle text-brand-ink" },
  // 「系统」在深色卡面(bg-slate-950)上用浅靛蓝 text-sky-200(~13:1，AA 通过)，避免开奖刺激。
  system: { label: "系统", className: "border-sky-300/35 bg-sky-300/15 text-sky-200" },
};

export const questCardAssetBase = "/brand/quest-cards";
export const missionCardBackAsset = `${questCardAssetBase}/mission-card-back.webp`;
export const questWorldAssetBase = "/brand/quest-world";
export const achievementBadgeAssetBase = "/brand/achievement-badges";

export const achievementBadgeAssets: Record<string, string> = {
  "first-map": "first-map",
  "diversify-detective": "diversify-detective",
  "learning-spark": "learning-spark",
  "opportunity-scout": "opportunity-scout",
  "portfolio-researcher": "portfolio-researcher",
  "life-planner": "life-planner",
  "streak-maker": "streak-maker",
};

export const questCategoryTone: Record<string, { label: string; className: string }> = {
  finance: { label: "资产", className: "bg-brand-subtle text-brand-ink" },
  risk: { label: "风险", className: "bg-warning/10 text-warning" },
  learning: { label: "学习", className: "bg-info/10 text-info" },
  review: { label: "复盘", className: "bg-slate-100 text-slate-700" },
  discipline: { label: "纪律", className: "bg-down-soft text-[var(--down-700)]" },
};

export function questCategoryLabel(category: string) {
  return questCategoryTone[category]?.label ?? category.toUpperCase();
}

export function questIdFromCard(item: QuestCardCollectionView | CardCollectionItem) {
  return typeof item.meta?.questId === "string" ? item.meta.questId : null;
}

// 卡面 teachingLine（记忆层）↔ 触发任务的财商概念（行为层）的显式语义指针：来源任务 category。
export function questCategoryFromCard(item: QuestCardCollectionView | CardCollectionItem) {
  return typeof item.meta?.category === "string" ? item.meta.category : null;
}

export function progressAria(label: string, percent: number) {
  // §13 可访问性：进度条需 role=progressbar + aria-valuenow，且 valuenow 用真实进度（不被视觉最小宽度污染）。
  return {
    role: "progressbar" as const,
    "aria-label": label,
    "aria-valuenow": Math.max(0, Math.min(100, Math.round(percent))),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
  };
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function preferredScrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

export function focusAfterFlip(element: HTMLElement | null) {
  if (!element) return;
  element.focus({ preventScroll: true });
  window.setTimeout(() => {
    if (document.activeElement !== element) {
      element.focus({ preventScroll: true });
    }
  }, 0);
}

// 弹窗可访问性（§13）：初始焦点 + Esc 关闭 + Tab 焦点陷阱 + body 滚动锁 + 关闭归还焦点。复用于奖励弹窗与任务详情弹窗。
export function useModalA11y(
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
  initialFocusRef?: RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const opener = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
    (initialFocusRef?.current ?? containerRef.current)?.focus?.();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // 焦点陷阱：Tab/Shift+Tab 在弹窗内循环，不跑到被遮挡的背景。
      if (event.key === "Tab" && containerRef.current) {
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.(); // 关闭时把焦点还给触发按钮
    };
  }, [containerRef, initialFocusRef]);
}

export function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
