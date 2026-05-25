import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

type MarketMoveTone = "up" | "down" | "flat";

const MARKET_MOVE_CLASSES: Record<
  MarketMoveTone,
  {
    text: string;
    darkText: string;
    badge: string;
    darkBadge: string;
    bar: string;
    dot: string;
  }
> = {
  up: {
    text: "text-[#d43c33]",
    darkText: "text-[#ffb7af]",
    badge: "bg-[#fff1f0] text-[#d43c33]",
    darkBadge: "bg-[#d43c33]/14 text-[#ffb7af]",
    bar: "bg-[#d43c33]",
    dot: "bg-[#d43c33]",
  },
  down: {
    text: "text-[#0f9d58]",
    darkText: "text-[#94e3b5]",
    badge: "bg-[#eefbf3] text-[#0f9d58]",
    darkBadge: "bg-[#0f9d58]/14 text-[#94e3b5]",
    bar: "bg-[#0f9d58]",
    dot: "bg-[#0f9d58]",
  },
  flat: {
    text: "text-slate-500",
    darkText: "text-white/62",
    badge: "bg-slate-100 text-slate-500",
    darkBadge: "bg-white/10 text-white/62",
    bar: "bg-slate-300",
    dot: "bg-slate-400",
  },
};

export function getMarketMoveTone(value: number): MarketMoveTone {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

export function getMarketMoveClasses(value: number) {
  return MARKET_MOVE_CLASSES[getMarketMoveTone(value)];
}

export function formatDateLabel(date = new Date()) {
  return format(date, "M月d日 HH:mm", { locale: zhCN });
}

export function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
