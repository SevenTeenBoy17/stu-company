import { clsx, type ClassValue } from "clsx";
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

/**
 * Strip common Markdown syntax (ATX headings, bold/italic, code spans, thematic
 * breaks) from an AI narrative so markers never render literally as "###" or "**"
 * in the teaching panels. Not a full Markdown renderer — just defensive
 * de-syntaxing for free text the model may emit with formatting.
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // # / ## / ### headings -> plain
    .replace(/^\s*([-*_])\1{2,}\s*$/gm, "") // --- *** ___ thematic breaks
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold**
    .replace(/__([^_]+)__/g, "$1") // __bold__
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/\n{3,}/g, "\n\n") // collapse blank-line runs left behind
    .trim();
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
    text: "text-up",
    darkText: "text-[var(--up-200)]",
    badge: "bg-up-soft text-up",
    darkBadge: "bg-up/15 text-[var(--up-200)]",
    bar: "bg-up",
    dot: "bg-up",
  },
  down: {
    text: "text-down",
    darkText: "text-[var(--down-200)]",
    badge: "bg-down-soft text-down",
    darkBadge: "bg-down/15 text-[var(--down-200)]",
    bar: "bg-down",
    dot: "bg-down",
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
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hour}:${minute}`;
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
