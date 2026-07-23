"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Eye,
  Gift,
  Gamepad2,
  Loader2,
  Maximize2,
  MessageCircle,
  PackageOpen,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";

import { Disclosure } from "@/components/shared/disclosure";
import { MoneyText } from "@/components/shared/money-text";
import { SectionNav } from "@/components/shared/section-nav";
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
              {/* itest11 追修：幽灵字号补 token 后 display-md 在 390px 撑破 §19.7
                  移动紧凑度守卫（commander 面板 <1300px）——移动档改紧凑 h2，
                  md+ 维持 display-lg 与修复前渲染一致。 */}
              <h2 className="mt-3 max-w-lg text-h2 font-semibold md:text-display-lg">先和指挥官对话，再打开任务锦囊</h2>
              {/* Q1 删：口播式元说明删，保留下方指挥官对话气泡承载引导 */}
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
          {/* Q1 删：口播式元说明删——任务细节本就随打开锦囊/点击详情展开，无需前置口播 */}
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

const questMapNodePositions = [
  { left: "21%", top: "78%" },
  { left: "42%", top: "66%" },
  { left: "56%", top: "51%" },
  { left: "72%", top: "36%" },
  { left: "81%", top: "70%" },
  { left: "89%", top: "23%" },
] as const;

const questStatusLabel: Record<QuestItem["status"], string> = {
  active: "进行中",
  done: "已完成",
  locked: "待解锁",
  watch: "观察中",
};

type QuestMapNodeState = "current" | "completed" | "started" | "locked";

const questMapNodeStateLabel: Record<QuestMapNodeState, string> = {
  current: "进行中",
  completed: "已完成",
  started: "已开启",
  locked: "未到达",
};

function getQuestMapNodeState(quest: QuestItem, active: boolean): QuestMapNodeState {
  if (quest.status === "done" || quest.claimed || quest.progress >= 1) return "completed";
  if (active || quest.progress > 0) return "current";
  return "locked";
}

