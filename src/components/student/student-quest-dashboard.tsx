"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  CircleDot,
  Eye,
  Gift,
  Gamepad2,
  Loader2,
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
import type { QuestClaimResult, StudentBenefitKind, StudentBenefitStatus, StudentQuestPayload } from "@/lib/quests";
import type { SeasonClaimResult, StudentSeasonChallengePayload } from "@/lib/season-challenges";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

import {
  AchievementBadgeArt,
  CreaturePortrait,
  MissionCardBackArtwork,
  QuestCardArt,
  QuestCardBackArt,
} from "./quest-dashboard/card-art";
import {
  CompanionAlbum,
  MascotRewardModal,
  QuestCardCollection,
} from "./quest-dashboard/collection";
import {
  MiniQuestCreatureCard,
  MissionHabitatShelf,
  MissionRouteNode,
  SeasonObjectiveCreatureCard,
} from "./quest-dashboard/mission-cards";
import {
  focusAfterFlip,
  formatGeneratedAt,
  preferredScrollBehavior,
  progressAria,
  questCategoryLabel,
  questIdFromCard,
  questWorldAssetBase,
  tierMeta,
  useModalA11y,
  type QuestCardCollectionView,
} from "./quest-dashboard/shared";
import { questVisualProfileFor, type QuestItem } from "./quest-dashboard/themes";

export type { QuestCardCollectionView } from "./quest-dashboard/shared";


type QuestFilter = "all" | "active" | "done" | "watch";


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

// 去射幸（合规）：收藏分组文案中性化，移除 COMMON/RARE/EPIC 开奖色彩。
// 卡牌奖励本就只装饰、不改净值/学习点/学习榜，这里只去掉感知层的"中奖"暗示（面向未成年人）。





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
        <div className="relative min-h-[260px] overflow-hidden bg-slate-950 text-white sm:min-h-[320px]">
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
          <div className="relative z-10 flex min-h-[260px] flex-col justify-between p-5 sm:min-h-[320px] md:p-7">
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
                页面默认只展示关键信息。任务细节、奖励解释和导师建议会在打开任务锦囊或点击详情后展开。
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 本赛季地图节点的展示类别（仅影响头像/概念标签的 profile 选择）。
const seasonObjectiveCategoryById: Record<string, string> = {
  "market-observe": "learning",
  "opportunity-note": "learning",
  "portfolio-lab": "finance",
  "safety-base": "learning",
  "holding-review": "learning",
};

