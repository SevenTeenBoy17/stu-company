"use client";

import { type CSSProperties, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Eye,
  Gift,
  Gamepad2,
  Loader2,
  Lock,
  MessageCircle,
  Orbit,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { QuestCard } from "@/lib/cards";
import type { CardCollectionItem } from "@/lib/db/repo";
import type { QuestClaimResult, StudentBenefitKind, StudentBenefitStatus, StudentQuestPayload, StudentQuestStatus } from "@/lib/quests";
import type { SeasonClaimResult, StudentSeasonChallengePayload } from "@/lib/season-challenges";
import { premiumMotion } from "@/lib/motion-system";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type QuestFilter = "all" | "active" | "done" | "watch";

export type QuestCardCollectionView = CardCollectionItem & {
  card: QuestCard;
};

type DrawQuestCardResponse = {
  card?: QuestCard;
  collectionItem?: CardCollectionItem;
  alreadyDrawn?: boolean;
  message?: string;
  error?: string;
};

const filterLabels: Array<{ id: QuestFilter; label: string }> = [
  { id: "all", label: "全部任务" },
  { id: "active", label: "进行中" },
  { id: "done", label: "已完成" },
  { id: "watch", label: "需观察" },
];

const statusMeta: Record<
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

const benefitKindMeta: Record<
  StudentBenefitKind,
  {
    label: string;
    icon: typeof Gift;
    className: string;
  }
> = {
  practice: {
    label: "微练习",
    icon: Gamepad2,
    className: "bg-brand-subtle text-brand-ink",
  },
  competition: {
    label: "小赛事",
    icon: UsersRound,
    className: "bg-slate-950 text-white",
  },
  perk: {
    label: "装饰权益",
    icon: Gift,
    className: "bg-warning/10 text-warning",
  },
};

const benefitStatusLabel: Record<StudentBenefitStatus, string> = {
  available: "可开始",
  in_progress: "进行中",
  locked: "待解锁",
  claimed: "已点亮",
};

// 去射幸（合规）：稀有度文案中性化为「收藏分组」语义，移除 COMMON/RARE/EPIC 开奖色彩。
// 卡牌奖励本就只装饰、不改净值/战力/排行榜，这里只去掉感知层的"中奖"暗示（面向未成年人）。
const rarityMeta: Record<QuestCard["rarity"], { label: string; className: string }> = {
  common: { label: "基础", className: "border-slate-200 bg-slate-50 text-slate-700" },
  rare: { label: "进阶", className: "border-brand/25 bg-brand-subtle text-brand-ink" },
  // 「典藏」在深色卡面(bg-slate-950)上用浅靛蓝 text-sky-200(~13:1，AA 通过)，不再用金色高亮做开奖惊喜。
  epic: { label: "典藏", className: "border-sky-300/35 bg-sky-300/15 text-sky-200" },
};

const questCardAssetBase = "/brand/quest-cards";
const questWorldAssetBase = "/brand/quest-world";
const achievementBadgeAssetBase = "/brand/achievement-badges";

const achievementBadgeAssets: Record<string, string> = {
  "first-map": "first-map",
  "diversify-detective": "diversify-detective",
  "learning-spark": "learning-spark",
  "opportunity-scout": "opportunity-scout",
  "portfolio-researcher": "portfolio-researcher",
  "life-planner": "life-planner",
  "streak-maker": "streak-maker",
};

const questCategoryTone: Record<string, { label: string; className: string }> = {
  finance: { label: "资产", className: "bg-brand-subtle text-brand-ink" },
  risk: { label: "风险", className: "bg-warning/10 text-warning" },
  learning: { label: "学习", className: "bg-info/10 text-info" },
  review: { label: "复盘", className: "bg-slate-100 text-slate-700" },
  discipline: { label: "纪律", className: "bg-down-soft text-[var(--down-700)]" },
};

function questCategoryLabel(category: string) {
  return questCategoryTone[category]?.label ?? category.toUpperCase();
}

function questIdFromCard(item: QuestCardCollectionView | CardCollectionItem) {
  return typeof item.meta?.questId === "string" ? item.meta.questId : null;
}

function progressAria(label: string, percent: number) {
  // §13 可访问性：进度条需 role=progressbar + aria-valuenow，且 valuenow 用真实进度（不被视觉最小宽度污染）。
  return {
    role: "progressbar" as const,
    "aria-label": label,
    "aria-valuenow": Math.max(0, Math.min(100, Math.round(percent))),
    "aria-valuemin": 0,
    "aria-valuemax": 100,
  };
}

function QuestCardFallbackArt({ card }: { card: QuestCard }) {
  const meta = rarityMeta[card.rarity];

  return (
    <div className="absolute inset-0 bg-slate-950">
      <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
      <div className="absolute left-6 top-6 h-20 w-20 rounded-full border border-brand/35" />
      <div className="absolute right-8 top-10 h-16 w-16 rounded-[1.2rem] border border-white/14 bg-white/8" />
      <div className="absolute bottom-8 left-8 right-8 h-16 rounded-[1.4rem] border border-white/12 bg-white/8" />
      <div className="absolute bottom-16 left-12 h-2 w-28 rounded-full bg-brand" />
      <div className="absolute bottom-16 left-40 h-2 w-20 rounded-full bg-down" />
      <div className="relative z-10 flex h-full flex-col justify-between p-4">
        <span className={cn("w-fit rounded-full border px-3 py-1 text-xs font-semibold", meta.className)}>
          {meta.label}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">{card.artKey}</p>
          <h3 className="mt-2 text-h2 font-bold text-white">{card.name}</h3>
        </div>
      </div>
    </div>
  );
}

function QuestCardArt({
  card,
  compact = false,
  className,
}: {
  card: QuestCard;
  compact?: boolean;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = rarityMeta[card.rarity];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.4rem] bg-slate-950 text-white",
        compact ? "min-h-36" : "min-h-44",
        className,
      )}
    >
      {imageFailed ? (
        <QuestCardFallbackArt card={card} />
      ) : (
        <Image
          src={`${questCardAssetBase}/front-${card.id}.webp`}
          alt={`${card.name} 卡面插画`}
          fill
          sizes={compact ? "(min-width: 1280px) 260px, 70vw" : "(min-width: 1280px) 320px, (min-width: 768px) 45vw, 92vw"}
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/18 to-transparent" />
      <div className={cn("relative z-10 flex flex-col justify-between p-4", compact ? "min-h-36" : "min-h-44")}>
        <span className={cn("w-fit rounded-full border px-3 py-1 text-xs font-semibold shadow-sm", meta.className)}>
          {meta.label}
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">{card.artKey}</p>
          <h3 className={cn("mt-2 font-bold text-white", compact ? "text-lg" : "text-h2")}>{card.name}</h3>
        </div>
      </div>
    </div>
  );
}

