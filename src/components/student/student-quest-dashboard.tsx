"use client";

import { type CSSProperties, useMemo, useRef, useState } from "react";
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

const rarityMeta: Record<QuestCard["rarity"], { label: string; className: string }> = {
  common: { label: "COMMON", className: "border-slate-200 bg-slate-50 text-slate-700" },
  rare: { label: "RARE", className: "border-brand/25 bg-brand-subtle text-brand-ink" },
  epic: { label: "EPIC", className: "border-warning/35 bg-warning/10 text-warning" },
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
        <span className={cn("w-fit rounded-full border px-3 py-1 text-xs font-black", meta.className)}>
          {meta.label}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-warm">{card.artKey}</p>
          <h3 className="mt-2 text-h2 font-black text-white">{card.name}</h3>
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
          src={`${questCardAssetBase}/front-${card.id}.png`}
          alt={`${card.name} 卡面插画`}
          fill
          sizes={compact ? "(min-width: 1280px) 260px, 70vw" : "(min-width: 1280px) 320px, (min-width: 768px) 45vw, 92vw"}
          className="object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/18 to-transparent" />
      <div className={cn("relative z-10 flex flex-col justify-between p-4", compact ? "min-h-36" : "min-h-44")}>
        <span className={cn("w-fit rounded-full border px-3 py-1 text-xs font-black shadow-sm", meta.className)}>
          {meta.label}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-warm">{card.artKey}</p>
          <h3 className={cn("mt-2 font-black text-white", compact ? "text-lg" : "text-h2")}>{card.name}</h3>
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
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-warm">Decorative Card</p>
        <p className="mt-1 text-sm font-black text-white">完成任务后揭晓</p>
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
    creature: "狮子裁判",
    world: "战力赛场",
    badge: "排名挑战",
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
      aria-label={`${theme.creature} ${theme.world} 任务盲盒卡面`}
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
              "rounded-full bg-white/72 font-black text-[var(--quest-ink)] shadow-sm backdrop-blur",
              compact ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
            )}
          >
            {theme.badge}
          </span>
          {!compact ? (
            <span className="rounded-full bg-slate-950/74 px-3 py-1 text-xs font-black text-white">#{index + 1}</span>
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
            <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">Unique Mission Skin</p>
            <p className="mt-1 text-lg font-black">{theme.world}</p>
            <p className="mt-1 line-clamp-1 text-xs font-bold opacity-70">每个任务都有独立 3D 角色图案，拆开后再显示目标。</p>
          </div>
        ) : null}
      </div>
    </div>
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
            src={`${questWorldAssetBase}/commander-mission.png`}
            alt="任务指挥官、盲盒与动物行星插画"
            fill
            sizes="(min-width: 1280px) 520px, 92vw"
            className="object-cover opacity-90"
            priority
            data-testid="quest-commander-image"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/58 to-slate-950/10" />
          <div className="relative z-10 flex min-h-[320px] flex-col justify-between p-6 md:p-7">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-brand-warm">Commander Briefing</p>
              <h2 className="mt-3 max-w-lg text-display-md font-semibold md:text-display-lg">先和指挥官对话，再拆开任务盲盒</h2>
              <p className="mt-4 max-w-xl text-body leading-8 text-white/74">
                任务不会一股脑摊开。先选择一条训练航线，拆开盲盒后再查看任务目标、复盘提示和神秘装饰奖励。
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
              <p className="text-sm font-black uppercase tracking-[0.18em] text-brand">Mission Route</p>
              <h3 className="mt-2 text-h1 font-semibold text-slate-950">选择今日任务航线</h3>
            </div>
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
              {selected ? questCategoryLabel(selected.category) : "待选择"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {recommended.map((quest, index) => {
              const active = quest.id === selectedQuestId;
              const tone = questCategoryTone[quest.category] ?? questCategoryTone.review;
              return (
                <button
                  key={quest.id}
                  type="button"
                  onClick={() => onSelect(quest.id)}
                  className={cn(
                    "rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5",
                    active ? "border-brand bg-white shadow-soft" : "border-slate-200 bg-white/70 hover:border-brand/35",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn("rounded-full px-3 py-1 text-xs font-black", tone.className)}>
                      航线 {index + 1}
                    </span>
                    <QuestStatusBadge status={quest.status} />
                  </div>
                  <p className="mt-4 text-base font-black text-slate-950">
                    {quest.claimable ? "可领取盲盒" : quest.claimed ? "已收藏轨迹" : "训练中盲盒"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">
                    {quest.claimable ? "拆开即可查看任务卡和奖励。" : quest.target}
                  </p>
                </button>
              );
            })}
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/56 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-soft">
        <div className="relative bg-slate-950 p-6 text-white">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-brand-warm">Mission Detail</p>
              <h3 className="mt-2 text-display-sm font-semibold">{quest.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label="关闭任务详情"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 md:p-6">
          <div className="rounded-[1.35rem] bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">任务目标</p>
            <p className="mt-3 text-body font-bold leading-7 text-slate-800">{quest.target}</p>
          </div>
          <div className="rounded-[1.35rem] bg-brand-subtle p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-ink">神秘奖励</p>
            <p className="mt-3 text-body font-bold leading-7 text-slate-900">{quest.reward}</p>
          </div>
          <div className="rounded-[1.35rem] bg-slate-950 p-4 text-white md:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-warm">Mr.Brown 提醒</p>
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
            <h2 className="text-h1 font-semibold text-slate-950">我的卡库</h2>
          </div>
          <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
            卡片只记录学习与复盘轨迹，不改变净值、战力或排行榜。刷新页面后，已经抽到的卡也会继续保留。
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
          {items.length} 张已收藏
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            return (
              <article
                data-motion-card
                data-testid={`collection-card-${item.card.id}`}
                key={`${item.id}-${item.card.id}`}
                className="group overflow-hidden rounded-[1.55rem] border border-slate-200 bg-white shadow-lg shadow-slate-950/5"
              >
                <QuestCardArt card={item.card} className="rounded-b-none" />
                <div className="p-4">
                  <p className="line-clamp-3 text-sm font-semibold leading-6 text-slate-600">{item.card.teachingLine}</p>
                  <div className="mt-4 rounded-[1.1rem] bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
                    来源任务：{typeof item.meta?.questTitle === "string" ? item.meta.questTitle : "任务奖励"}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-base font-black text-slate-950">还没有收藏卡片</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            完成任务后点击“领取并抽卡”，第一张装饰卡就会加入这里。
          </p>
        </div>
      )}
    </section>
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
        throw new Error(data.message || "装饰卡抽取失败，请稍后再试。");
      }

      const item: QuestCardCollectionView = { ...data.collectionItem, card: data.card };
      addCollectionItem(item);
      setDrawResult(item);
      animateQuestCard(questId, true);
      return item;
    } catch (error) {
      setDrawError(error instanceof Error ? error.message : "装饰卡抽取失败，请稍后再试。");
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
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Quest Hub</p>
            <h1 className="mt-3 max-w-3xl text-display-lg font-semibold md:text-display-xl">
              把理财好习惯变成可完成的任务
            </h1>
            <p className="mt-4 max-w-3xl text-body-lg leading-8 text-white/68">
              这里不会直接给战力加分，而是把你的学习、交易、现金管理和复盘行为变成可见目标。好任务让你知道下一步练什么，也让每次打开沙盘都有明确方向。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">任务完成度</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.completed}/{questPayload.overview.total}
                </p>
                <div className="mt-4 h-2.5 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-up"
                    style={{ width: `${Math.max(6, completionRate * 100)}%` }}
                  />
                </div>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">净值连升</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.streakCurrent}
                  <span className="mx-2 text-h2 text-white/70">/</span>
                  {questPayload.overview.streakBest}
                </p>
                <p className="mt-3 text-sm text-white/58">当前 / 历史最佳连续回合</p>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/56">学习进度</p>
                <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                  {questPayload.overview.learningCompleted}
                  <span className="mx-2 text-h2 text-white/70">/</span>
                  {questPayload.overview.learningTotal}
                </p>
                <p className="mt-3 text-sm text-white/58">课程模块完成数</p>
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">Mr.Brown</p>
                <h2 className="mt-3 text-h1 font-semibold text-white">{questPayload.coach.title}</h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-warm" />
            </div>
            <p className="mt-4 text-body leading-8 text-white/68">{questPayload.coach.summary}</p>
            <div className="mt-6 space-y-3">
              {questPayload.coach.nextActions.map((action, index) => (
                <div key={action} data-motion-card className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-slate-950">
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
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-slate-950 transition hover:-translate-y-0.5 hover:shadow-glow"
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
                <p className="text-sm font-black text-brand-warm">奖励已领取</p>
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
                <p className="text-sm font-black text-brand-warm">抽卡揭晓</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                  你抽到了 {drawResult.card.name}（{rarityMeta[drawResult.card.rarity].label}）。这张卡已加入“我的卡库”，只做装饰与复盘记录。
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
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Activity Shelf</p>
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
                    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black", meta.className)}>
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                      {benefitStatusLabel[item.status]}
                    </span>
                  </div>
                  <div className="mt-4 flex-1">
                    <p className="bz-brand-text-on-light text-xs font-black uppercase tracking-[0.18em]">{item.label}</p>
                    <h3 className="mt-2 text-h2 font-black text-slate-950">{item.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-600">
                      {item.summary}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-600">
                      <span>{item.reward}</span>
                      <span>{Math.round(item.progress * 100)}%</span>
                    </div>
                    <div data-motion-viz className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                      <div
                        data-motion-viz-bar
                        data-motion-origin="left center"
                        className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-up"
                        style={{ width: `${Math.max(item.status === "locked" ? 0 : 8, item.progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{item.guardrail}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-black text-brand-ink">
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
              <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Season Mission</p>
              <h2 className="mt-3 max-w-xl text-display-md font-semibold md:text-display-lg">
                {season.title}
              </h2>
              <p className="mt-4 max-w-2xl text-body leading-8 text-white/68">{season.summary}</p>

              <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-bold text-white/62">赛季完成度</span>
                  <span className="text-sm font-black text-brand-warm">
                    {season.completedObjectives}/{season.totalObjectives} · {season.progress}%
                  </span>
                </div>
                <div data-motion-viz className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
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
                  "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-black transition md:w-auto",
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

          <div className="grid gap-3 bg-white p-5 md:p-6 xl:grid-cols-2">
            {season.objectives.map((objective) => (
              <Link
                data-motion-card
                key={objective.id}
                href={objective.href}
                className={cn(
                  "group rounded-[1.45rem] border p-4 transition hover:-translate-y-0.5",
                  objective.done
                    ? "border-up/20 bg-up-soft"
                    : "border-slate-200 bg-slate-50 hover:border-brand/30 hover:bg-brand-subtle",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      objective.done ? "bg-up text-white" : "bg-white text-slate-600",
                    )}
                  >
                    {objective.done ? <CheckCircle2 className="h-5 w-5" /> : <ArrowRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-black text-slate-950">{objective.label}</h3>
                      <span className="shrink-0 text-xs font-black text-slate-600">
                        {Math.min(objective.target, Math.round(objective.progress * objective.target))}/{objective.target}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{objective.detail}</p>
                  </div>
                </div>
              </Link>
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
              <h2 className="text-h1 font-semibold text-slate-950">任务盲盒栏</h2>
            </div>
            <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
              正面只保留航线、状态和进度，拆开后再查看任务目标、导师提示和神秘奖励。需要更多解释时点“详情”。
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
                  "min-h-10 rounded-full border px-4 text-sm font-bold transition",
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
                  data-testid={`quest-card-${quest.id}`}
                  key={quest.id}
                  className={cn(
                    "min-h-[30rem] rounded-[1.7rem] [perspective:1200px]",
                    selected && "ring-2 ring-brand ring-offset-4 ring-offset-white",
                  )}
                >
                  <div
                    data-quest-card-inner={quest.id}
                    className="relative h-full min-h-[30rem] rounded-[1.7rem]"
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
                          <p className="bz-brand-text-on-light text-xs font-bold uppercase tracking-[0.18em]">Mission Box</p>
                          <h3 className="mt-2 text-h2 font-black text-slate-950">第 {visualIndex + 1} 号任务盲盒</h3>
                        </div>
                        <QuestStatusBadge status={quest.status} />
                      </div>
                      <div className="relative z-10 mt-5 flex flex-1 items-center justify-center">
                        <QuestBlindBoxArt quest={quest} index={visualIndex} />
                      </div>
                      <div className="relative z-10 mt-5 flex items-center justify-between gap-3">
                        <span className={cn("rounded-full px-3 py-1 text-xs font-black", tone.className)}>
                          {questCategoryLabel(quest.category)}
                        </span>
                        <span className="text-xs font-black text-slate-500">{Math.round(quest.progress * 100)}%</span>
                      </div>
                      <div data-motion-viz className="relative z-10 mt-3 h-3 rounded-full bg-slate-100">
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
                        className="relative z-10 mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                      >
                        <PackageOpen className="h-4 w-4" />
                        拆开任务盲盒
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
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-warm">Mission Card</p>
                          <h3 className="mt-2 text-h2 font-black text-white">{quest.title}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white transition hover:bg-white/18"
                        >
                          返回任务
                        </button>
                      </div>
                      <div className="mt-5 grid gap-3">
                        <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.08] p-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/48">任务目标</p>
                          <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white/82">{quest.target}</p>
                        </div>
                        <div className="rounded-[1.3rem] border border-brand/25 bg-brand/12 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-warm">神秘奖励</p>
                          <p className="mt-2 text-sm font-black leading-6 text-white">{quest.reward}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailQuestId(quest.id)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-sm font-black text-white transition hover:bg-white/18"
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
                              <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-warm">
                                {rarityMeta[collectedCard.card.rarity].label}
                              </p>
                              <h4 className="mt-1 text-lg font-black text-white">{collectedCard.card.name}</h4>
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
                        className={cn(
                          "mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition",
                          canDraw && !collectedCard
                            ? "bg-brand text-slate-950 shadow-glow hover:-translate-y-0.5"
                            : collectedCard
                              ? "bg-white text-slate-950"
                              : "cursor-not-allowed bg-white/12 text-white/55",
                        )}
                      >
                        {isQuestBusy
                          ? "抽卡中..."
                          : collectedCard
                            ? `已收藏 ${collectedCard.card.name}`
                            : quest.claimable
                              ? "领取并抽卡"
                              : quest.claimed
                                ? "补抽装饰卡"
                                : "完成后可抽卡"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
            </div>
            <aside data-testid="quest-queue-panel" className="rounded-[1.7rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-warm">Quest Queue</p>
                  <h3 className="mt-2 text-h2 font-black text-white">任务队列</h3>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/70">
                  {visibleQuests.length} 个盲盒
                </span>
              </div>
              <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/[0.07] p-4">
                <p className="text-sm font-black text-white">流程</p>
                <div className="mt-3 grid gap-2 text-xs font-bold text-white/68">
                  <span>1. 对话领取航线</span>
                  <span>2. 拆开当前盲盒</span>
                  <span>3. 翻到背面看任务</span>
                  <span>4. 完成后抽取神秘奖励</span>
                </div>
              </div>
              <div className="relative mt-5 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 shadow-inner shadow-black/10">
                <div className="pointer-events-none absolute left-2 right-4 top-2 z-10 h-8 rounded-t-[1.1rem] bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent" />
                <div
                  data-testid="quest-queue-scroll"
                  className="quest-glass-scroll max-h-[20rem] space-y-3 overflow-y-auto overscroll-contain pb-2 pr-2 pt-1"
                  aria-label="任务队列，可向下滑动查看更多任务盲盒"
                >
                  {queuedVisibleQuests.length > 0 ? (
                    queuedVisibleQuests.map((quest) => {
                    const tone = questCategoryTone[quest.category] ?? questCategoryTone.review;
                    const visualIndex = Math.max(0, visibleQuests.findIndex((item) => item.id === quest.id));
                    return (
                      <button
                        key={quest.id}
                        type="button"
                        onClick={() => setSelectedQuestId(quest.id)}
                        className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.07] p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-white/[0.11]"
                      >
                        <div className="flex items-center gap-3">
                          <QuestBlindBoxArt quest={quest} index={visualIndex} compact />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-black uppercase tracking-[0.16em] text-brand-warm">
                                Mission {visualIndex + 1}
                              </span>
                              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-black", tone.className)}>
                                {questCategoryLabel(quest.category)}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-1 text-base font-black text-white">{quest.title}</p>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold text-white/58">
                              <QuestStatusBadge status={quest.status} />
                              <span>{Math.round(quest.progress * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                    })
                  ) : (
                    <p className="rounded-[1.2rem] border border-white/10 bg-white/[0.07] p-4 text-sm font-bold leading-6 text-white/62">
                      当前筛选下只有这个任务。切换上方分类可以查看其他盲盒。
                    </p>
                  )}
                </div>
                <div className="mt-2 flex justify-center">
                  <span data-testid="quest-queue-scroll-hint" className="rounded-full border border-white/12 bg-white/12 px-3 py-1 text-[11px] font-black text-white/72 shadow-sm backdrop-blur-md">
                    向下滑动查看更多
                  </span>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          <p className="mt-6 rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
            该分类暂时没有任务，去完成更多沙盘动作来解锁吧。
          </p>
        )}
      </section>

      <QuestCardCollection items={cardCollection} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-brand" />
              <div>
                <h2 className="text-h1 font-semibold text-slate-950">收益日历</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
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
                  <p className="text-sm font-black text-slate-950">第 {day.round} 回合</p>
                  <span className="text-xs font-bold text-slate-600">{day.label}</span>
                </div>
                <p className="mt-3 text-xl font-black">
                  <MoneyText>{formatCurrency(day.netWorth)}</MoneyText>
                </p>
                <p className="mt-2 text-sm font-bold">
                  <MoneyText>{formatCurrency(day.delta)}</MoneyText>
                </p>
              </article>
            ))}
          </div>
        </section>

        <aside data-testid="achievement-wall" data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Trophy className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-slate-950">成就墙</h2>
          </div>
          <p className="mt-2 text-body leading-7 text-slate-600">
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
                      <h3 className="text-lg font-black text-slate-950">{achievement.title}</h3>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-black",
                          achievement.unlocked ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600",
                        )}
                      >
                        {achievement.unlocked ? "已点亮" : "待解锁"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{achievement.detail}</p>
                    <p className="mt-2 rounded-full bg-white/76 px-3 py-1.5 text-xs font-black text-brand-ink shadow-inner shadow-slate-950/5">
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
    </div>
  );
}