function QuestMapGallery({
  quests,
  selectedQuestId,
  season,
  onSelect,
}: {
  quests: QuestItem[];
  selectedQuestId: string | null;
  season: StudentSeasonChallengePayload;
  onSelect: (questId: string) => void;
}) {
  const taskNodes = quests.slice(0, 6);
  const seasonNodes = season.objectives.slice(0, 4);

  return (
    <section
      data-quest-reveal
      data-motion-reveal
      data-testid="quest-map-gallery"
      className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
    >
      <div data-testid="quest-task-map" className="panel rounded-[1.8rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="bz-eyebrow bz-brand-text-on-light">Route Map</p>
            <h2 className="mt-2 text-h2 font-semibold text-fg-strong">任务地图</h2>
          </div>
          <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-bold text-brand-ink">
            点击切换今日航线
          </span>
        </div>
        {/* §19.7 移动端：任务地图节点横滑（70% 宽），sm 起还原网格。 */}
        <div className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [&>*]:w-[70%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto sm:[&>*]:shrink xl:grid-cols-3">
          {taskNodes.map((quest, index) => {
            const active = quest.id === selectedQuestId;
            const profile = questVisualProfileFor(quest, index);
            return (
              <button
                key={quest.id}
                type="button"
                data-testid={`quest-task-map-node-${quest.id}`}
                aria-pressed={active}
                onClick={() => onSelect(quest.id)}
                className={cn(
                  "group flex min-h-20 items-center gap-3 rounded-[1.2rem] border p-3 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active ? "border-brand bg-brand-subtle shadow-glow" : "border-slate-200 bg-white hover:border-brand/45",
                )}
              >
                <CreaturePortrait profile={profile} className="h-11 w-11 shrink-0 transition group-hover:scale-105" />
                <span className="min-w-0">
                  <span className="block line-clamp-1 text-sm font-black text-fg-strong">{profile.visualTitle}</span>
                  <span className="mt-1 block text-xs font-semibold tabular-nums text-fg-muted">
                    航线 {index + 1} · {Math.round(quest.progress * 100)}%
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid="quest-season-map" className="panel rounded-[1.8rem] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="bz-eyebrow bz-brand-text-on-light">Season Map</p>
            <h2 className="mt-2 text-h2 font-semibold text-fg-strong">本赛季地图</h2>
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
            {season.completedObjectives}/{season.totalObjectives}
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {seasonNodes.map((objective, index) => {
            const pseudoQuest = {
              id: objective.id,
              // 显式类别表替代字符串嗅探（评审 culture-2）；映射冻结现状（零视觉变化），
              // 语义再归类（safety-base→risk 等）留给内容组专项。未登记 id 回退 learning。
              category: seasonObjectiveCategoryById[objective.id] ?? "learning",
              status: objective.done ? "done" : "active",
              progress: objective.progress,
            } as QuestItem;
            const profile = questVisualProfileFor(pseudoQuest, index);
            return (
              <Link
                key={objective.id}
                href={objective.href}
                data-testid={`quest-season-map-node-${objective.id}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-[1.15rem] border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-brand/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="min-w-0">
                  <span className="block line-clamp-1 text-sm font-black text-fg-strong">{profile.visualTitle}</span>
                  <span className="mt-1 block text-xs font-semibold text-fg-muted">{profile.conceptTag}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand" />
              </Link>
            );
          })}
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/56 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`任务详情：${quest.title}`}
      onClick={onClose}
    >
      {/* §19.7：手机上长详情用底部抽屉（贴底滑入、可内滚），sm 起保持居中弹窗。 */}
      <div
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
        className="bz-sheet-in max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-[1.8rem] bg-white shadow-soft sm:max-h-[85dvh] sm:rounded-[2rem]"
      >
        <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>
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
  const questFlipButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const questBackActionRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // 成功横幅 8s 自动消退（评审 nudge-3）：live region 容器常驻，仅内容清空；新结果重置计时。
  useEffect(() => {
    if (!claimResult) return;
    const timer = window.setTimeout(() => setClaimResult(null), 8000);
    return () => window.clearTimeout(timer);
  }, [claimResult]);
  useEffect(() => {
    if (!drawResult) return;
    const timer = window.setTimeout(() => setDrawResult(null), 8000);
    return () => window.clearTimeout(timer);
  }, [drawResult]);

  const { contextSafe } = useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-quest-reveal], [data-calendar-cell]", {
          autoAlpha: 1,
          clearProps: "transform,opacity,visibility",
        });
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

    const focusTarget = () => {
      focusAfterFlip(
        nextFlipped ? questBackActionRefs.current[questId] ?? null : questFlipButtonRefs.current[questId] ?? null,
      );
    };
    // 焦点落点等到翻面过半（~90° 后新面已可见）再移动，避免焦点环出现在被剔除的背面上。
    window.setTimeout(focusTarget, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
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
      {/* §19.7 顶部小图标锚点导航（仅手机）：目标 / 主卡 / 队列 / 图鉴 —— 长页快速跳转。 */}
      <nav
        aria-label="任务中心快捷导航"
        data-testid="quest-anchor-nav"
        className="sticky top-2 z-30 flex gap-1.5 overflow-x-auto rounded-full border border-slate-200/80 bg-white/92 p-1.5 shadow-soft backdrop-blur md:hidden"
      >
        {[
          { href: "#season-goals", label: "目标", Icon: Target },
          { href: "#mission-main", label: "主卡", Icon: PackageOpen },
          { href: "#mission-queue", label: "队列", Icon: CircleDot },
          { href: "#companion-album", label: "图鉴", Icon: Sparkles },
        ].map(({ href, label, Icon }) => (
          <a
            key={href}
            href={href}
            className="bz-press inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs font-black text-slate-700 transition hover:bg-brand-subtle hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Icon className="h-4 w-4 text-brand" />
            {label}
          </a>
        ))}
      </nav>
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
              这里不会直接给学习点加分，而是把你的学习、交易、现金管理和复盘行为变成可见目标。好任务让你知道下一步练什么，也让每次打开沙盘都有明确方向。
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
                <p className="text-sm font-semibold text-white/56">连续学习</p>
                {/* streak 断裂时不把 0 当失败信号裸展示（评审会 P2·羞耻感暴露）：
                    改为 — + 可立即行动的重启文案，归因指向行动而非能力。 */}
                <p className="mt-3 text-h2 tabular-nums text-white">
                  {questPayload.overview.streakCurrent > 0 ? questPayload.overview.streakCurrent : "—"}
                  <span className="mx-2 text-h3 text-white/70">/</span>
                  {questPayload.overview.streakBest}
                </p>
                <p className="mt-3 text-sm text-white/58">
                  {questPayload.overview.streakCurrent > 0
                    ? "当前 / 历史最佳连续学习回合"
                    : questPayload.overview.streakBest > 0
                      ? `上次连续 ${questPayload.overview.streakBest} 回合 · 本回合做一个理财动作即可重新开始`
                      : "做第一个理财动作，开启你的连续学习记录"}
                </p>
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
            {/* 常驻 live region（WCAG 4.1.3）：容器始终在 DOM，仅内容更新，读屏才稳定播报。 */}
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="quest-claim-result"
              className={cn(claimResult && "mt-5 rounded-[1.35rem] border border-brand/25 bg-brand/12 p-4")}
            >
              {claimResult ? (
                <>
                  <p className="text-sm font-bold text-brand-warm">奖励已领取</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/74">
                    {claimResult.reward} 已加入成长轨迹。奖励只做装饰，不改变学习点或净值。
                  </p>
                </>
              ) : null}
            </div>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="quest-draw-result"
              className={cn(drawResult && "mt-4 rounded-[1.35rem] border border-white/10 bg-white/[0.08] p-4")}
            >
              {drawResult ? (
                <>
                  <p className="text-sm font-bold text-brand-warm">已加入卡库</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-white/78">
                    你收藏了 {drawResult.card.name}。这张卡已加入“我的卡库”，只记录学习轨迹，不改变净值、学习点或学习榜。
                  </p>
                </>
              ) : null}
            </div>
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

          {/* §19.7 移动端：权益项改横滑卡组，sm 起还原网格。 */}
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto bg-white p-5 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:snap-none sm:overflow-visible sm:[&>*]:w-auto sm:[&>*]:shrink md:p-6 xl:grid-cols-2 2xl:grid-cols-3">
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
        id="season-goals"
        data-testid="quest-season-challenge"
        className="panel scroll-mt-24 overflow-hidden rounded-[2rem] p-0"
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

          {/* §12.3/§19.7 移动端：赛季目标改横滑卡组（85% 宽=保留约 1.15 张露出提示还有更多），
              sm 起还原网格；横滑容器自身裁剪溢出，不影响根级 scrollWidth。 */}
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto bg-white p-5 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:snap-none sm:overflow-visible sm:[&>*]:w-auto sm:[&>*]:shrink md:p-6 xl:grid-cols-2">
            {season.objectives.length > 0 ? (
              season.objectives.map((objective, index) => (
                <SeasonObjectiveCreatureCard key={objective.id} objective={objective} index={index} />
              ))
            ) : (
              <div
                data-testid="season-objectives-empty"
                className="flex min-h-[204px] flex-col justify-center rounded-[1.55rem] border border-dashed border-slate-200 bg-slate-50/80 p-5 xl:col-span-2"
              >
                <p className="text-lg font-black text-slate-950">本周任务正在整理</p>
                <p className="mt-2 max-w-xl text-sm font-bold leading-6 text-slate-600">
                  先完成一条任务航线或一次复盘，系统会把新的观察、分散、保护目标补到这里。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <QuestMapGallery
        quests={questPayload.quests}
        selectedQuestId={selectedQuestId}
        season={season}
        onSelect={setSelectedQuestId}
      />

      <QuestCommanderPanel quests={questPayload.quests} selectedQuestId={selectedQuestId} onSelect={setSelectedQuestId} />

      <section id="mission-main" data-quest-reveal data-motion-reveal className="panel scroll-mt-24 rounded-[2rem] p-5 md:p-6">
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
                aria-pressed={filter === item.id}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
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
              const visualIndex = Math.max(0, visibleQuests.findIndex((item) => item.id === quest.id));

              return (
                <article
                  data-motion-card
                  data-selected-mission-card
                  data-testid={`quest-card-${quest.id}`}
                  data-flip-state={isFlipped ? "front" : "back"}
                  key={quest.id}
                  className={cn(
                    "poker-flip-shell min-h-[42rem] rounded-[1.7rem] [perspective:1200px] lg:min-h-[44rem]",
                    selected && "ring-2 ring-brand ring-offset-4 ring-offset-white",
                  )}
                >
                  <div
                    data-quest-card-inner={quest.id}
                    className={cn(
                      "poker-flip-inner relative min-h-[42rem] rounded-[1.7rem] lg:min-h-[44rem]",
                      isFlipped && "poker-flip-inner-front",
                    )}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      data-testid={`quest-card-back-${quest.id}`}
                      aria-hidden={isFlipped}
                      inert={isFlipped ? true : undefined}
                      className="poker-flip-face absolute inset-0 flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-brand/30 bg-slate-950 p-0 text-white shadow-lg shadow-slate-950/10"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <MissionCardBackArtwork priority>
                        <div className="flex items-start justify-between gap-3 p-5">
                          <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
                            第 {visualIndex + 1} 号任务卡背
                          </span>
                          <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
                            待揭晓
                          </span>
                        </div>
                        <div className="mt-auto p-5">
                          <div className="rounded-[1.3rem] border border-white/12 bg-slate-950/62 p-4 shadow-inner backdrop-blur-md">
                            <p className="text-2xl font-black text-white">任务锦囊</p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-white/74">
                              点击翻开任务正面，查看目标、导师提示与可领取的学习卡。
                            </p>
                            <div aria-hidden="true" className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/14">
                              <div className="h-full w-3/5 rounded-full bg-gradient-to-r from-brand via-warning to-down" />
                            </div>
                          </div>
                        </div>
                      </MissionCardBackArtwork>
                      <button
                        ref={(node) => {
                          questFlipButtonRefs.current[quest.id] = node;
                        }}
                        data-motion-button
                        type="button"
                        data-testid={`quest-flip-${quest.id}`}
                        aria-controls={`quest-card-front-${quest.id}`}
                        aria-expanded={isFlipped}
                        aria-label={isFlipped ? `翻回任务卡背面：${quest.title}` : `翻开第 ${visualIndex + 1} 号任务卡正面`}
                        onClick={() => toggleQuestFlip(quest.id)}
                        className="bz-press relative z-10 mx-5 mb-5 mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-brand/35 bg-slate-950/82 px-4 text-sm font-semibold text-white shadow-glow backdrop-blur transition hover:-translate-y-0.5 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                      >
                        <PackageOpen className="h-4 w-4" />
                        翻开任务正面
                      </button>
                    </div>

                    <div
                      id={`quest-card-front-${quest.id}`}
                      data-testid={`quest-card-front-${quest.id}`}
                      aria-hidden={!isFlipped}
                      inert={!isFlipped ? true : undefined}
                      className="poker-flip-front-face poker-flip-face absolute inset-0 flex h-full flex-col rounded-[1.7rem] border border-brand/30 bg-slate-950 p-5 text-white shadow-glow"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">任务卡</p>
                          <h3 className="mt-2 text-h2 font-bold text-white">{quest.title}</h3>
                        </div>
                        <button
                          type="button"
                          data-testid={`quest-return-back-${quest.id}`}
                          aria-label={`翻回任务卡背面：${quest.title}`}
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                          翻回卡背
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
                          ref={(node) => {
                            questBackActionRefs.current[quest.id] = node;
                          }}
                          type="button"
                          data-testid={`quest-detail-trigger-${quest.id}`}
                          aria-label={`查看任务详情：${quest.title}`}
                          onClick={() => setDetailQuestId(quest.id)}
                          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
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
                                {tierMeta[collectedCard.card.tier].label}
                              </p>
                              <h4 className="mt-1 text-lg font-bold text-white">{collectedCard.card.name}</h4>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-brand-warm" />
                          </div>
                          <p className="mt-2 text-sm font-semibold leading-6 text-white/76">
                            {collectedCard.card.teachingLine}
                          </p>
                          <p className="mt-1 text-[11px] font-bold text-brand-warm">
                            呼应你刚练的「{questCategoryLabel(quest.category)}」
                          </p>
                        </div>
                      ) : (
                        <div className="hidden sm:block">
                          <QuestCardBackArt tier="basic" />
                        </div>
                      )}
                      <p className="mt-3 text-[11px] font-semibold leading-5 text-white/55">
                        完成任务即可获得对应卡片 · 仅作学习收藏，不改变净值、学习点或学习榜。
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
                          "bz-press mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
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
            <aside id="mission-queue" data-testid="quest-queue-panel" className="scroll-mt-24 rounded-[1.7rem] border border-slate-200 bg-slate-950 p-5 text-white shadow-soft">
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
                      {filter === "done"
                        ? "这里还没有已完成的任务——翻开一张任务锦囊，完成后就会出现在这里。"
                        : filter === "watch"
                          ? "当前没有需要观察的任务，保持这个节奏就很好。"
                          : "当前筛选下只有这个任务。切换上方分类可以查看其他锦囊。"}
                    </p>
                  )}
                </div>
                {/* 任务少于 4 个时列表不可滚，滚动提示反成误导（评审 ux-retention-5）。 */}
                {visibleQuests.length > 3 ? (
                <div className="mt-2 flex justify-center">
                  <span data-testid="quest-queue-scroll-hint" className="rounded-full border border-white/12 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/72 shadow-sm backdrop-blur-md">
                    向下滑动查看更多
                  </span>
                </div>
                ) : null}
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
                <p className="mt-3 break-words text-sm font-bold tabular-nums sm:text-base">
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
            成就只代表学习轨迹，不代表真实投资能力，也不会直接改变学习榜位置。
          </p>
          {/* §19.7 移动端：成就条目改横滑卡组，sm 起还原纵向列表。 */}
          <div className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [&>*]:w-[88%] [&>*]:shrink-0 [&>*]:snap-start sm:block sm:snap-none sm:space-y-3 sm:overflow-visible sm:pb-0 sm:[&>*]:w-auto">
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
            if (typeof window === "undefined") return;
            // iOS Safari：body 滚动锁未释放时 scrollIntoView 会被静默吞掉（评审 mobile-2），
            // 双 rAF 等关闭后的布局帧再滚。
            window.requestAnimationFrame(() => {
              window.requestAnimationFrame(() => {
                document
                  .querySelector('[data-testid="quest-card-collection"]')
                  ?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
              });
            });
          }}
        />
      ) : null}
    </div>
  );
}