function QuestCardBackArt({ rarity = "common" }: { rarity?: QuestCard["rarity"] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = rarityMeta[rarity];

  return (
    <div className="relative mt-4 min-h-32 overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.06]">
      {imageFailed ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(242,162,69,0.28),transparent_42%),linear-gradient(135deg,#111827,#020617)]" />
      ) : (
        <Image
          src={`${questCardAssetBase}/back-${rarity}.svg`}
          alt={`${meta.label} 卡背插画`}
          fill
          sizes="(min-width: 1280px) 320px, 92vw"
          className="object-cover opacity-95"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/64 via-transparent to-slate-950/70" />
      <div className="relative z-10 flex min-h-32 flex-col justify-end p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">学习纪念卡</p>
        <p className="mt-1 text-sm font-bold text-white">完成任务后领取</p>
      </div>
    </div>
  );
}

type QuestItem = StudentQuestPayload["quests"][number];

type QuestBoxTheme = {
  id: string;
  creature: string;
  world: string;
  badge: string;
  asset: string;
  from: string;
  via: string;
  to: string;
  accent: string;
  accent2: string;
  ink: string;
  glow: string;
};

const questBoxThemes: QuestBoxTheme[] = [
  {
    id: "fox-sunrise",
    creature: "狐队长",
    world: "晨光市场星",
    badge: "行情侦察",
    asset: "fox-market-scout",
    from: "#fff1d8",
    via: "#f97316",
    to: "#7c2d12",
    accent: "#ffb86b",
    accent2: "#fef3c7",
    ink: "#1f1308",
    glow: "rgba(249,115,22,0.42)",
  },
  {
    id: "turtle-shield",
    creature: "龟护卫",
    world: "安全垫岛",
    badge: "风险缓冲",
    asset: "turtle-safety-guard",
    from: "#e0fff3",
    via: "#10b981",
    to: "#064e3b",
    accent: "#8ee6c0",
    accent2: "#ecfdf5",
    ink: "#06261d",
    glow: "rgba(16,185,129,0.34)",
  },
  {
    id: "rabbit-bank",
    creature: "兔管家",
    world: "储蓄月球",
    badge: "现金纪律",
    asset: "rabbit-savings-banker",
    from: "#fff7ed",
    via: "#fb7185",
    to: "#881337",
    accent: "#fda4af",
    accent2: "#ffe4e6",
    ink: "#2a0f15",
    glow: "rgba(251,113,133,0.36)",
  },
  {
    id: "owl-lab",
    creature: "猫头鹰",
    world: "复盘书塔",
    badge: "证据链",
    asset: "owl-evidence-analyst",
    from: "#eef2ff",
    via: "#6366f1",
    to: "#312e81",
    accent: "#a5b4fc",
    accent2: "#e0e7ff",
    ink: "#111338",
    glow: "rgba(99,102,241,0.34)",
  },
  {
    id: "robot-radar",
    creature: "小机器人",
    world: "雷达港",
    badge: "信号识别",
    asset: "robot-radar-helper",
    from: "#ecfeff",
    via: "#06b6d4",
    to: "#164e63",
    accent: "#67e8f9",
    accent2: "#cffafe",
    ink: "#052e36",
    glow: "rgba(6,182,212,0.34)",
  },
  {
    id: "whale-harbor",
    creature: "鲸艇长",
    world: "现金海湾",
    badge: "流动性",
    asset: "whale-cash-captain",
    from: "#eff6ff",
    via: "#3b82f6",
    to: "#1e3a8a",
    accent: "#93c5fd",
    accent2: "#dbeafe",
    ink: "#0b1e3d",
    glow: "rgba(59,130,246,0.34)",
  },
  {
    id: "cat-scout",
    creature: "猫侦探",
    world: "机会街区",
    badge: "市场观察",
    asset: "cat-opportunity-detective",
    from: "#f7fee7",
    via: "#84cc16",
    to: "#365314",
    accent: "#bef264",
    accent2: "#ecfccb",
    ink: "#18230d",
    glow: "rgba(132,204,22,0.32)",
  },
  {
    id: "deer-bond",
    creature: "鹿信使",
    world: "债券林地",
    badge: "稳健配置",
    asset: "deer-bond-messenger",
    from: "#fffbeb",
    via: "#f59e0b",
    to: "#78350f",
    accent: "#fcd34d",
    accent2: "#fef3c7",
    ink: "#241506",
    glow: "rgba(245,158,11,0.36)",
  },
  {
    id: "panda-etf",
    creature: "熊猫研究员",
    world: "ETF 实验室",
    badge: "分散实验",
    asset: "panda-etf-researcher",
    from: "#f0fdfa",
    via: "#14b8a6",
    to: "#134e4a",
    accent: "#5eead4",
    accent2: "#ccfbf1",
    ink: "#082f2c",
    glow: "rgba(20,184,166,0.34)",
  },
  {
    id: "squirrel-budget",
    creature: "松鼠会计",
    world: "生活账本谷",
    badge: "预算节奏",
    asset: "squirrel-budget-accountant",
    from: "#fff7ed",
    via: "#ea580c",
    to: "#7c2d12",
    accent: "#fdba74",
    accent2: "#fed7aa",
    ink: "#261203",
    glow: "rgba(234,88,12,0.36)",
  },
  {
    id: "lion-rank",
    creature: "狮子向导",
    world: "目标灯塔",
    badge: "目标拆解",
    asset: "lion-leaderboard-referee",
    from: "#faf5ff",
    via: "#a855f7",
    to: "#581c87",
    accent: "#d8b4fe",
    accent2: "#f3e8ff",
    ink: "#26063d",
    glow: "rgba(168,85,247,0.34)",
  },
  {
    id: "penguin-review",
    creature: "企鹅档案员",
    world: "历史冰川",
    badge: "复盘归档",
    asset: "penguin-history-archivist",
    from: "#f0f9ff",
    via: "#0ea5e9",
    to: "#075985",
    accent: "#7dd3fc",
    accent2: "#e0f2fe",
    ink: "#082f49",
    glow: "rgba(14,165,233,0.34)",
  },
];

function stableQuestThemeIndex(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash % questBoxThemes.length;
}

function questBoxThemeFor(quest: QuestItem, index = 0) {
  const preferredIndex = Number.isFinite(index) ? index : stableQuestThemeIndex(quest.id);
  return questBoxThemes[preferredIndex % questBoxThemes.length] ?? questBoxThemes[stableQuestThemeIndex(quest.id)];
}

function QuestBlindBoxArt({
  quest,
  index = 0,
  compact = false,
}: {
  quest: QuestItem;
  index?: number;
  compact?: boolean;
}) {
  const theme = questBoxThemeFor(quest, index);
  const characterSrc = `${questWorldAssetBase}/characters/${theme.asset}.webp`;
  const style = {
    "--quest-from": theme.from,
    "--quest-via": theme.via,
    "--quest-to": theme.to,
    "--quest-accent": theme.accent,
    "--quest-accent-2": theme.accent2,
    "--quest-ink": theme.ink,
    "--quest-glow": theme.glow,
  } as CSSProperties;

  return (
    <div
      data-testid={`quest-box-art-${quest.id}`}
      data-theme={theme.id}
      aria-label={`${theme.creature} ${theme.world} 任务锦囊卡面`}
      className={cn(
        "relative isolate overflow-hidden rounded-[1.45rem] border border-white/50 shadow-[0_22px_55px_rgba(15,23,42,0.18)]",
        compact ? "h-24 w-28 shrink-0" : "min-h-[18rem] w-full",
      )}
      style={{
        ...style,
        background:
          "radial-gradient(circle at 22% 18%, var(--quest-accent-2), transparent 30%), radial-gradient(circle at 76% 18%, var(--quest-glow), transparent 28%), linear-gradient(135deg, var(--quest-from), var(--quest-via) 48%, var(--quest-to))",
      }}
    >
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.22)_1px,transparent_1px)] [background-size:22px_22px]" />
      <div className="absolute -left-8 top-8 h-24 w-24 rounded-full bg-white/30 blur-xl" />
      <div className="absolute -right-10 bottom-4 h-28 w-28 rounded-full bg-black/18 blur-2xl" />
      <div className="absolute left-[12%] top-[22%] h-12 w-12 rounded-[1.2rem] border border-white/45 bg-white/20 shadow-inner" />
      <div className="absolute right-[14%] top-[16%] h-9 w-9 rounded-full border border-white/35 bg-white/18" />
      <div className="absolute bottom-[20%] left-[12%] right-[12%] h-7 rounded-full border border-white/35 bg-white/18 backdrop-blur" />
      <div className="absolute bottom-[26%] left-[18%] h-1.5 w-[34%] rounded-full bg-[var(--quest-accent-2)]" />
      <div className="absolute bottom-[26%] right-[18%] h-1.5 w-[24%] rounded-full bg-white/55" />

      <div className={cn("relative z-10 flex h-full flex-col", compact ? "p-2" : "p-5")}>
        <div className="flex items-start justify-between gap-2">
          <span
            className={cn(
              "rounded-full bg-white/72 font-semibold text-[var(--quest-ink)] shadow-sm backdrop-blur",
              compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
            )}
          >
            {theme.badge}
          </span>
          {!compact ? (
            <span className="rounded-full bg-slate-950/74 px-3 py-1 text-xs font-semibold text-white">#{index + 1}</span>
          ) : null}
        </div>

        <div className={cn("flex flex-1 items-center justify-center", compact ? "py-1" : "py-3")}>
          <div
            className={cn(
              "relative overflow-hidden rounded-[28%] bg-white/88 shadow-[0_26px_70px_rgba(15,23,42,0.28)] ring-1 ring-white/70",
              compact ? "h-14 w-14" : "h-40 w-40 sm:h-44 sm:w-44",
            )}
          >
            <Image
              src={characterSrc}
              alt={`${theme.creature} 3D 卡通形象`}
              fill
              sizes={compact ? "96px" : "(min-width: 1280px) 176px, 42vw"}
              className="object-cover"
            />
            <span className="absolute -top-2 right-2 h-4 w-4 rounded-full bg-[var(--quest-accent)] shadow-md" />
            <span className="absolute -bottom-2 left-3 h-3 w-8 rounded-full bg-[var(--quest-accent-2)]" />
          </div>
        </div>

        {!compact ? (
          <div className="rounded-[1.1rem] border border-white/45 bg-white/58 p-3 text-[var(--quest-ink)] backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-70">专属角色皮肤</p>
            <p className="mt-1 text-lg font-bold">{theme.world}</p>
            <p className="mt-1 line-clamp-1 text-xs font-semibold opacity-70">每个任务都有独立 3D 角色图案，打开后再显示目标。</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type QuestVisualProfile = {
  visualTitle: string;
  shortAction: string;
  conceptTag: string;
  creatureName: string;
  creatureAsset: string;
  plantLabel: string;
  accent: string;
  softBg: string;
};

const questVisualProfiles: Array<{ match: (id: string, category: string) => boolean; profile: QuestVisualProfile }> = [
  {
    match: (id) => id.includes("market"),
    profile: {
      visualTitle: "市场观察",
      shortAction: "去观察",
      conceptTag: "证据链",
      creatureName: "狐狸侦察员",
      creatureAsset: "fox-market-scout",
      plantLabel: "雷达叶片",
      accent: "#f08a38",
      softBg: "linear-gradient(135deg,#fff7ed,#ecfeff)",
    },
  },
  {
    match: (id) => id.includes("opportunity") || id.includes("evidence") || id.includes("note"),
    profile: {
      visualTitle: "机会证据",
      shortAction: "写证据",
      conceptTag: "机会观察单",
      creatureName: "猫头鹰分析师",
      creatureAsset: "owl-evidence-analyst",
      plantLabel: "放大镜花",
      accent: "#7aa7ff",
      softBg: "linear-gradient(135deg,#eff6ff,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("fund") || id.includes("portfolio") || id.includes("diversification"),
    profile: {
      visualTitle: "组合实验",
      shortAction: "做实验",
      conceptTag: "分散配置",
      creatureName: "熊猫研究员",
      creatureAsset: "panda-etf-researcher",
      plantLabel: "竹叶饼图",
      accent: "#14b8a6",
      softBg: "linear-gradient(135deg,#f0fdfa,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("risk") || id.includes("protection") || id.includes("safety") || id.includes("goal"),
    profile: {
      visualTitle: "安全底座",
      shortAction: "建底座",
      conceptTag: "风险缓冲",
      creatureName: "乌龟守护者",
      creatureAsset: "turtle-safety-guard",
      plantLabel: "盾牌蘑菇",
      accent: "#78d8ad",
      softBg: "linear-gradient(135deg,#ecfdf5,#fffaf2)",
    },
  },
  {
    match: (id) => id.includes("review") || id.includes("wealth") || id.includes("cooldown"),
    profile: {
      visualTitle: "持有复盘",
      shortAction: "去复盘",
      conceptTag: "回环藤蔓",
      creatureName: "企鹅档案员",
      creatureAsset: "penguin-history-archivist",
      plantLabel: "复盘藤蔓",
      accent: "#7aa7ff",
      softBg: "linear-gradient(135deg,#eff6ff,#f8fafc)",
    },
  },
  {
    match: (id) => id.includes("cash") || id.includes("bank") || id.includes("buffer"),
    profile: {
      visualTitle: "现金管理",
      shortAction: "管现金",
      conceptTag: "现金流",
      creatureName: "鲸鱼现金队长",
      creatureAsset: "whale-cash-captain",
      plantLabel: "水滴钱袋",
      accent: "#3b82f6",
      softBg: "linear-gradient(135deg,#eff6ff,#fff7ed)",
    },
  },
  {
    match: (id) => id.includes("learn"),
    profile: {
      visualTitle: "知识火花",
      shortAction: "去学习",
      conceptTag: "课程转化",
      creatureName: "雷达机器人",
      creatureAsset: "robot-radar-helper",
      plantLabel: "学习火苗",
      accent: "#06b6d4",
      softBg: "linear-gradient(135deg,#ecfeff,#f8fafc)",
    },
  },
];

function questVisualProfileFor(quest: QuestItem, index = 0): QuestVisualProfile {
  const matched = questVisualProfiles.find((item) => item.match(quest.id, quest.category));
  if (matched) return matched.profile;
  const theme = questBoxThemeFor(quest, index);
  return {
    visualTitle: questCategoryLabel(quest.category),
    shortAction: quest.status === "done" ? "领奖励" : quest.status === "locked" ? "看条件" : "继续任务",
    conceptTag: theme.badge,
    creatureName: theme.creature,
    creatureAsset: theme.asset,
    plantLabel: theme.world,
    accent: theme.accent,
    softBg: `linear-gradient(135deg,${theme.from},#ffffff)`,
  };
}

function CreaturePortrait({
  profile,
  className,
  priority = false,
}: {
  profile: QuestVisualProfile;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div
      data-creature-float="true"
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[28%] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] ring-1 ring-white/80",
        className,
      )}
      style={{ boxShadow: `0 18px 42px ${profile.accent}24` }}
    >
      <Image
        src={`${questWorldAssetBase}/characters/${profile.creatureAsset}.webp`}
        alt={`${profile.creatureName}，代表${profile.visualTitle}`}
        fill
        sizes="120px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}

function MissionRouteNode({
  quest,
  index,
  active,
  onSelect,
}: {
  quest: QuestItem;
  index: number;
  active: boolean;
  onSelect: (questId: string) => void;
}) {
  const profile = questVisualProfileFor(quest, index);
  const progress = Math.round(quest.progress * 100);
  const [revealed, setRevealed] = useState(active || quest.status === "done");
  const isRevealed = revealed || active;

  const flipAndSelect = () => {
    setRevealed(true);
    onSelect(quest.id);
  };

  return (
    <div
      data-route-node
      key={quest.id}
      className={cn(
        "group relative min-h-[176px] rounded-[1.5rem] [perspective:1100px]",
        active && "z-10",
      )}
    >
      <div
        data-route-flip-inner
        className={cn(
          "absolute inset-0 rounded-[1.5rem] transition-transform duration-700 [transform-style:preserve-3d]",
          isRevealed && "[transform:rotateY(180deg)]",
        )}
      >
        <button
          type="button"
          onClick={flipAndSelect}
          aria-label={`翻开航线 ${index + 1} 的任务卡：${profile.visualTitle}`}
          aria-hidden={isRevealed}
          inert={isRevealed}
          className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-950 p-4 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-1 hover:border-brand/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [backface-visibility:hidden]"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: profile.accent }} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_42%,rgba(240,138,56,0.12))]" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
              航线 {index + 1}
            </span>
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-black text-slate-950">点击翻开</span>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-4">
            <CreaturePortrait profile={profile} className="h-20 w-20 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black text-white">任务锦囊</p>
              <p className="mt-1 line-clamp-1 text-sm font-bold text-white/62">{profile.creatureName} 正在守护线索</p>
              <div {...progressAria(`${profile.visualTitle} 进度`, progress)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/12">
                <div className="h-full rounded-full" style={{ width: `${Math.max(8, progress)}%`, background: profile.accent }} />
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelect(quest.id)}
          aria-label={`选择航线 ${index + 1}：${profile.visualTitle}，${progress}%`}
          aria-hidden={!isRevealed}
          inert={!isRevealed}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-[1.5rem] border p-4 text-left shadow-sm transition duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [backface-visibility:hidden] [transform:rotateY(180deg)]",
            active ? "border-brand bg-white shadow-[0_22px_70px_rgba(240,138,56,0.20)]" : "border-slate-200 bg-white/86 hover:border-brand/40",
          )}
          style={{ background: active ? profile.softBg : undefined }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: profile.accent }} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-black text-slate-800 shadow-sm">
              航线 {index + 1}
            </span>
            <QuestStatusBadge status={quest.status} />
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-4">
            <CreaturePortrait profile={profile} className="h-20 w-20 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105" />
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black text-slate-950">{profile.visualTitle}</p>
              <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-500">{profile.creatureName}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">{profile.shortAction}</span>
                <span className="text-xs font-bold tabular-nums text-slate-500">{progress}%</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function SeasonObjectiveCreatureCard({
  objective,
  index,
}: {
  objective: StudentSeasonChallengePayload["objectives"][number];
  index: number;
}) {
  const [revealed, setRevealed] = useState(objective.done);
  const pseudoQuest = {
    id: objective.id,
    category:
      objective.id.includes("safety") || objective.id.includes("risk")
        ? "risk"
        : objective.id.includes("review")
          ? "review"
          : objective.id.includes("portfolio")
            ? "finance"
            : "learning",
    status: objective.done ? "done" : "active",
    progress: objective.progress,
  } as QuestItem;
  const profile = questVisualProfileFor(pseudoQuest, index);
  const progressText = `${Math.min(objective.target, Math.round(objective.progress * objective.target))}/${objective.target}`;

  return (
    <div
      data-motion-card
      data-objective-creature
      key={objective.id}
      className="group relative min-h-[176px] rounded-[1.55rem] [perspective:1100px]"
    >
      <div
        data-objective-flip-inner
        className={cn(
          "absolute inset-0 rounded-[1.55rem] transition-transform duration-700 [transform-style:preserve-3d]",
          revealed && "[transform:rotateY(180deg)]",
        )}
      >
        <button
          type="button"
          onClick={() => setRevealed(true)}
          aria-label={`翻开赛季任务卡：${profile.visualTitle}`}
          aria-hidden={revealed}
          inert={revealed}
          className="absolute inset-0 overflow-hidden rounded-[1.55rem] border border-slate-200 bg-slate-950 p-4 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-1 hover:border-brand/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [backface-visibility:hidden]"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: profile.accent }} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10),transparent_42%,rgba(240,138,56,0.12))]" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <CreaturePortrait profile={profile} className="h-16 w-16 transition duration-300 group-hover:-translate-y-1" />
            <span className="rounded-full bg-brand px-3 py-1 text-xs font-black text-slate-950 shadow-sm">
              翻开任务
            </span>
          </div>
          <div className="relative z-10 mt-4">
            <h3 className="text-xl font-black text-white">{profile.visualTitle}</h3>
            <p className="mt-1 line-clamp-1 text-sm font-bold text-white/62">{profile.creatureName} 带来一个小挑战</p>
            <div {...progressAria(`${profile.visualTitle} 进度`, objective.progress * 100)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/12">
              <div className="h-full rounded-full" style={{ width: `${Math.max(8, objective.progress * 100)}%`, background: profile.accent }} />
            </div>
          </div>
        </button>

        <div
          aria-hidden={!revealed}
          inert={!revealed}
          className={cn(
            "absolute inset-0 overflow-hidden rounded-[1.55rem] border p-4 shadow-sm transition duration-300 [backface-visibility:hidden] [transform:rotateY(180deg)]",
            objective.done ? "border-up/20 bg-up-soft" : "border-slate-200 bg-white hover:border-brand/35",
          )}
          style={{ background: objective.done ? undefined : profile.softBg }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: profile.accent }} />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <CreaturePortrait profile={profile} className="h-16 w-16 transition duration-300 group-hover:-translate-y-1" />
            <span className="rounded-full bg-white/80 px-3 py-1 text-sm font-black tabular-nums text-slate-700 shadow-sm">
              {progressText}
            </span>
          </div>
          <div className="relative z-10 mt-4">
            <h3 className="text-xl font-black text-slate-950">{profile.visualTitle}</h3>
            <p className="mt-1 line-clamp-1 text-sm font-bold text-slate-500">{profile.plantLabel}</p>
            <div {...progressAria(`${profile.visualTitle} 进度`, objective.done ? 100 : objective.progress * 100)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/70">
              <div className="h-full rounded-full" style={{ width: `${Math.max(objective.done ? 100 : 8, objective.progress * 100)}%`, background: profile.accent }} />
            </div>
            <Link
              href={objective.href}
              className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              去完成
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionHabitatShelf({
  quests,
  selectedQuestId,
}: {
  quests: QuestItem[];
  selectedQuestId: string | null;
}) {
  const visible = quests.slice(0, 4);
  const unlockedCount = quests.filter((quest) => quest.status === "done" || quest.claimed).length;
  // 赛季植物成长（§5.3 / §7.3）：以今日任务点亮比例驱动 种子→幼芽→小树→发光果实。
  const seasonProgress = quests.length ? unlockedCount / quests.length : 0;
  const plantStage =
    seasonProgress >= 0.85
      ? { emoji: "🌟", label: "发光果实" }
      : seasonProgress >= 0.5
        ? { emoji: "🌳", label: "小树成形" }
        : seasonProgress >= 0.25
          ? { emoji: "🌿", label: "幼芽舒展" }
          : { emoji: "🌱", label: "种子萌发" };
  // 宠物心情 / 学习火苗（§7.3 mood）。
  const mood =
    seasonProgress >= 0.75
      ? { emoji: "🎉", label: "庆祝中" }
      : seasonProgress >= 0.4
        ? { emoji: "🔥", label: "专注中" }
        : unlockedCount > 0
          ? { emoji: "✨", label: "好奇中" }
          : { emoji: "🌙", label: "待启程" };

  return (
    <div data-habitat-shelf className="relative z-10 mt-4 rounded-[1.35rem] border border-slate-200/80 bg-white/70 p-3 shadow-inner shadow-slate-950/5 backdrop-blur">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-700">今日栖息地</p>
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800"
            aria-label={`赛季植物：${plantStage.label}`}
          >
            <span aria-hidden>{plantStage.emoji}</span> {plantStage.label}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-bold text-white"
            aria-label={`栖息地心情：${mood.label}`}
          >
            <span aria-hidden>{mood.emoji}</span> {mood.label}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {visible.map((quest, index) => {
          const profile = questVisualProfileFor(quest, index);
          const active = quest.id === selectedQuestId;
          const isUnlocked = quest.status === "done" || quest.claimed;
          return (
            <div
              data-habitat-token
              data-habitat-unlocked={isUnlocked ? "true" : "false"}
              key={quest.id}
              aria-label={isUnlocked ? `已点亮的伙伴：${profile.creatureName}` : `待点亮的伙伴：${profile.visualTitle}`}
              className={cn(
                "relative min-h-24 overflow-hidden rounded-[1.1rem] border p-2 text-center transition",
                active ? "border-brand bg-brand-subtle" : "border-slate-200 bg-white/72",
              )}
            >
              <div className={cn("relative mx-auto h-12 w-12", !isUnlocked && "opacity-45 grayscale")}>
                <CreaturePortrait profile={profile} className="h-12 w-12" />
                {!isUnlocked ? (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/80 text-white shadow">
                    <Lock className="h-3 w-3" />
                  </span>
                ) : null}
              </div>
              <p className="mt-2 line-clamp-1 text-[11px] font-black text-slate-800">
                {profile.visualTitle}
              </p>
              <p className="mt-0.5 text-[10px] font-bold tabular-nums text-slate-500">{Math.round(quest.progress * 100)}%</p>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold text-emerald-700">赛季植物成长</span>
        <span className="text-[10px] font-bold tabular-nums text-emerald-700">
          今天已点亮 {unlockedCount} 位伙伴
        </span>
      </div>
      <div
        {...progressAria(`赛季植物成长 · ${plantStage.label}`, seasonProgress * 100)}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-emerald-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-[width] duration-500"
          style={{ width: `${Math.max(6, seasonProgress * 100)}%` }}
        />
      </div>
    </div>
  );
}

function MiniQuestCreatureCard({
  quest,
  index,
  onSelect,
}: {
  quest: QuestItem;
  index: number;
  onSelect: (questId: string) => void;
}) {
  const profile = questVisualProfileFor(quest, index);

  return (
    <button
      data-queue-creature-card
      key={quest.id}
      type="button"
      onClick={() => onSelect(quest.id)}
      className="group w-full rounded-[1.25rem] border border-white/10 bg-white/[0.075] p-3 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-white/[0.12] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      <div className="flex items-center gap-3">
        <CreaturePortrait profile={profile} className="h-24 w-24" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-brand-warm">
              任务 {index + 1}
            </span>
            <span className="text-xs font-bold tabular-nums text-white/70">{Math.round(quest.progress * 100)}%</span>
          </div>
          <p className="mt-2 line-clamp-1 text-lg font-black text-white">{profile.visualTitle}</p>
          <p className="mt-1 line-clamp-1 text-xs font-bold text-white/58">{profile.conceptTag} · {profile.shortAction}</p>
          <div {...progressAria(`${profile.visualTitle} 进度`, quest.progress * 100)} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${Math.max(quest.status === "locked" ? 0 : 8, quest.progress * 100)}%`, background: profile.accent }} />
          </div>
        </div>
      </div>
    </button>
  );
}

function QuestCommanderPanel({
  quests,
  selectedQuestId,
  onSelect,
}: {
  quests: QuestItem[];
  selectedQuestId: string | null;
  onSelect: (questId: string) => void;
}) {
  const recommended = quests.slice(0, 4);
  const selected = quests.find((quest) => quest.id === selectedQuestId) ?? recommended[0];
  const routesDone = recommended.filter((quest) => quest.status === "done" || quest.claimed).length;
  const doneRatio = recommended.length ? routesDone / recommended.length : 0;

  return (
    <section
      data-quest-reveal
      data-motion-reveal
      data-testid="quest-commander-panel"
      className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-soft"
    >
      <div className="grid gap-0 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative min-h-[320px] overflow-hidden bg-slate-950 text-white">
          <Image
            src={`${questWorldAssetBase}/commander-mission.webp`}
            alt="任务指挥官、锦囊与动物行星插画"
            fill
            sizes="(min-width: 1280px) 520px, 92vw"
            className="object-cover opacity-90"
            priority
            data-testid="quest-commander-image"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/58 to-slate-950/10" />
          <div className="relative z-10 flex min-h-[320px] flex-col justify-between p-6 md:p-7">
            <div>
              <p className="bz-eyebrow-inverse">指挥官简报</p>
              <h2 className="mt-3 max-w-lg text-display-md font-semibold md:text-display-lg">先和指挥官对话，再打开任务锦囊</h2>
              <p className="mt-4 max-w-xl text-body leading-8 text-white/74">
                任务不会一股脑摊开。先选择一条训练航线，打开锦囊后再查看任务目标、复盘提示和专属学习卡片。
              </p>
            </div>
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.08] p-4 backdrop-blur">
              <div className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-brand-warm" />
                <p className="text-sm font-semibold leading-6 text-white/80">
                  指挥官：今天只挑一个重点练习。看清任务背面的“为什么”，比一次性打开所有说明更重要。
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[linear-gradient(135deg,#fffaf2,white_42%,#eef6ff)] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="bz-eyebrow bz-brand-text-on-light">今日航线</p>
              <h3 className="mt-2 text-h1 font-semibold text-fg-strong">选择今日任务航线</h3>
            </div>
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              {selected ? questCategoryLabel(selected.category) : "待选择"}
            </span>
          </div>
          <div className="relative mt-5">
            <div
              className="pointer-events-none absolute left-8 right-8 top-1/2 hidden h-1 -translate-y-1/2 overflow-hidden rounded-full bg-slate-200/70 sm:block"
              aria-hidden
            >
              {/* §7.1 已完成路线点亮：连接线随完成比例从左到右点亮 */}
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-up shadow-[0_0_12px_rgba(240,138,56,0.45)] transition-[width] duration-700"
                style={{ width: `${doneRatio * 100}%` }}
              />
            </div>
            <div className="relative z-10 grid gap-3 sm:grid-cols-2">
              {recommended.map((quest, index) => (
                <MissionRouteNode
                  key={quest.id}
                  quest={quest}
                  index={index}
                  active={quest.id === selectedQuestId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
          <div className="mt-5 rounded-[1.35rem] border border-brand/25 bg-brand-subtle p-4">
            <div className="flex items-start gap-3">
              <Orbit className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <p className="text-sm font-bold leading-6 text-brand-ink">
                页面默认只展示关键信息。任务细节、奖励解释和导师建议会在拆盒或点击详情后展开，降低认知负荷。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuestDetailDialog({ quest, onClose }: { quest: QuestItem | null; onClose: () => void }) {
  if (!quest) return null;
  return <QuestDetailDialogInner quest={quest} onClose={onClose} />;
}

function QuestDetailDialogInner({ quest, onClose }: { quest: QuestItem; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(cardRef, onClose, closeRef);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/56 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`任务详情：${quest.title}`}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-soft"
      >
        <div className="relative bg-slate-950 p-6 text-white">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="bz-eyebrow-inverse">任务详情</p>
              <h3 className="mt-2 text-display-sm font-semibold">{quest.title}</h3>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              aria-label="关闭任务详情"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
          <div className="rounded-[1.35rem] bg-slate-50 p-4">
            <p className="bz-eyebrow text-fg-muted">任务目标</p>
            <p className="mt-3 text-body font-semibold leading-7 text-fg-default">{quest.target}</p>
          </div>
          <div className="rounded-[1.35rem] bg-brand-subtle p-4">
            <p className="bz-eyebrow text-brand-ink">学习收藏卡</p>
            <p className="mt-3 text-body font-semibold leading-7 text-fg-strong">{quest.reward}</p>
          </div>
          <div className="rounded-[1.35rem] bg-slate-950 p-4 text-white md:col-span-2">
            <p className="bz-eyebrow-inverse">Mr.Brown 提醒</p>
            <p className="mt-3 text-body font-semibold leading-7 text-white/80">{quest.coachNote}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestCardCollection({ items }: { items: QuestCardCollectionView[] }) {
  return (
    <section
      data-quest-reveal
      data-motion-reveal
      data-testid="quest-card-collection"
      className="panel rounded-[2rem] p-5 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-fg-strong">我的卡库</h2>
          </div>
          <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
            卡片只记录学习与复盘轨迹，不改变净值、战力或排行榜。刷新页面后，已经抽到的卡也会继续保留。
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold tabular-nums text-white">
          {items.length} 张已收藏
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const cardTheme = questBoxThemes[stableQuestThemeIndex(item.card.id)];
            const cardNo = String((stableQuestThemeIndex(item.card.id) % 99) + 1).padStart(2, "0");
            const questTitle = typeof item.meta?.questTitle === "string" ? item.meta.questTitle : "任务奖励";
            return (
              <article
                data-motion-card
                data-testid={`collection-card-${item.card.id}`}
                key={`${item.id}-${item.card.id}`}
                className="relative overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-lg shadow-slate-950/5"
              >
                <div className="relative">
                  <QuestCardArt card={item.card} className="rounded-b-none" />
                  {/* 大编号（对齐参考图1 待领取卡的收藏编号），装饰性 → aria-hidden，由下方徽章承载语义 */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1 select-none text-[2.6rem] font-black leading-none text-white/85 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
                  >
                    {cardNo}
                  </span>
                </div>
                {/* 柔和粉彩票券页脚（对齐参考图2 完成态卡：齿孔 + 收藏编号 + 已收藏） */}
                <div className="relative p-4" style={{ background: `linear-gradient(180deg, ${cardTheme.from} 0%, #ffffff 78%)` }}>
                  <div aria-hidden className="absolute -top-1.5 left-3 right-3 flex justify-between">
                    {Array.from({ length: 9 }).map((_, dot) => (
                      <span key={dot} className="h-3 w-3 rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.12)]" />
                    ))}
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-700 shadow-sm">
                    <BadgeCheck className="h-3 w-3 text-[var(--down-700)]" /> 已收藏 · NO.{cardNo}
                  </span>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-fg-strong">{item.card.teachingLine}</p>
                  <div className="mt-3 rounded-[1.1rem] bg-white/72 p-3 text-xs leading-5 text-fg-muted">
                    来自「{cardTheme.world}」· {questTitle}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-base font-bold text-fg-strong">还没有收藏卡片</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-fg-muted">
            完成任务后点击“领取学习卡”，第一张卡片就会加入这里。
          </p>
        </div>
      )}
    </section>
  );
}

// 把一张收藏卡映射到它来源任务的视觉主题（角色 + 渐变）；找不到来源任务时按卡 id 稳定哈希。
function themeForCollectionItem(item: QuestCardCollectionView, quests: QuestItem[]): QuestBoxTheme {
  const questId = questIdFromCard(item);
  const idx = questId ? quests.findIndex((quest) => quest.id === questId) : -1;
  if (idx >= 0) return questBoxThemeFor(quests[idx], idx);
  return questBoxThemes[stableQuestThemeIndex(item.card.id)];
}

// 弹窗可访问性（§13）：初始焦点 + Esc 关闭 + Tab 焦点陷阱 + body 滚动锁 + 关闭归还焦点。复用于奖励弹窗与任务详情弹窗。
function useModalA11y(
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

// 海报式奖励弹窗（对齐参考图「吉祥物获得弹出界面」）：巨号编号 + 大角色名 + 3D 角色英雄 + 醒目渐变底。
function MascotRewardModal({
  item,
  quests,
  onClose,
  onViewCollection,
}: {
  item: QuestCardCollectionView;
  quests: QuestItem[];
  onClose: () => void;
  onViewCollection: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const theme = themeForCollectionItem(item, quests);
  const number = String((stableQuestThemeIndex(item.card.id) % 99) + 1).padStart(2, "0");
  const characterSrc = `${questWorldAssetBase}/characters/${theme.asset}.webp`;

  useModalA11y(cardRef, onClose, closeRef);

  useGSAP(
    () => {
      const reduce =
        typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) {
        gsap.set(cardRef.current, { opacity: 1, scale: 1, y: 0 });
        return;
      }
      const tl = gsap.timeline();
      tl.fromTo(
        cardRef.current,
        { opacity: 0, scale: 0.92, y: 26 },
        { opacity: 1, scale: 1, y: 0, duration: premiumMotion.duration.reward, ease: premiumMotion.ease.reward },
      );
      tl.fromTo(
        "[data-reward-character]",
        { opacity: 0, scale: 0.62, y: 18 },
        { opacity: 1, scale: 1, y: 0, duration: 0.62, ease: "back.out(1.5)" },
        "-=0.3",
      );
      tl.fromTo("[data-reward-number]", { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.5 }, "-=0.5");
    },
    { scope: cardRef },
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`奖励登场：${theme.creature}`}
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-950/74 backdrop-blur-sm" />
      <div
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[2rem] text-white shadow-[0_40px_120px_rgba(2,6,23,0.5)]"
        style={{ background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.via} 54%, ${theme.to} 100%)` }}
      >
        <span
          data-reward-number
          aria-hidden
          className="pointer-events-none absolute -left-3 -top-7 select-none text-[9rem] font-black leading-none text-white/[0.22] sm:text-[13rem]"
        >
          {number}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="关闭奖励弹窗"
          className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur transition hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative grid items-center gap-2 p-7 sm:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] sm:p-9">
          <div className="relative z-10">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-caption font-bold uppercase tracking-[0.2em] backdrop-blur">
              新伙伴加入图鉴 · 第 {number} 张
            </span>
            <h2 className="mt-4 text-display-md font-black leading-[1.05] sm:text-display-lg">{theme.creature}</h2>
            <p className="mt-1 text-h3 font-bold text-white/92">{item.card.name}</p>
            <p className="mt-3 max-w-sm text-body-sm font-medium leading-7 text-white/82">{item.card.teachingLine}</p>
            <p className="mt-3 text-caption font-semibold text-white/72">
              来自「{theme.world}」· 卡片只记录学习轨迹，不代表真实收益
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onViewCollection}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-body-sm font-bold text-slate-950 shadow-[0_14px_30px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Sparkles className="h-4 w-4" /> 查看我的卡库
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center rounded-full border border-white/30 px-5 text-body-sm font-bold text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                继续任务
              </button>
            </div>
          </div>
          <div className="relative flex items-center justify-center">
            <div
              aria-hidden
              className="pointer-events-none absolute h-60 w-60 rounded-full blur-3xl opacity-90"
              style={{ background: theme.glow }}
            />
            <div className="relative z-10 -rotate-2 overflow-hidden rounded-[1.6rem] border-4 border-white/85 bg-white shadow-[0_26px_58px_rgba(0,0,0,0.36)]">
              <Image
                data-reward-character
                src={characterSrc}
                alt={`${theme.creature} 3D 卡通形象，代表 ${theme.world} 任务`}
                width={300}
                height={300}
                className="h-auto w-[clamp(170px,38vw,256px)] object-cover"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/72 px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider text-white backdrop-blur">
                NO.{number}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function QuestStatusBadge({ status }: { status: StudentQuestStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function AchievementBadgeArt({
  achievement,
}: {
  achievement: StudentQuestPayload["achievements"][number];
}) {
  const asset = achievementBadgeAssets[achievement.id] ?? "robot-helper";

  return (
    <div
      data-testid={`achievement-badge-${achievement.id}`}
      data-achievement-unlocked={achievement.unlocked ? "true" : "false"}
      className={cn(
        "relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.45rem] border bg-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition duration-300",
        achievement.unlocked
          ? "border-amber-200 ring-4 ring-amber-100/70"
          : "border-slate-200 opacity-78 grayscale",
      )}
    >
      <Image
        src={`${achievementBadgeAssetBase}/${asset}.webp`}
        alt={`${achievement.title} 3D 成就徽章`}
        fill
        sizes="80px"
        className="object-cover"
      />
      <span
        className={cn(
          "absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 shadow-sm backdrop-blur",
          achievement.unlocked ? "bg-amber-400 text-slate-950" : "bg-slate-900/72 text-white",
        )}
      >
        {achievement.unlocked ? <BadgeCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      </span>
    </div>
  );
}

// 伙伴图鉴（对齐参考图「吉祥物待领取界面」）：12 位学习伙伴的鲜亮竖卡栅格，按收藏点亮，未点亮显剪影。
function CompanionAlbum({
  collection,
  quests,
}: {
  collection: QuestCardCollectionView[];
  quests: QuestItem[];
}) {
  const unlocked = useMemo(() => {
    const set = new Set<string>();
    // 已收藏卡 → 点亮其来源伙伴；完成/已领的任务 → 也点亮对应伙伴（doc §5.5：完成对应任务即解锁）。
    collection.forEach((item) => set.add(themeForCollectionItem(item, quests).id));
    quests.forEach((quest, index) => {
      if (quest.status === "done" || quest.claimed) set.add(questBoxThemeFor(quest, index).id);
    });
    return set;
  }, [collection, quests]);
  const unlockedCount = questBoxThemes.filter((theme) => unlocked.has(theme.id)).length;

  return (
    <section data-quest-reveal data-testid="companion-album" className="panel rounded-[2rem] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-fg-strong">伙伴图鉴</h2>
          </div>
          <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
            每收藏一类任务卡，就点亮一位学习伙伴。未点亮的伙伴以剪影出现，集齐它们记录你的学习足迹。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold tabular-nums text-white">
          这是你的第 {unlockedCount} 位学习伙伴
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {questBoxThemes.map((theme, index) => {
          const isUnlocked = unlocked.has(theme.id);
          return (
            <article
              key={theme.id}
              data-companion-unlocked={isUnlocked ? "true" : "false"}
              aria-label={
                isUnlocked
                  ? `已点亮的学习伙伴：${theme.creature}，来自${theme.world}`
                  : `未点亮的学习伙伴 ${index + 1}，完成对应任务后解锁`
              }
              className={cn(
                "group relative flex aspect-[3/4] flex-col overflow-hidden rounded-[1.3rem] border p-3 shadow-sm transition duration-300",
                isUnlocked ? "border-white/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/15" : "border-slate-200",
              )}
              style={
                isUnlocked
                  ? { background: `linear-gradient(160deg, ${theme.via} 0%, ${theme.to} 100%)` }
                  : { background: "linear-gradient(160deg, #eef2f8 0%, #cbd5e1 100%)" }
              }
            >
              <div className="relative flex flex-1 items-center justify-center">
                <Image
                  src={`${questWorldAssetBase}/characters/${theme.asset}.webp`}
                  alt=""
                  width={150}
                  height={150}
                  className={cn(
                    "h-auto w-[82%] rounded-[1rem] object-cover drop-shadow-[0_12px_24px_rgba(0,0,0,0.24)]",
                    isUnlocked ? "" : "opacity-35 grayscale",
                  )}
                />
                {!isUnlocked ? (
                  <span className="absolute inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/74 text-white backdrop-blur">
                    <Lock className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
              <div className="mt-2">
                <p className={cn("truncate text-sm font-black leading-tight", isUnlocked ? "text-white" : "text-slate-600")}>
                  {isUnlocked ? theme.creature : theme.badge}
                </p>
                <p className={cn("mt-0.5 truncate text-[0.7rem] font-semibold", isUnlocked ? "text-white/82" : "text-slate-500")}>
                  {isUnlocked ? theme.world : "完成任务即可点亮"}
                </p>
              </div>
              <span
                className={cn(
                  "mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider",
                  isUnlocked ? "bg-white/88 text-slate-950" : "bg-slate-200 text-slate-600",
                )}
              >
                {isUnlocked ? (
                  <>
                    <BadgeCheck className="h-3 w-3" /> 已点亮
                  </>
                ) : (
                  <>
                    <Lock className="h-3 w-3" /> 待点亮
                  </>
                )}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function StudentQuestDashboard({
  payload,
  seasonPayload,
  initialCollection = [],
}: {
  payload: StudentQuestPayload;
  seasonPayload: StudentSeasonChallengePayload;
  initialCollection?: QuestCardCollectionView[];
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [questPayload, setQuestPayload] = useState(payload);
  const [season, setSeason] = useState(seasonPayload);
  const [cardCollection, setCardCollection] = useState<QuestCardCollectionView[]>(initialCollection);
  const [filter, setFilter] = useState<QuestFilter>("all");
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(payload.quests[0]?.id ?? null);
  const [detailQuestId, setDetailQuestId] = useState<string | null>(null);
  const [claimingQuestId, setClaimingQuestId] = useState<string | null>(null);
  const [drawingQuestId, setDrawingQuestId] = useState<string | null>(null);
  const [claimingSeason, setClaimingSeason] = useState(false);
  const [claimResult, setClaimResult] = useState<QuestClaimResult | null>(null);
  const [drawResult, setDrawResult] = useState<QuestCardCollectionView | null>(null);
  const [rewardModalItem, setRewardModalItem] = useState<QuestCardCollectionView | null>(null);
  const [seasonClaimResult, setSeasonClaimResult] = useState<SeasonClaimResult | null>(null);
  const [claimError, setClaimError] = useState("");
  const [drawError, setDrawError] = useState("");
  const [flippedQuestIds, setFlippedQuestIds] = useState<ReadonlySet<string>>(() => new Set());

  const { contextSafe } = useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-quest-reveal], [data-calendar-cell]", {
          autoAlpha: 1,
          clearProps: "transform,opacity,visibility",
        });
        gsap.set("[data-quest-card-inner]", { rotateY: 0, transformPerspective: 900 });
        return;
      }

      gsap.fromTo(
        "[data-quest-reveal]",
        { autoAlpha: 0, y: 20 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.62,
          ease: "power3.out",
          stagger: 0.055,
          clearProps: "transform,opacity,visibility",
        },
      );
      gsap.fromTo(
        "[data-calendar-cell]",
        { autoAlpha: 0, scale: 0.86 },
        {
          autoAlpha: 1,
          scale: 1,
          duration: 0.5,
          ease: "back.out(1.4)",
          stagger: 0.025,
          clearProps: "transform,opacity,visibility",
        },
      );

      gsap.fromTo(
        "[data-route-node]",
        { autoAlpha: 0, y: 18, scale: 0.94, rotate: -1.5 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          rotate: 0,
          duration: 0.58,
          ease: "back.out(1.45)",
          stagger: 0.06,
          clearProps: "transform,opacity,visibility",
        },
      );

      gsap.fromTo(
        "[data-objective-creature], [data-queue-creature-card]",
        { autoAlpha: 0, y: 14, scale: 0.96 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.52,
          ease: "power3.out",
          stagger: 0.04,
          clearProps: "transform,opacity,visibility",
        },
      );

      gsap.fromTo(
        "[data-habitat-token]",
        { autoAlpha: 0, y: 10, scale: 0.9 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.48,
          ease: "back.out(1.7)",
          stagger: 0.055,
          clearProps: "transform,opacity,visibility",
        },
      );

      gsap.fromTo(
        "[data-motion-viz-bar]",
        { scaleX: 0, transformOrigin: "left center" },
        {
          scaleX: 1,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.035,
          clearProps: "transform",
        },
      );

      const floatTargets = gsap.utils.toArray<HTMLElement>("[data-creature-float]").slice(0, 18);
      gsap.to(floatTargets, {
        y: -5,
        rotate: 1.2,
        duration: 2.4,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
        stagger: { each: 0.13, from: "random" },
      });
    },
    { scope: rootRef },
  );

  const animateQuestCard = contextSafe((questId: string, nextFlipped: boolean) => {
    setFlippedQuestIds((current) => {
      const next = new Set(current);
      if (nextFlipped) {
        next.add(questId);
      } else {
        next.delete(questId);
      }
      return next;
    });

    const card = rootRef.current?.querySelector<HTMLElement>(`[data-quest-card-inner="${questId}"]`);
    if (!card) return;

    const targetRotation = nextFlipped ? 180 : 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(card, { rotateY: targetRotation, transformPerspective: 900 });
      return;
    }

    gsap.to(card, {
      rotateY: targetRotation,
      transformPerspective: 900,
      duration: premiumMotion.duration.reward,
      ease: premiumMotion.ease.reward,
    });
  });

  const toggleQuestFlip = contextSafe((questId: string) => {
    animateQuestCard(questId, !flippedQuestIds.has(questId));
  });

  const visibleQuests = useMemo(() => {
    if (filter === "all") return questPayload.quests;
    if (filter === "done") return questPayload.quests.filter((quest) => quest.status === "done");
    if (filter === "watch") {
      return questPayload.quests.filter((quest) => quest.status === "watch" || quest.status === "locked");
    }
    return questPayload.quests.filter((quest) => quest.status === "active");
  }, [filter, questPayload.quests]);

  const completionRate =
    questPayload.overview.total > 0 ? questPayload.overview.completed / questPayload.overview.total : 0;

  const collectionByQuestId = useMemo(() => {
    const next = new Map<string, QuestCardCollectionView>();
    for (const item of cardCollection) {
      const questId = questIdFromCard(item);
      if (questId && !next.has(questId)) next.set(questId, item);
    }
    return next;
  }, [cardCollection]);

  const detailQuest = useMemo(
    () => questPayload.quests.find((quest) => quest.id === detailQuestId) ?? null,
    [detailQuestId, questPayload.quests],
  );
  const selectedVisibleQuest = useMemo(() => {
    if (visibleQuests.length === 0) return null;
    return visibleQuests.find((quest) => quest.id === selectedQuestId) ?? visibleQuests[0];
  }, [selectedQuestId, visibleQuests]);
  const queuedVisibleQuests = useMemo(
    () => visibleQuests.filter((quest) => quest.id !== selectedVisibleQuest?.id),
    [selectedVisibleQuest?.id, visibleQuests],
  );

  useGSAP(
    () => {
      if (!selectedVisibleQuest || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const missionCard = rootRef.current?.querySelector<HTMLElement>("[data-selected-mission-card]");
      if (missionCard) {
        gsap.fromTo(
          missionCard,
          { y: 10, scale: 0.985, autoAlpha: 0.92 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.36,
            ease: "power3.out",
            clearProps: "transform,opacity,visibility",
          },
        );
      }

      gsap.fromTo(
        "[data-queue-creature-card]",
        { x: 12, autoAlpha: 0.72 },
        {
          x: 0,
          autoAlpha: 1,
          duration: 0.34,
          ease: "power2.out",
          stagger: 0.035,
          clearProps: "transform,opacity,visibility",
        },
      );

      gsap.fromTo(
        "[data-habitat-token]",
        { scale: 0.94 },
        {
          scale: 1,
          duration: 0.28,
          ease: "back.out(1.6)",
          stagger: 0.035,
          clearProps: "transform",
        },
      );
    },
    { scope: rootRef, dependencies: [selectedVisibleQuest?.id, filter] },
  );

  function addCollectionItem(item: QuestCardCollectionView) {
    const questId = questIdFromCard(item);
    setCardCollection((current) => {
      const next = current.filter((existing) => {
        if (existing.id === item.id || existing.cardId === item.cardId) return false;
        return questId ? questIdFromCard(existing) !== questId : true;
      });
      return [item, ...next];
    });
  }

  async function drawQuestCard(questId: string) {
    const existing = collectionByQuestId.get(questId);
    if (existing) {
      setDrawResult(existing);
      setRewardModalItem(existing);
      animateQuestCard(questId, true);
      return existing;
    }
    if (drawingQuestId) return null;

    setDrawingQuestId(questId);
    setDrawError("");
    try {
      const response = await fetch("/api/student/quests/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId, source: "quest_claim" }),
      });
      const data = (await response.json()) as DrawQuestCardResponse;
      if (!response.ok || !data.card || !data.collectionItem) {
        throw new Error(data.message || "学习卡领取失败，请稍后再试。");
      }

      const item: QuestCardCollectionView = { ...data.collectionItem, card: data.card };
      addCollectionItem(item);
      setDrawResult(item);
      setRewardModalItem(item);
      animateQuestCard(questId, true);
      return item;
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : "学习卡领取失败，请稍后再试。");
      return null;
    } finally {
      setDrawingQuestId(null);
    }
  }

  async function claimQuest(questId: string) {
    setClaimingQuestId(questId);
    setClaimError("");
    setDrawError("");
    try {
      const response = await fetch("/api/student/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      });
      const data = (await response.json()) as {
        payload?: StudentQuestPayload;
        claimed?: QuestClaimResult;
        message?: string;
      };
      if (!response.ok || !data.payload || !data.claimed) {
        throw new Error(data.message || "任务奖励领取失败，请稍后再试。");
      }
      setQuestPayload(data.payload);
      setClaimResult(data.claimed);
      await drawQuestCard(questId);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "任务奖励领取失败，请稍后再试。");
    } finally {
      setClaimingQuestId(null);
    }
  }

  async function claimSeasonReward() {
    setClaimingSeason(true);
    setClaimError("");
    try {
      const response = await fetch("/api/student/season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: season.id }),
      });
      const data = (await response.json()) as {
        payload?: StudentSeasonChallengePayload;
        claimed?: SeasonClaimResult;
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.payload || !data.claimed) {
        throw new Error(data.message ?? "赛季奖励领取失败，请稍后重试。");
      }
      setSeason(data.payload);
      setSeasonClaimResult(data.claimed);
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "赛季奖励领取失败，请稍后再试。");
    } finally {
      setClaimingSeason(false);
    }
  }

  return (
    <div ref={rootRef} className="space-y-6">
      <section data-quest-reveal data-motion-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <p className="bz-eyebrow-inverse">任务中心</p>
            <h1 className="mt-3 max-w-3xl text-display-lg font-semibold md:text-display-xl">
              把理财好习惯变成可完成的任务
            </h1>
            <p className="mt-4 max-w-3xl text-body-lg leading-8 text-white/68">
              这里不会直接给战力加分，而是把你的学习、交易、现金管理和复盘行为变成可见目标。好任务让你知道下一步练什么，也让每次打开沙盘都有明确方向。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">任务完成度</p>
                <p className="mt-3 text-hero-num tabular-nums text-white">
                  {questPayload.overview.completed}/{questPayload.overview.total}
                </p>
                <div {...progressAria("任务完成度", completionRate * 100)} className="mt-4 h-2.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-up"
                    style={{ width: `${Math.max(6, completionRate * 100)}%` }}
                  />
                </div>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">净值连升</p>
                <p className="mt-3 text-h2 tabular-nums text-white">
                  {questPayload.overview.streakCurrent}
                  <span className="mx-2 text-h3 text-white/70">/</span>
                  {questPayload.overview.streakBest}
                </p>
                <p className="mt-3 text-sm text-white/58">当前 / 历史最佳连续回合</p>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">学习进度</p>
                <p className="mt-3 text-h2 tabular-nums text-white">
                  {questPayload.overview.learningCompleted}
                  <span className="mx-2 text-h3 text-white/70">/</span>
                  {questPayload.overview.learningTotal}
                </p>
                <p className="mt-3 text-sm text-white/58">课程模块完成数</p>
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="bz-eyebrow-inverse">Mr.Brown</p>
                <h2 className="mt-3 text-h1 font-semibold text-white">{questPayload.coach.title}</h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-warm" />
            </div>
            <p className="mt-4 text-body leading-8 text-white/68">{questPayload.coach.summary}</p>
            <div className="mt-6 space-y-3">
              {questPayload.coach.nextActions.map((action, index) => (
                <div key={action} data-motion-card className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-slate-950">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold leading-6 text-white/74">{action}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              data-motion-button
              href="/student"
              /* `!text-fg-default`: the un-layered base rule `a { color: inherit }` (globals.css)
                 otherwise beats layered text utilities and leaks the dark hero's white onto this
                 amber CTA (white-on-amber ≈ 2.5:1, fails AA). The important dark ink wins → ~8:1. */
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold !text-fg-default transition hover:-translate-y-0.5 hover:shadow-glow"
            >
              回到策略台执行
              <ArrowRight className="h-4 w-4" />
            </Link>
            {claimResult && (
              <div
                role="status"
                data-testid="quest-claim-result"
                className="mt-5 rounded-[1.35rem] border border-brand/25 bg-brand/12 p-4"
              >
                <p className="text-sm font-bold text-brand-warm">奖励已领取</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/74">
                  {claimResult.reward} 已加入成长轨迹。奖励只做装饰，不改变战力或净值。
                </p>
              </div>
            )}
            {drawResult && (
              <div
                role="status"
                data-testid="quest-draw-result"
                className="mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.08] p-4"
              >
                <p className="text-sm font-bold text-brand-warm">已加入卡库</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                  你收藏了 {drawResult.card.name}。这张卡已加入“我的卡库”，只记录学习轨迹，不改变净值、战力或排行榜。
                </p>
              </div>
            )}
            {claimError && (
              <p role="alert" className="mt-4 rounded-2xl bg-error-soft p-4 text-sm font-bold text-error">
                {claimError}
              </p>
            )}
            {drawError && (
              <p role="alert" className="mt-4 rounded-2xl bg-error-soft p-4 text-sm font-bold text-error">
                {drawError}
              </p>
            )}
          </aside>
        </div>
      </section>

      <section
        data-quest-reveal
        data-motion-reveal
        data-testid="activity-benefit-center"
        className="panel overflow-hidden rounded-[2rem] p-0"
      >
        <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white md:px-7 md:py-7">
            <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
            <div className="pointer-events-none absolute -right-20 top-0 h-52 w-52 rounded-full bg-brand/25 blur-3xl" />
            <div className="relative z-10">
              <p className="bz-eyebrow-inverse">活动架</p>
              <h2 className="mt-3 text-display-md font-semibold md:text-display-lg">
                {questPayload.benefits.title}
              </h2>
              <p className="mt-4 text-body leading-8 text-white/68">{questPayload.benefits.summary}</p>
              <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-warm" />
                  <p className="text-sm font-semibold leading-6 text-white/68">
                    {questPayload.benefits.guardrail}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 bg-white p-5 md:p-6 xl:grid-cols-2 2xl:grid-cols-3">
            {questPayload.benefits.items.map((item) => {
              const meta = benefitKindMeta[item.kind];
              const Icon = meta.icon;
              return (
                <Link
                  data-motion-card
                  key={item.id}
                  href={item.href}
                  className="group flex min-h-[236px] flex-col rounded-[1.55rem] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-1 hover:border-brand/30 hover:bg-brand-subtle hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", meta.className)}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-fg-muted">
                      {benefitStatusLabel[item.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex-1">
                    <p className="bz-eyebrow bz-brand-text-on-light">{item.label}</p>
                    <h3 className="mt-2 text-h2 text-fg-strong">{item.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-fg-muted">
                      {item.summary}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-semibold text-fg-muted">
                      <span>{item.reward}</span>
                      <span className="tabular-nums">{Math.round(item.progress * 100)}%</span>
                    </div>
                    <div {...progressAria(`${item.reward} 进度`, item.progress * 100)} data-motion-viz className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                      <div
                        data-motion-viz-bar
                        data-motion-origin="left center"
                        className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-up"
                        style={{ width: `${Math.max(item.status === "locked" ? 0 : 8, item.progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-fg-muted">{item.guardrail}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
                      {item.actionLabel}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        data-quest-reveal
        data-motion-reveal
        data-testid="quest-season-challenge"
        className="panel overflow-hidden rounded-[2rem] p-0"
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white md:px-7 md:py-7">
            <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
            <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-brand/25 blur-3xl" />
            <div className="relative z-10">
              <p className="bz-eyebrow-inverse">赛季任务</p>
              <h2 className="mt-3 max-w-xl text-display-md font-semibold md:text-display-lg">
                {season.title}
              </h2>
              <p className="mt-4 max-w-2xl text-body leading-8 text-white/68">{season.summary}</p>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-white/62">赛季完成度</span>
                  <span className="text-sm font-semibold tabular-nums text-brand-warm">
                    {season.completedObjectives}/{season.totalObjectives} · {season.progress}%
                  </span>
                </div>
                <div {...progressAria("赛季完成度", season.progress)} data-motion-viz className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    data-motion-viz-bar
                    data-motion-origin="left center"
                    className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-up"
                    style={{ width: `${season.progress}%` }}
                  />
                </div>
              </div>

              <button
                data-motion-button
                type="button"
                data-testid="quest-season-claim"
                onClick={() => void claimSeasonReward()}
                disabled={!season.claimable || season.claimed || claimingSeason}
                className={cn(
                  "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition md:w-auto",
                  season.claimable
                    ? "bg-brand text-slate-950 shadow-glow hover:-translate-y-0.5"
                    : season.claimed
                      ? "bg-white text-slate-950"
                      : "cursor-not-allowed bg-white/10 text-white/70",
                )}
              >
                {claimingSeason ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : season.claimed ? (
                  <BadgeCheck className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {season.claimed ? "已领取赛季装饰奖励" : season.claimable ? `领取${season.reward}` : `完成后解锁${season.reward}`}
              </button>
              {seasonClaimResult ? (
                <p className="mt-4 rounded-[1.2rem] border border-up/20 bg-up/10 px-4 py-3 text-sm font-bold leading-6 text-up">
                  {seasonClaimResult.summary}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 bg-white p-5 md:p-6 xl:grid-cols-2">
            {season.objectives.map((objective, index) => (
              <SeasonObjectiveCreatureCard key={objective.id} objective={objective} index={index} />
            ))}
          </div>
        </div>
      </section>

      <QuestCommanderPanel quests={questPayload.quests} selectedQuestId={selectedQuestId} onSelect={setSelectedQuestId} />

      <section data-quest-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-fg-strong">任务锦囊栏</h2>
            </div>
            <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
              正面只保留航线、状态和进度，打开后再查看任务目标、导师提示和学习收藏卡。需要更多解释时点“详情”。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterLabels.map((item) => (
              <button
                data-motion-button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "min-h-10 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  filter === item.id
                    ? "border-border-brand bg-brand text-slate-950 shadow-glow"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {visibleQuests.length > 0 ? (
          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
            {(selectedVisibleQuest ? [selectedVisibleQuest] : []).map((quest) => {
              const isFlipped = flippedQuestIds.has(quest.id);
              const collectedCard = collectionByQuestId.get(quest.id);
              const isQuestBusy = claimingQuestId === quest.id || drawingQuestId === quest.id;
              const canDraw = quest.claimable || quest.claimed;
              const selected = selectedQuestId === quest.id;
              const tone = questCategoryTone[quest.category] ?? questCategoryTone.review;
              const visualIndex = Math.max(0, visibleQuests.findIndex((item) => item.id === quest.id));

              return (
                <article
                  data-motion-card
                  data-selected-mission-card
                  data-testid={`quest-card-${quest.id}`}
                  key={quest.id}
                  className={cn(
                    "min-h-[42rem] lg:min-h-[44rem] rounded-[1.7rem] [perspective:1200px]",
                    selected && "ring-2 ring-brand ring-offset-4 ring-offset-white",
                  )}
                >
                  <div
                    data-quest-card-inner={quest.id}
                    className="relative min-h-[42rem] rounded-[1.7rem] lg:min-h-[44rem]"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      data-testid={`quest-card-front-${quest.id}`}
                      aria-hidden={isFlipped}
                      inert={isFlipped}
                      className="absolute inset-0 flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-slate-200/80 bg-[linear-gradient(145deg,#fffaf2,white_45%,#eef6ff)] p-5 shadow-lg shadow-slate-950/5"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand/16 blur-3xl" />
                      <div className="pointer-events-none absolute bottom-14 left-10 h-14 w-14 rounded-full bg-down/18 blur-xl" />
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="bz-eyebrow bz-brand-text-on-light">任务锦囊</p>
                          <h3 className="mt-2 text-h2 text-fg-strong">第 {visualIndex + 1} 号任务锦囊</h3>
                        </div>
                        <QuestStatusBadge status={quest.status} />
                      </div>
                      <div className="relative z-10 mt-5 flex flex-1 items-center justify-center">
                        <QuestBlindBoxArt quest={quest} index={visualIndex} />
                      </div>
                      <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone.className)}>
                          {questCategoryLabel(quest.category)}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-fg-muted">{Math.round(quest.progress * 100)}%</span>
                      </div>
                      <div {...progressAria(`${questCategoryLabel(quest.category)} 进度`, quest.progress * 100)} data-motion-viz className="relative z-10 mt-3 h-3 rounded-full bg-slate-100">
                        <div
                          data-motion-viz-bar
                          data-motion-origin="left center"
                          className={cn(
                            "h-full rounded-full",
                            quest.status === "watch"
                              ? "bg-warning"
                              : quest.status === "locked"
                                ? "bg-slate-300"
                                : "bg-gradient-to-r from-brand to-down",
                          )}
                          style={{ width: `${Math.max(quest.status === "locked" ? 0 : 8, quest.progress * 100)}%` }}
                        />
                      </div>
                      <button
                        data-motion-button
                        type="button"
                        data-testid={`quest-flip-${quest.id}`}
                        aria-pressed={isFlipped}
                        onClick={() => toggleQuestFlip(quest.id)}
                        className="relative z-10 mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <PackageOpen className="h-4 w-4" />
                        打开任务锦囊
                      </button>
                    </div>

                    <div
                      data-testid={`quest-card-back-${quest.id}`}
                      aria-hidden={!isFlipped}
                      inert={!isFlipped}
                      className="absolute inset-0 flex h-full flex-col rounded-[1.7rem] border border-brand/30 bg-slate-950 p-5 text-white shadow-glow"
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">任务卡</p>
                          <h3 className="mt-2 text-h2 font-bold text-white">{quest.title}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                          返回任务
                        </button>
                      </div>
                      <div className="mt-5 grid gap-3">
                        <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.08] p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/48">任务目标</p>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white/82">{quest.target}</p>
                        </div>
                        <div className="rounded-[1.3rem] border border-brand/25 bg-brand/12 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-warm">学习收藏卡</p>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white">{quest.reward}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailQuestId(quest.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                          <Eye className="h-4 w-4" />
                          查看任务详情
                        </button>
                      </div>
                      {collectedCard ? (
                        <div
                          data-testid={`quest-drawn-card-${quest.id}`}
                          className="mt-4 rounded-[1.3rem] border border-brand/30 bg-brand/12 p-4"
                        >
                          <QuestCardArt card={collectedCard.card} compact className="mb-4" />
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-warm">
                                {rarityMeta[collectedCard.card.rarity].label}
                              </p>
                              <h4 className="mt-1 text-lg font-bold text-white">{collectedCard.card.name}</h4>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-brand-warm" />
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white/76">
                            {collectedCard.card.teachingLine}
                          </p>
                        </div>
                      ) : (
                        <div className="hidden sm:block">
                          <QuestCardBackArt rarity="common" />
                        </div>
                      )}
                      <p className="mt-3 text-[11px] font-semibold leading-5 text-white/55">
                        完成任务即可获得对应卡片 · 仅作学习收藏，不改变净值、战力或排行榜。
                      </p>
                      <button
                        data-motion-button
                        type="button"
                        data-testid={`quest-claim-${quest.id}`}
                        onClick={() => {
                          if (quest.claimable) {
                            void claimQuest(quest.id);
                            return;
                          }
                          void drawQuestCard(quest.id);
                        }}
                        disabled={!canDraw || Boolean(collectedCard) || claimingQuestId !== null || drawingQuestId !== null}
                        aria-busy={isQuestBusy}
                        className={cn(
                          "mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                          canDraw && !collectedCard
                            ? "bg-brand text-slate-950 shadow-glow hover:-translate-y-0.5"
                            : collectedCard
                              ? "bg-white text-slate-950"
                              : "cursor-not-allowed bg-white/12 text-white/55",
                        )}
                      >
                        {isQuestBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            领取中...
                          </>
                        ) : collectedCard ? (
                          `已收藏 ${collectedCard.card.name}`
                        ) : quest.claimable ? (
                          "领取学习卡"
                        ) : quest.claimed ? (
                          "查看已收藏的卡"
                        ) : (
                          "完成后可领取"
                        )}
                      </button>
                    </div>
                  </div>
                  {/* §5.3：栖息地架填补锦囊主卡下方空白（移出定高翻卡，避免裁切翻盒按钮） */}
                  {/* 进度分母用全量任务（非筛选切片），避免切到"已完成"时植物伪造发光果实 */}
                  <MissionHabitatShelf quests={questPayload.quests} selectedQuestId={quest.id} />
                </article>
              );
            })}
            </div>
            <aside data-testid="quest-queue-panel" className="rounded-[1.7rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">任务队列</p>
                  <h3 className="mt-2 text-h2 font-bold text-white">任务队列</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white/70">
                  {visibleQuests.length} 个锦囊
                </span>
              </div>
              <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/[0.07] p-4">
                <p className="text-sm font-semibold text-white">流程</p>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-white/68">
                  <span>1. 对话领取航线</span>
                  <span>2. 打开当前锦囊</span>
                  <span>3. 翻到背面看任务</span>
                  <span>4. 完成后领取学习卡片</span>
                </div>
              </div>
              <div className="relative mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 shadow-inner shadow-black/10">
                <div className="pointer-events-none absolute left-2 right-4 top-2 z-10 h-8 rounded-t-[1.1rem] bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent" />
                <div
                  data-testid="quest-queue-scroll"
                  className="quest-glass-scroll max-h-[20rem] space-y-3 overflow-y-auto overscroll-contain pb-2 pr-2 pt-1"
                  aria-label="任务队列，可向下滑动查看更多任务锦囊"
                >
                  {queuedVisibleQuests.length > 0 ? (
                    queuedVisibleQuests.map((quest) => {
                      const visualIndex = Math.max(0, visibleQuests.findIndex((item) => item.id === quest.id));
                      return <MiniQuestCreatureCard key={quest.id} quest={quest} index={visualIndex} onSelect={setSelectedQuestId} />;
                    })
                  ) : (
                    <p className="rounded-[1.2rem] border border-white/10 bg-white/[0.07] p-4 text-sm font-semibold leading-6 text-white/62">
                      当前筛选下只有这个任务。切换上方分类可以查看其他锦囊。
                    </p>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <span data-testid="quest-queue-scroll-hint" className="rounded-full border border-white/12 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/72 shadow-sm backdrop-blur-md">
                    向下滑动查看更多
                  </span>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <p className="mt-6 rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-fg-muted">
            该分类暂时没有任务，去完成更多沙盘动作来解锁吧。
          </p>
        )}
      </section>

      <QuestCardCollection items={cardCollection} />

      <CompanionAlbum collection={cardCollection} quests={questPayload.quests} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand" />
              <div>
                <h2 className="text-h1 font-semibold text-fg-strong">收益日历</h2>
                <p className="mt-1 text-sm font-semibold text-fg-muted">
                  更新时间：{formatGeneratedAt(questPayload.generatedAt)}（北京时间）
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-subtle px-4 py-2 text-sm font-bold text-brand-ink">
              {questPayload.overview.stageLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {questPayload.calendar.map((day) => (
              <article
                key={day.round}
                data-calendar-cell
                className={cn(
                  "rounded-[1.35rem] border p-4",
                  day.tone === "up" && "border-up/20 bg-up-soft",
                  day.tone === "down" && "border-down/20 bg-down-soft",
                  day.tone === "flat" && "border-slate-200 bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-fg-strong">第 {day.round} 回合</p>
                  <span className="text-xs font-semibold text-fg-muted">{day.label}</span>
                </div>
                <p className="mt-3 text-xl font-bold tabular-nums">
                  <MoneyText>{formatCurrency(day.netWorth)}</MoneyText>
                </p>
                <p className="mt-2 text-sm font-semibold tabular-nums">
                  <MoneyText>{formatCurrency(day.delta)}</MoneyText>
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside data-testid="achievement-wall" data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-fg-strong">成就墙</h2>
          </div>
          <p className="mt-2 text-body leading-7 text-fg-muted">
            成就只代表学习轨迹，不代表真实投资能力，也不会直接改变榜单战力。
          </p>
          <div className="mt-5 space-y-3">
            {questPayload.achievements.map((achievement) => (
              <article
                key={achievement.id}
                className={cn(
                  "group rounded-[1.55rem] border p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/8",
                  achievement.unlocked
                    ? "border-border-brand bg-gradient-to-br from-amber-50 via-white to-orange-50"
                    : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100",
                )}
              >
                <div className="flex items-center gap-4">
                  <AchievementBadgeArt achievement={achievement} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-fg-strong">{achievement.title}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          achievement.unlocked ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {achievement.unlocked ? "已点亮" : "待解锁"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-fg-muted">{achievement.detail}</p>
                    <p className="mt-2 rounded-full bg-white/76 px-3 py-1.5 text-xs font-semibold text-brand-ink shadow-inner shadow-slate-950/5">
                      {achievement.decorativeReward}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
      <QuestDetailDialog quest={detailQuest} onClose={() => setDetailQuestId(null)} />
      {rewardModalItem ? (
        <MascotRewardModal
          key={rewardModalItem.id}
          item={rewardModalItem}
          quests={questPayload.quests}
          onClose={() => setRewardModalItem(null)}
          onViewCollection={() => {
            setRewardModalItem(null);
            if (typeof document !== "undefined") {
              document
                .querySelector('[data-testid="quest-card-collection"]')
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
        />
      ) : null}
    </div>
  );
}