function getQuestMapNodeClasses(state: QuestMapNodeState) {
  switch (state) {
    case "completed":
      return {
        beacon: "border-emerald-100 bg-gradient-to-br from-emerald-100 via-teal-200 to-cyan-200 text-slate-950 shadow-[0_0_34px_rgba(94,234,212,0.58)]",
        ring: "bg-emerald-300/45",
      };
    case "current":
      return {
        beacon: "border-amber-100 bg-gradient-to-br from-amber-200 via-orange-300 to-yellow-200 text-slate-950 shadow-[0_0_46px_rgba(251,191,36,0.68)]",
        ring: "bg-amber-300/55",
      };
    case "started":
      return {
        beacon: "border-cyan-100/80 bg-gradient-to-br from-sky-200 via-cyan-200 to-teal-100 text-slate-950 shadow-[0_0_32px_rgba(103,232,249,0.45)]",
        ring: "bg-cyan-300/35",
      };
    case "locked":
    default:
      return {
        beacon: "border-white/15 bg-slate-950/88 text-white/70 shadow-[0_0_22px_rgba(15,23,42,0.78)] grayscale",
        ring: "bg-slate-950/55",
      };
  }
}

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
  const selectedTaskIndex = Math.max(
    0,
    taskNodes.findIndex((quest) => quest.id === selectedQuestId),
  );
  const selectedTask = taskNodes[selectedTaskIndex] ?? taskNodes[0];
  const selectedProfile = selectedTask ? questVisualProfileFor(selectedTask, selectedTaskIndex) : null;
  const [mapExpanded, setMapExpanded] = useState(false);
  const [routeDetailQuest, setRouteDetailQuest] = useState<QuestItem | null>(null);

  function openRouteQuest(quest: QuestItem) {
    onSelect(quest.id);
    setRouteDetailQuest(quest);
  }

  return (
    <section
      id="sec-quest-map"
      data-quest-reveal
      data-motion-reveal
      data-testid="quest-map-gallery"
      className="grid scroll-mt-24 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,0.55fr)]"
    >
      <div data-testid="quest-task-map" className="panel overflow-hidden rounded-[2rem] p-0">
        <div className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0">
            <Image
              src="/brand/quest-world/mission-route-map-v2.webp"
              alt=""
              fill
              priority
              sizes="(min-width: 1280px) 62vw, 100vw"
              className="object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,24,0.78),rgba(4,8,24,0.18)_43%,rgba(4,8,24,0.58))]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,185,96,0.24),transparent_32%),radial-gradient(circle_at_86%_22%,rgba(122,216,184,0.18),transparent_28%)]" />
          </div>

          <div className="relative z-10 flex min-h-[25rem] flex-col justify-between gap-8 p-5 sm:min-h-[30rem] sm:p-7 lg:min-h-[34rem]">
            {/* itest6 R3 P2：此头部块 z-30 盖在 z-20 节点层之上，非 pointer-events-none 时其包围盒
                会拦截落到上半区节点按钮的点击（爬虫实证 top≤51% 的节点点不到）。头部整体透传点击，
                仅「放大查看」按钮重新开启命中，标题/当前航线卡为纯展示。 */}
            <div className="pointer-events-none relative z-30 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="bz-eyebrow text-amber-200">Route Map</p>
                <h2 className="mt-3 text-[clamp(2rem,4vw,4.6rem)] font-black leading-[0.95] tracking-[-0.08em] text-white">
                  任务地图
                </h2>
                {/* Q2 删：地图节点 +「点击节点切换航线」徽章已表意 */}
                {selectedTask && selectedProfile ? (
                  <div className="mt-4 inline-flex max-w-full items-center gap-3 rounded-[1.35rem] border border-white/14 bg-slate-950/66 p-3 pr-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                    <CreaturePortrait profile={selectedProfile} className="h-11 w-11 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-amber-200">当前航线</p>
                      <h3 className="mt-1 line-clamp-1 text-base font-black text-white">{selectedProfile.visualTitle}</h3>
                    </div>
                    <div className="ml-1 min-w-[7rem] rounded-[0.9rem] border border-white/10 bg-white/10 p-2">
                      <div className="flex items-center justify-between text-[0.68rem] font-black text-white/76">
                        <span>{questStatusLabel[selectedTask.status]}</span>
                        <span className="tabular-nums">{Math.round(selectedTask.progress * 100)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/12">
                        <span
                          className="block h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-emerald-200"
                          style={{ width: `${Math.round(selectedTask.progress * 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/18 bg-white/12 px-4 py-2 text-xs font-black text-amber-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur">
                  点击节点切换航线
                </span>
                <button
                  type="button"
                  onClick={() => setMapExpanded(true)}
                  data-testid="quest-map-expand-button"
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-amber-100/70 bg-amber-200 px-4 py-2 text-xs font-black text-slate-950 shadow-[0_16px_36px_rgba(251,191,36,0.28)] transition hover:-translate-y-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100"
                >
                  <Maximize2 className="h-4 w-4" />
                  放大查看
                </button>
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-20" data-testid="quest-route-node-layer">
              {taskNodes.map((quest, index) => {
                const active = quest.id === selectedQuestId;
                const profile = questVisualProfileFor(quest, index);
                const progress = Math.round(quest.progress * 100);
                const position = questMapNodePositions[index % questMapNodePositions.length];
                const state = getQuestMapNodeState(quest, active);
                const stateClasses = getQuestMapNodeClasses(state);
                return (
                  <button
                    key={quest.id}
                    type="button"
                    data-testid={`quest-task-map-node-${quest.id}`}
                    data-map-node-state={state}
                    aria-pressed={active}
                    aria-label={`航线 ${index + 1}，${profile.visualTitle}，${questMapNodeStateLabel[state]}，进度 ${progress}%`}
                    onClick={() => openRouteQuest(quest)}
                    style={{ left: position.left, top: position.top }}
                    className={cn(
                      "group pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200",
                      state === "locked" ? "opacity-88" : "opacity-100",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl transition group-hover:scale-110",
                        stateClasses.ring,
                      )}
                    />
                    <span
                      className={cn(
                        "relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 sm:h-[4.5rem] sm:w-[4.5rem]",
                        active ? "ring-4 ring-white/45" : "ring-1 ring-white/12",
                        stateClasses.beacon,
                      )}
                    >
                      <CreaturePortrait
                        profile={profile}
                        className="h-11 w-11 transition group-hover:scale-105 sm:h-12 sm:w-12"
                      />
                      <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-[0.68rem] font-black tabular-nums text-amber-100 ring-2 ring-white/20">
                        {index + 1}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid gap-4 bg-[linear-gradient(180deg,#fffaf6,#ffffff)] p-5 sm:grid-cols-2 xl:grid-cols-2">
          {taskNodes.map((quest, index) => {
            const active = quest.id === selectedQuestId;
            const profile = questVisualProfileFor(quest, index);
            const progress = Math.round(quest.progress * 100);
            const routeState =
              quest.status === "done" || quest.claimed ? "已完成" : quest.status === "active" ? "进行中" : "待解锁";
            return (
              <button
                type="button"
                onClick={() => openRouteQuest(quest)}
                key={quest.id}
                className={cn(
                  "group relative overflow-hidden rounded-[1.55rem] border p-0 text-left transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                  active ? "border-brand bg-white shadow-glow" : "border-slate-200 bg-white/92 hover:-translate-y-1 hover:border-brand/35 hover:shadow-card",
                )}
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-amber-300 via-orange-300 to-emerald-200" />
                <div className="flex gap-3 p-4">
                  <CreaturePortrait profile={profile} className="h-14 w-14 shrink-0 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-brand-ink">
                          航线 {String(index + 1).padStart(2, "0")}
                        </p>
                        <h3 className="mt-1 line-clamp-1 text-base font-black text-fg-strong">{profile.visualTitle}</h3>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-black tabular-nums text-white">
                        {progress}%
                      </span>
                    </div>
                    {/* ui-v2 收敛：coachNote 与地图节点信息重复，卡面只留标题+状态章+进度条，
                        导师提示保留在点击后的 QuestDetailDialog（Mr.Brown 提醒）里。 */}
                    <div className="mt-3 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[0.68rem] font-black",
                          quest.status === "done" || quest.claimed
                            ? "bg-emerald-50 text-emerald-700"
                            : quest.status === "active"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600", // itest7 P3：slate-500(4.36:1)→slate-600(≥5.5:1) 过 AA
                        )}
                      >
                        {routeState}
                      </span>
                      <span className="line-clamp-1 text-xs font-bold text-fg-muted">{profile.conceptTag}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          active ? "bg-brand" : quest.status === "done" || quest.claimed ? "bg-emerald-400" : "bg-slate-300",
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div data-testid="quest-season-map" className="panel overflow-hidden rounded-[2rem] p-0">
        <div className="relative overflow-hidden bg-[linear-gradient(145deg,#fff7e8,#ffffff_45%,#eaf7ef)] p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-amber-200/45 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 left-4 h-40 w-40 rounded-full bg-emerald-200/38 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="bz-eyebrow bz-brand-text-on-light">Season Map</p>
            <h2 className="mt-2 text-h2 font-semibold text-fg-strong">本赛季地图</h2>
            {/* Q3 删：下方 SVG 路线图已图形化表达四岛点亮 */}
          </div>
          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-bold text-white">
            {season.completedObjectives}/{season.totalObjectives}
          </span>
          </div>
          <div className="relative mt-5 overflow-hidden rounded-[1.65rem] border border-amber-200/70 bg-white/76 p-4 shadow-inner shadow-amber-900/5">
            <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_18%_70%,rgba(251,191,36,0.24),transparent_22%),radial-gradient(circle_at_72%_32%,rgba(16,185,129,0.18),transparent_20%)]" />
            <div className="relative grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-brand">Season Progress</p>
                  <p className="mt-1 text-sm font-semibold text-fg-muted">本赛季目标完成度</p>
                </div>
                <Trophy className="h-8 w-8 text-brand" />
              </div>
              <div className="relative min-h-28">
                <svg viewBox="0 0 320 120" className="h-28 w-full" role="img" aria-label="赛季地图路线示意">
                  <path d="M28 86 C88 24, 126 110, 178 52 S264 42, 294 18" fill="none" stroke="#f4d9a4" strokeWidth="18" strokeLinecap="round" />
                  <path d="M28 86 C88 24, 126 110, 178 52 S264 42, 294 18" fill="none" stroke="#e08a38" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 12" />
                  {[28, 116, 196, 294].map((cx, nodeIndex) => (
                    <g key={cx}>
                      <circle cx={cx} cy={[86, 58, 44, 18][nodeIndex]} r="17" fill={nodeIndex < season.completedObjectives ? "#dff8e9" : "#fff7ed"} stroke={nodeIndex < season.completedObjectives ? "#5fbf8b" : "#e08a38"} strokeWidth="3" />
                      <text x={cx} y={[91, 63, 49, 23][nodeIndex]} textAnchor="middle" className="fill-slate-900 text-[16px] font-black">
                        {nodeIndex + 1}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-brand via-amber-300 to-emerald-300"
                  style={{ width: `${season.totalObjectives ? Math.round((season.completedObjectives / season.totalObjectives) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-1">
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
                className="group flex min-h-20 items-center justify-between gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3.5 transition hover:-translate-y-0.5 hover:border-brand/45 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-subtle text-sm font-black tabular-nums text-brand-ink">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block line-clamp-1 text-sm font-black text-fg-strong">{profile.visualTitle}</span>
                    <span className="mt-1 block text-xs font-semibold text-fg-muted">{profile.conceptTag}</span>
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-brand transition group-hover:translate-x-0.5" />
              </Link>
            );
          })}
        </div>
      </div>
      {mapExpanded ? (
        <QuestMapFullscreenDialog
          quests={taskNodes}
          selectedQuestId={selectedQuestId}
          onSelect={onSelect}
          onClose={() => setMapExpanded(false)}
        />
      ) : null}
      <QuestDetailDialog quest={routeDetailQuest} onClose={() => setRouteDetailQuest(null)} />
    </section>
  );
}

function QuestMapFullscreenDialog({
  quests,
  selectedQuestId,
  onSelect,
  onClose,
}: {
  quests: QuestItem[];
  selectedQuestId: string | null;
  onSelect: (questId: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(panelRef, onClose, closeRef);
  const [routeDetailQuest, setRouteDetailQuest] = useState<QuestItem | null>(null);

  const selectedTaskIndex = Math.max(
    0,
    quests.findIndex((quest) => quest.id === selectedQuestId),
  );
  const selectedTask = quests[selectedTaskIndex] ?? quests[0];
  const selectedProfile = selectedTask ? questVisualProfileFor(selectedTask, selectedTaskIndex) : null;

  function openRouteQuest(quest: QuestItem) {
    onSelect(quest.id);
    setRouteDetailQuest(quest);
  }

  const dialog = (
    <>
      <div
        className="fixed inset-0 z-[9999] overflow-hidden bg-slate-950/82 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label="放大查看任务地图"
        onClick={onClose}
        data-testid="quest-map-fullscreen-dialog"
      >
      <Image
        src="/brand/quest-world/mission-route-map-v2.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover opacity-42 blur-xl"
      />
      <div
        ref={panelRef}
        onClick={(event) => event.stopPropagation()}
        className="relative flex h-[100svh] w-screen overflow-hidden bg-slate-950 text-white shadow-[0_32px_110px_rgba(0,0,0,0.58)]"
      >
        <Image
          src="/brand/quest-world/mission-route-map-v2.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-100"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,8,24,0.74),rgba(4,8,24,0.06)_45%,rgba(4,8,24,0.36))]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_14%,rgba(251,191,36,0.26),transparent_32%),radial-gradient(circle_at_82%_22%,rgba(45,212,191,0.18),transparent_34%)]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

        <div className="relative z-30 flex h-full w-full flex-col p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="bz-eyebrow text-amber-200">Route Map Detail</p>
              <h2 className="mt-2 text-[clamp(2.4rem,6vw,5.6rem)] font-black leading-[0.92] tracking-[-0.08em] text-white">
                放大任务地图
              </h2>
              <p className="mt-3 max-w-xl text-sm font-semibold leading-7 text-white/70 sm:text-base">
                在大地图里查看每条航线的位置、状态和进度；点击节点可切换当前航线。
              </p>
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/18 bg-slate-950/50 p-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="关闭放大任务地图"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="pointer-events-none absolute inset-0 z-20" data-testid="quest-map-fullscreen-node-layer">
            {quests.map((quest, index) => {
              const active = quest.id === selectedQuestId;
              const profile = questVisualProfileFor(quest, index);
              const progress = Math.round(quest.progress * 100);
              const position = questMapNodePositions[index % questMapNodePositions.length];
              const state = getQuestMapNodeState(quest, active);
              const stateClasses = getQuestMapNodeClasses(state);
              return (
                <button
                  key={quest.id}
                  type="button"
                  data-testid={`quest-map-fullscreen-node-${quest.id}`}
                  data-map-node-state={state}
                  aria-pressed={active}
                  aria-label={`航线 ${index + 1}，${profile.visualTitle}，${questMapNodeStateLabel[state]}，进度 ${progress}%`}
                  onClick={() => openRouteQuest(quest)}
                  style={{ left: position.left, top: position.top }}
                  className="group pointer-events-auto absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl transition group-hover:scale-110",
                      stateClasses.ring,
                    )}
                  />
                  <span
                    className={cn(
                      "relative z-10 grid h-16 w-16 place-items-center rounded-full border-2 transition duration-200 group-hover:-translate-y-1 group-hover:scale-105 sm:h-20 sm:w-20",
                      active ? "ring-4 ring-white/50" : "ring-1 ring-white/14",
                      stateClasses.beacon,
                    )}
                  >
                    <CreaturePortrait profile={profile} className="h-11 w-11 transition group-hover:scale-105 sm:h-14 sm:w-14" />
                    <span className="absolute -right-1.5 -top-1.5 grid h-7 w-7 place-items-center rounded-full bg-slate-950 text-xs font-black tabular-nums text-amber-100 ring-2 ring-white/20">
                      {index + 1}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTask && selectedProfile ? (
            <div className="mt-auto grid gap-3 rounded-[1.5rem] border border-white/14 bg-slate-950/76 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:grid-cols-[auto_minmax(0,1fr)_minmax(10rem,0.28fr)] sm:items-center">
              <CreaturePortrait profile={selectedProfile} className="h-14 w-14 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-200">当前航线</p>
                <h3 className="mt-1 line-clamp-1 text-xl font-black text-white">{selectedProfile.visualTitle}</h3>
                <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-white/70">{selectedTask.target}</p>
              </div>
              <div className="rounded-[1.1rem] border border-white/10 bg-white/10 p-3">
                <div className="flex items-center justify-between text-xs font-black text-white/76">
                  <span>{questStatusLabel[selectedTask.status]}</span>
                  <span className="tabular-nums">{Math.round(selectedTask.progress * 100)}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/12">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-emerald-200"
                    style={{ width: `${Math.round(selectedTask.progress * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      </div>
      <QuestDetailDialog quest={routeDetailQuest} onClose={() => setRouteDetailQuest(null)} />
    </>
  );

  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
}

function QuestDetailDialog({ quest, onClose }: { quest: QuestItem | null; onClose: () => void }) {
  if (!quest) return null;
  return <QuestDetailDialogInner quest={quest} onClose={onClose} />;
}

function QuestDetailDialogInner({ quest, onClose }: { quest: QuestItem; onClose: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalA11y(cardRef, onClose, closeRef);
  const profile = questVisualProfileFor(quest, 0);
  const progress = Math.round(quest.progress * 100);

  const dialog = (
    <div
      className="fixed inset-0 z-[10020] flex items-end justify-center bg-slate-950/74 p-0 backdrop-blur-xl sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`任务详情：${quest.title}`}
      onClick={onClose}
      data-testid="quest-route-detail-dialog"
    >
      <div
        ref={cardRef}
        onClick={(event) => event.stopPropagation()}
        className="bz-sheet-in grid max-h-[94dvh] w-full max-w-5xl overflow-hidden rounded-t-[2rem] bg-white shadow-[0_36px_110px_rgba(0,0,0,0.34)] sm:max-h-[90dvh] sm:rounded-[2.2rem] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
      >
        <div aria-hidden className="flex justify-center pt-2.5 sm:hidden">
          <span className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>
        <div className="relative min-h-[22rem] overflow-hidden bg-slate-950 p-6 text-white sm:p-7">
          <Image
            src="/brand/quest-world/mission-route-map-v2.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 42vw, 100vw"
            className="object-cover opacity-42 blur-[1px]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(4,8,24,0.92),rgba(4,8,24,0.58)_58%,rgba(251,146,60,0.22))]" />
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="bz-eyebrow text-amber-200">Route Mission</p>
              <h3 className="mt-3 text-display-md font-black leading-tight text-white">{profile.visualTitle}</h3>
              <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-white/72">{quest.title}</p>
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
          <div className="relative z-10 mt-8 flex items-center gap-4 rounded-[1.5rem] border border-white/14 bg-slate-950/62 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            <CreaturePortrait profile={profile} className="h-16 w-16 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">当前要求</p>
              <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-white/82">{quest.target}</p>
            </div>
          </div>
          <div className="relative z-10 mt-5 rounded-[1.25rem] border border-white/12 bg-white/10 p-4">
            <div className="flex items-center justify-between gap-4 text-sm font-black text-white/82">
              <span>{questStatusLabel[quest.status]}</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div {...progressAria(`航线 ${profile.visualTitle} 进度`, progress)} className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/14">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-300 to-emerald-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-brand" />
                <p className="text-sm font-black text-fg-strong">任务目标</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-fg-default">{quest.target}</p>
            </div>
            <div className="rounded-[1.45rem] border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2">
                <PackageOpen className="h-4 w-4 text-brand" />
                <p className="text-sm font-black text-brand-ink">学习收藏卡</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-fg-strong">{quest.reward}</p>
            </div>
            <div className="rounded-[1.45rem] border border-slate-200 bg-white p-4 sm:col-span-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-brand" />
                <p className="text-sm font-black text-fg-strong">Mr.Brown 提醒</p>
              </div>
              <p className="mt-3 text-sm font-semibold leading-7 text-fg-muted">{quest.coachNote}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            收起任务明细
          </button>
          </div>
      </div>
    </div>
  );

  return typeof document === "undefined" ? null : createPortal(dialog, document.body);
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

  // 内测 rank6：领取/抽卡按钮位于 mission-main 区，而错误 role=alert 在页顶 hero 侧栏，
  // 移动端失败时用户看不到任何反馈。失败后把错误块滚入视野（复用 preferredScrollBehavior 惯例）。
  function revealErrorBanner() {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document
        .querySelector("[data-quest-error-anchor]")
        ?.scrollIntoView({ behavior: preferredScrollBehavior(), block: "center" });
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
      revealErrorBanner();
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
      revealErrorBanner();
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
      revealErrorBanner();
    } finally {
      setClaimingSeason(false);
    }
  }

  return (
    <div ref={rootRef} className="space-y-6">
      {/* 审查项 5：自制 md:hidden 锚点条换成共享 SectionNav（全断点 + scrollspy 高亮），与 wealth/market 长页统一。 */}
      <SectionNav
        ariaLabel="任务中心快捷导航"
        items={[
          { id: "season-goals", label: "赛季目标" },
          { id: "sec-quest-map", label: "任务地图" },
          { id: "mission-main", label: "任务锦囊" },
          { id: "mission-queue", label: "任务队列" },
          { id: "companion-album", label: "伙伴图鉴" },
          { id: "sec-quest-progress", label: "收益与成就" },
        ]}
      />
      <section data-quest-reveal data-motion-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-16 top-0 h-64 w-64 rounded-full bg-brand/20 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <p className="bz-eyebrow-inverse">任务中心</p>
            <h2 className="mt-3 max-w-3xl text-display-lg font-semibold md:text-display-xl">
              任务中心：好习惯闯关
            </h2>
            <p className="mt-4 max-w-3xl text-body-lg leading-8 text-white/68">
              把观察、交易、现金管理和复盘拆成可完成的小关卡。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/72">任务完成度</p>
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
                <p className="text-sm font-semibold text-white/72">连续学习</p>
                {/* streak 断裂时不把 0 当失败信号裸展示（评审会 P2·羞耻感暴露）：
                    改为 — + 可立即行动的重启文案，归因指向行动而非能力。 */}
                <p className="mt-3 text-h2 tabular-nums text-white">
                  {questPayload.overview.streakCurrent > 0 ? questPayload.overview.streakCurrent : "—"}
                  <span className="mx-2 text-h3 text-white/70">/</span>
                  {questPayload.overview.streakBest}
                </p>
                <p className="mt-3 text-sm text-white/72">
                  {questPayload.overview.streakCurrent > 0
                    ? "当前 / 历史最佳连续学习回合"
                    : questPayload.overview.streakBest > 0
                      ? `上次连续 ${questPayload.overview.streakBest} 回合 · 本回合做一个理财动作即可重新开始`
                      : "做第一个理财动作，开启你的连续学习记录"}
                </p>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="text-sm font-semibold text-white/72">学习进度</p>
                <p className="mt-3 text-h2 tabular-nums text-white">
                  {questPayload.overview.learningCompleted}
                  <span className="mx-2 text-h3 text-white/70">/</span>
                  {questPayload.overview.learningTotal}
                </p>
                <p className="mt-3 text-sm text-white/72">课程模块完成数</p>
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="bz-eyebrow-inverse">Mr.Brown</p>
                <h2 className="mt-3 text-h1 font-semibold text-white">连续任务导航</h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-warm" />
            </div>
            <p className="mt-4 text-body leading-8 text-white/68">
              Mr.Brown 会把学习动作串成连续任务：先体检，再调整，最后复盘。
            </p>
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
                    {claimResult.reward} 已加入成长轨迹。
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
                    你收藏了 {drawResult.card.name}，已加入“我的卡库”。
                  </p>
                </>
              ) : null}
            </div>
            {claimError && (
              <p role="alert" data-quest-error-anchor className="mt-4 rounded-2xl bg-error-soft p-4 text-sm font-bold text-error">
                {claimError}
              </p>
            )}
            {drawError && (
              <p role="alert" data-quest-error-anchor className="mt-4 rounded-2xl bg-error-soft p-4 text-sm font-bold text-error">
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
                活动权益
              </h2>
              {/* ui-v2 收敛：全页合规免责句群（主卡/领卡横幅/卡库/图鉴/弹窗/活动架 ≥6 处变体）
                  统一收敛为下面这一处声明，其余位置只保留动作反馈。 */}
              <div className="mt-6 rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-warm" />
                  <p data-testid="quest-compliance-statement" className="text-sm font-semibold leading-6 text-white/68">
                    本页任务卡、收藏卡、成就与活动权益只记录学习轨迹，不代表真实收益或投资能力，不改变净值、学习点或学习榜，也不制造付费压力。
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* §19.7 移动端：权益项改横滑卡组，sm 起还原网格。 */}
          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto bg-white p-5 [&>*]:w-[85%] [&>*]:shrink-0 [&>*]:snap-start sm:grid sm:snap-none sm:overflow-visible sm:[&>*]:w-auto sm:[&>*]:shrink md:p-6 xl:grid-cols-2 2xl:grid-cols-3">
            {/* ui-v2 收敛：每项默认只留标题+一行 summary+进度；reward/guardrail 折进 Disclosure。
                Disclosure 内含 button，不能嵌进 <Link>，故拆为 div 卡片 + Link 主体 + 折叠区。 */}
            {questPayload.benefits.items.map((item) => {
              const meta = benefitKindMeta[item.kind];
              const Icon = meta.icon;
              return (
                <div
                  data-motion-card
                  key={item.id}
                  className="flex min-h-[220px] flex-col rounded-[1.55rem] border border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fafc)] p-4 transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-soft"
                >
                  <Link href={item.href} className="group flex flex-1 flex-col rounded-[1rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                    <div className="flex items-start justify-between gap-3">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold", meta.className)}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-fg-muted">
                        {benefitStatusLabel[item.status]}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-1 gap-3">
                      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[1rem] bg-brand-subtle text-brand-ink transition group-hover:scale-105">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="bz-eyebrow bz-brand-text-on-light">{item.label}</p>
                        <h3 className="mt-2 line-clamp-2 text-h2 text-fg-strong">{item.title}</h3>
                        <p className="mt-3 line-clamp-1 text-sm font-semibold leading-6 text-fg-muted">
                          {item.summary}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-fg-muted">
                        <span>完成进度</span>
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
                      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
                        {item.actionLabel}
                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                  {/* 审查 #5：循环内固定 summary，用任务标题区分可访问名（WCAG 2.4.6） */}
                  <Disclosure
                    summary="奖励与边界说明"
                    srContext={item.title}
                    className="mt-3 border-t border-slate-200/80 pt-1"
                    summaryClassName="text-xs text-fg-muted hover:text-brand-ink"
                    panelClassName="text-xs leading-6"
                  >
                    <p className="font-semibold text-fg-strong">{item.reward}</p>
                    <p className="mt-1">{item.guardrail}</p>
                  </Disclosure>
                </div>
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
                连续任务航线
              </h2>
              <p className="mt-4 max-w-2xl text-body leading-8 text-white/68">
                每个目标都是一张可翻开的任务卡：先看要求，再去沙盘完成。
              </p>

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
              先看卡背选择航线，再翻到正面执行任务、领取学习卡。
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
              const visualProfile = questVisualProfileFor(quest, visualIndex);
              const statusText = questStatusLabel[quest.status];
              const progressPercent = Math.round(quest.progress * 100);

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
                      className={cn(
                        "poker-flip-face absolute inset-0 flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-amber-200/60 bg-slate-950 p-0 text-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]",
                        isFlipped ? "pointer-events-none" : "pointer-events-auto",
                      )}
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <MissionCardBackArtwork priority>
                        <button
                          ref={(node) => {
                            questFlipButtonRefs.current[quest.id] = node;
                          }}
                          data-motion-button
                          type="button"
                          data-testid={`quest-flip-${quest.id}`}
                          aria-controls={`quest-card-front-${quest.id}`}
                          aria-expanded={isFlipped}
                          aria-label={`翻开第 ${visualIndex + 1} 张任务卡正面：${quest.title}`}
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="group relative z-20 grid h-full w-full place-items-center overflow-hidden rounded-[1.7rem] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/90"
                        >
                          <span
                            aria-hidden="true"
                            className="absolute inset-5 rounded-[1.45rem] border border-amber-100/22 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_0_46px_rgba(251,191,36,0.14)]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,246,214,0.34),rgba(251,191,36,0.10)_42%,transparent_68%)] blur-sm transition duration-300 group-hover:scale-105"
                          />
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 320 420"
                            className="relative z-10 h-[74%] w-[74%] max-w-[18rem] drop-shadow-[0_22px_46px_rgba(15,23,42,0.38)] transition duration-300 group-hover:-translate-y-1 group-hover:scale-[1.015]"
                          >
                            <defs>
                              <linearGradient id={`mission-back-line-${quest.id}`} x1="0" x2="1" y1="0" y2="1">
                                <stop offset="0%" stopColor="#fff6ce" />
                                <stop offset="45%" stopColor="#f7b955" />
                                <stop offset="100%" stopColor="#79d8c4" />
                              </linearGradient>
                              <radialGradient id={`mission-back-core-${quest.id}`} cx="50%" cy="42%" r="58%">
                                <stop offset="0%" stopColor="#fff8db" stopOpacity="0.95" />
                                <stop offset="52%" stopColor="#f5b84a" stopOpacity="0.26" />
                                <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                              </radialGradient>
                            </defs>
                            <circle cx="160" cy="190" r="132" fill={`url(#mission-back-core-${quest.id})`} opacity="0.8" />
                            <path
                              d="M48 242 C86 190 116 214 148 162 S224 92 278 132"
                              fill="none"
                              stroke={`url(#mission-back-line-${quest.id})`}
                              strokeLinecap="round"
                              strokeWidth="12"
                              opacity="0.88"
                            />
                            <path
                              d="M160 58 L188 141 L276 154 L210 213 L229 300 L160 255 L91 300 L110 213 L44 154 L132 141 Z"
                              fill="rgba(15,23,42,0.34)"
                              stroke={`url(#mission-back-line-${quest.id})`}
                              strokeLinejoin="round"
                              strokeWidth="7"
                              opacity="0.9"
                            />
                            <circle cx="160" cy="190" r="56" fill="rgba(255,250,240,0.20)" stroke="#fff1bd" strokeWidth="4" />
                            <path
                              d="M112 190 C138 160 180 160 208 190 C181 220 139 220 112 190Z"
                              fill="rgba(121,216,196,0.26)"
                              stroke="#bff4e7"
                              strokeWidth="4"
                            />
                            <circle cx="84" cy="118" r="12" fill="#f7b955" opacity="0.9" />
                            <circle cx="254" cy="92" r="15" fill="#79d8c4" opacity="0.78" />
                            <circle cx="260" cy="282" r="22" fill="none" stroke="#fff1bd" strokeWidth="5" opacity="0.58" />
                            <circle cx="70" cy="310" r="17" fill="#f7b955" opacity="0.72" />
                            <path
                              d="M44 358 C92 332 122 374 160 342 S222 312 280 338"
                              fill="none"
                              stroke="#fff1bd"
                              strokeLinecap="round"
                              strokeWidth="6"
                              opacity="0.56"
                            />
                          </svg>
                          <span
                            aria-hidden="true"
                            className="absolute inset-x-12 bottom-10 h-2 rounded-full bg-gradient-to-r from-transparent via-amber-200/62 to-transparent opacity-80"
                          />
                          <span className="absolute bottom-9 left-1/2 z-20 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-amber-100/40 bg-slate-950/76 px-5 py-3 text-sm font-black text-amber-50 shadow-[0_18px_50px_rgba(15,23,42,0.34)] backdrop-blur-xl transition duration-300 group-hover:-translate-y-1 group-hover:border-amber-100/70 group-hover:bg-amber-200 group-hover:text-slate-950">
                            <Sparkles className="h-4 w-4" />
                            翻转卡片
                            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                          </span>
                        </button>
                      </MissionCardBackArtwork>
                    </div>

                    <div
                      id={`quest-card-front-${quest.id}`}
                      data-testid={`quest-card-front-${quest.id}`}
                      aria-hidden={!isFlipped}
                      inert={!isFlipped ? true : undefined}
                      className={cn(
                        "poker-flip-front-face poker-flip-face absolute inset-0 flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-amber-200 bg-[#fffaf0] p-0 text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.16)]",
                        isFlipped ? "pointer-events-auto" : "pointer-events-none",
                      )}
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_0%,rgba(251,191,36,0.52),transparent_36%),linear-gradient(135deg,#12213b,#0f172a_54%,#1e293b)] p-5 text-white">
                        <div className="absolute -right-12 top-3 h-36 w-36 rounded-full bg-amber-200/22 blur-3xl" />
                        <svg aria-hidden="true" viewBox="0 0 320 180" className="pointer-events-none absolute bottom-0 right-0 h-36 w-64 opacity-34">
                          <path d="M22 132 C80 72 128 126 170 70 S242 28 298 66" fill="none" stroke="#f8c46a" strokeWidth="9" strokeLinecap="round" />
                          <circle cx="64" cy="108" r="15" fill="#f8c46a" opacity="0.75" />
                          <circle cx="182" cy="58" r="12" fill="#7dd3c7" opacity="0.7" />
                          <path d="M244 86 l18 42 l44 4 l-34 28 l10 42 l-38 -23 l-38 23 l10 -42 l-34 -28 l44 -4z" fill="none" stroke="#7dd3c7" strokeWidth="5" opacity="0.72" />
                        </svg>
                        <div className="relative z-10 flex items-start justify-between gap-3">
                          <div className="flex min-w-0 gap-3">
                            <CreaturePortrait profile={visualProfile} className="h-14 w-14 ring-4 ring-amber-100/50 sm:h-16 sm:w-16" priority={visualIndex === 0} />
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100">航线通行证</p>
                              <h3 className="mt-1 text-[clamp(1.45rem,6vw,2.25rem)] font-black leading-[1.04] tracking-[-0.04em] text-white sm:text-[clamp(1.85rem,4vw,2.7rem)] sm:leading-[1.02]">
                                {quest.title}
                              </h3>
                              <p className="mt-2 inline-flex rounded-full border border-white/14 bg-white/10 px-3 py-1 text-xs font-bold text-white/78">
                                {visualProfile.creatureName} · {visualProfile.visualTitle}
                              </p>
                            </div>
                          </div>
                        <button
                          type="button"
                          data-testid={`quest-return-back-${quest.id}`}
                          aria-label={`翻回任务卡背面：${quest.title}`}
                          onClick={() => toggleQuestFlip(quest.id)}
                          className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-white/20 bg-white/14 px-3 py-1 text-xs font-black text-white transition hover:bg-white/24 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        >
                          翻回卡背
                        </button>
                        </div>
                        <div className="relative z-10 mt-5 grid gap-3 rounded-[1.35rem] border border-white/12 bg-white/10 p-3 backdrop-blur sm:grid-cols-3">
                          <div className="rounded-[1rem] bg-white/8 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/48">状态</p>
                            <p className="mt-1 text-base font-black text-amber-100">{statusText}</p>
                          </div>
                          <div className="rounded-[1rem] bg-teal-200/12 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/48">进度</p>
                            <p className="mt-1 text-base font-black text-teal-100">{progressPercent}%</p>
                          </div>
                          <div className="rounded-[1rem] bg-amber-200/12 p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/48">概念</p>
                            <p className="mt-1 text-base font-black text-white">{visualProfile.conceptTag}</p>
                          </div>
                        </div>
                      </div>
                      <div className="relative z-10 grid flex-1 gap-4 bg-[linear-gradient(180deg,#fffaf0_0%,#fff7ed_48%,#ffffff_100%)] p-5">
                        <div className="grid gap-3 sm:grid-cols-[1fr_0.9fr]">
                          <div className="rounded-[1.45rem] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-950 text-amber-100">
                                <Target className="h-4 w-4" />
                              </span>
                              本次任务目标
                            </p>
                            <p className="mt-4 text-lg font-black leading-8 tracking-[-0.02em] text-slate-950 md:text-xl">{quest.target}</p>
                          </div>
                          <div className="rounded-[1.45rem] border border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#fff3c4)] p-5 shadow-[0_18px_42px_rgba(217,119,6,0.12)]">
                            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-orange-700">
                              <span className="grid h-8 w-8 place-items-center rounded-full bg-orange-500 text-white">
                                <Gift className="h-4 w-4" />
                              </span>
                              完成后奖励
                            </p>
                            <p className="mt-4 text-lg font-black leading-8 tracking-[-0.02em] text-slate-950 md:text-xl">{quest.reward}</p>
                          </div>
                        </div>
                        <button
                          ref={(node) => {
                            questBackActionRefs.current[quest.id] = node;
                          }}
                          type="button"
                          data-testid={`quest-detail-trigger-${quest.id}`}
                          aria-label={`查看任务详情：${quest.title}`}
                          onClick={() => setDetailQuestId(quest.id)}
                          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-orange-200 bg-white px-5 text-base font-black text-slate-900 shadow-[0_14px_32px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-brand hover:bg-orange-50 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
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
                        <div className="hidden rounded-[1.45rem] border border-dashed border-amber-200 bg-[linear-gradient(135deg,#fff7ed,#f8fafc)] p-4 sm:grid sm:grid-cols-[0.85fr_1fr] sm:items-center sm:gap-4">
                          <QuestCardBackArt tier="basic" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-brand">学习收藏卡</p>
                            <p className="mt-2 text-lg font-black text-slate-950">完成后可领取</p>
                          </div>
                        </div>
                      )}
                      {/* ui-v2 收敛：免责句并入活动权益区的统一声明（quest-compliance-statement）。 */}
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
                          "bz-press mx-5 mb-5 mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
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
            <aside
              id="mission-queue"
              data-testid="quest-queue-panel"
              className="relative flex min-h-[44rem] scroll-mt-24 flex-col overflow-hidden rounded-[1.9rem] border border-white/10 bg-slate-950 p-4 text-white shadow-[0_28px_80px_rgba(15,23,42,0.28)] xl:max-h-[44rem]"
            >
              <div className="pointer-events-none absolute -right-14 -top-12 h-32 w-32 rounded-full bg-amber-300/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-emerald-300/12 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">Mission Dock</p>
                  <h3 className="mt-2 text-h2 font-bold text-white">任务队列</h3>
                  <p className="mt-1 text-xs font-semibold text-white/72">先选航线，再翻牌执行。</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tabular-nums text-white/76">
                  {visibleQuests.length} 个锦囊
                </span>
              </div>
              <div className="relative mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/48">已完成</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-emerald-200">
                    {visibleQuests.filter((quest) => quest.status === "done" || quest.claimed).length}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/48">进行中</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-amber-200">
                    {visibleQuests.filter((quest) => quest.status === "active").length}
                  </p>
                </div>
                <div className="rounded-[1rem] border border-white/10 bg-white/[0.07] p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-white/48">观察</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-sky-200">
                    {visibleQuests.filter((quest) => quest.status === "watch").length}
                  </p>
                </div>
              </div>
              <div className="relative mt-4 rounded-[1.25rem] border border-white/10 bg-white/[0.07] p-3">
                <p className="text-sm font-black text-white">四步流程</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[0.7rem] font-bold text-white/72">
                  {["对话领航", "打开锦囊", "查看任务", "领取卡片"].map((step, index) => (
                    <span key={step} className="rounded-full bg-white/8 px-2.5 py-2">
                      {index + 1}. {step}
                    </span>
                  ))}
                </div>
              </div>
              <div className="relative mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2 shadow-inner shadow-black/10">
                <div className="pointer-events-none absolute left-2 right-4 top-2 z-10 h-8 rounded-t-[1.1rem] bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent" />
                <div
                  data-testid="quest-queue-scroll"
                  className="quest-glass-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2 pr-2 pt-1"
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
              <div className="relative mt-4 rounded-[1.25rem] border border-amber-100/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.15),rgba(15,23,42,0.42))] p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Next Move</p>
                <p className="mt-2 text-sm font-bold leading-6 text-white/78">
                  先点航线看明细，再翻开任务卡；完成后回到队列领取学习卡。
                </p>
              </div>
            </aside>
          </div>
        ) : (
          <p className="mt-6 rounded-[1.7rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-fg-muted">
            {/* 内测 rank11：按筛选分流诚实空态——「解锁」暗示功能限制，对 done/watch 属误导。 */}
            {filter === "done"
              ? "这里还没有已完成的任务——翻开一张任务锦囊，完成后就会出现在这里。"
              : filter === "watch"
                ? "当前没有需要观察的任务，保持这个节奏就很好。"
                : "该分类暂时没有任务，先去完成一次沙盘动作，任务会随行为出现。"}
          </p>
        )}
      </section>

      <QuestCardCollection items={cardCollection} />

      <CompanionAlbum collection={cardCollection} quests={questPayload.quests} />

      <div id="sec-quest-progress" className="grid scroll-mt-24 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
          {/* ui-v2 收敛：免责句并入活动权益区的统一声明（quest-compliance-statement）。 */}
          {/* §19.7 移动端：成就条目改横滑卡组，sm 起还原纵向列表。 */}
          <div
            tabIndex={0}
            aria-label="成就墙横向滚动列表"
            className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-[1.5rem] pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>*]:w-[88%] [&>*]:shrink-0 [&>*]:snap-start sm:block sm:snap-none sm:space-y-3 sm:overflow-visible sm:pb-0 sm:focus-visible:ring-0 sm:[&>*]:w-auto"
          >
            {questPayload.achievements.map((achievement) => (
              <article
                key={achievement.id}
                className={cn(
                  "group rounded-[1.55rem] border p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-950/8",
                  achievement.unlocked
                    ? "border-border-brand bg-gradient-to-br from-amber-50 via-white to-orange-50"
                    : "border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 opacity-78",
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
                          achievement.unlocked ? "bg-amber-100 text-amber-800" : "bg-slate-900 text-white",
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
