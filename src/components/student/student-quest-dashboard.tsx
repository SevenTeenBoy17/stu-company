"use client";

import { useMemo, useRef, useState } from "react";
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
  Gift,
  Gamepad2,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
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
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">{item.label}</p>
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

      <section data-quest-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">本周任务栏</h2>
            </div>
            <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
              任务来自真实行为，不是额外刷分入口。完成后只获得称号、徽章、边框等装饰奖励，榜单和净值仍由沙盘决策决定。
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
          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            {visibleQuests.map((quest) => {
              const isFlipped = flippedQuestIds.has(quest.id);
              const collectedCard = collectionByQuestId.get(quest.id);
              const isQuestBusy = claimingQuestId === quest.id || drawingQuestId === quest.id;
              const canDraw = quest.claimable || quest.claimed;

              return (
                <article
                  data-motion-card
                  data-testid={`quest-card-${quest.id}`}
                  key={quest.id}
                  className="min-h-[26rem] rounded-[1.7rem] [perspective:1200px]"
                >
                  <div
                    data-quest-card-inner={quest.id}
                    className="relative h-full min-h-[26rem] rounded-[1.7rem]"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      data-testid={`quest-card-front-${quest.id}`}
                      aria-hidden={isFlipped}
                      className="absolute inset-0 flex h-full flex-col rounded-[1.7rem] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-950/5"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">{quest.category}</p>
                          <h3 className="mt-2 text-h2 font-bold text-slate-950">{quest.title}</h3>
                        </div>
                        <QuestStatusBadge status={quest.status} />
                      </div>
                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{quest.target}</p>
                      <div data-motion-viz className="mt-5 h-3 rounded-full bg-slate-100">
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
                      <div className="mt-5 rounded-[1.2rem] bg-slate-950/[0.035] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">任务进度</p>
                        <p className="mt-2 text-sm font-bold text-slate-950">
                          {Math.round(quest.progress * 100)}% · {quest.claimable ? "可以领取奖励" : quest.claimed ? "奖励已领取" : "继续完成任务"}
                        </p>
                      </div>
                      <button
                        data-motion-button
                        type="button"
                        data-testid={`quest-flip-${quest.id}`}
                        aria-pressed={isFlipped}
                        onClick={() => toggleQuestFlip(quest.id)}
                        className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-950 px-4 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800"
                      >
                        <Gift className="h-4 w-4" />
                        查看奖励背面
                      </button>
                    </div>

                    <div
                      data-testid={`quest-card-back-${quest.id}`}
                      aria-hidden={!isFlipped}
                      className="absolute inset-0 flex h-full flex-col rounded-[1.7rem] border border-brand/30 bg-slate-950 p-5 text-white shadow-glow"
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-warm">Reward Reveal</p>
                          <h3 className="mt-2 text-h2 font-black text-white">{quest.reward}</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-black text-white transition hover:bg-white/18"
                        >
                          返回任务
                        </button>
                      </div>
                      <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/[0.08] p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-white/48">Mr.Brown 提醒</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-white/82">{quest.coachNote}</p>
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
                        <QuestCardBackArt rarity="common" />
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

        <aside data-quest-reveal className="panel rounded-[2rem] p-5 md:p-6">
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
                  "rounded-[1.35rem] border p-4",
                  achievement.unlocked
                    ? "border-border-brand bg-brand-subtle"
                    : "border-slate-200 bg-slate-950/[0.025]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                      achievement.unlocked ? "bg-brand text-slate-950" : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {achievement.unlocked ? <BadgeCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-slate-950">{achievement.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{achievement.detail}</p>
                    <p className="mt-2 text-xs font-bold text-brand-ink">{achievement.decorativeReward}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
