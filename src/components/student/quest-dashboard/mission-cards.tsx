"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";

import type { StudentSeasonChallengePayload } from "@/lib/season-challenges";
import { cn } from "@/lib/utils";

import { MissionCardBackArtwork, CreaturePortrait, QuestStatusBadge } from "./card-art";
import { focusAfterFlip, progressAria } from "./shared";
import { questVisualProfileFor, type QuestItem } from "./themes";

export function MissionRouteNode({
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
  const [revealed, setRevealed] = useState(false);
  const isRevealed = revealed;
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const selectButtonRef = useRef<HTMLButtonElement>(null);
  const hasInteractedRef = useRef(false);

  const revealRouteCard = () => {
    hasInteractedRef.current = true;
    setRevealed(true);
  };
  const hideRouteCard = () => {
    hasInteractedRef.current = true;
    setRevealed(false);
  };

  useEffect(() => {
    if (!hasInteractedRef.current) return;
    focusAfterFlip(isRevealed ? selectButtonRef.current : backButtonRef.current);
  }, [isRevealed]);

  return (
    <div
      data-route-node
      data-flip-state={isRevealed ? "front" : "back"}
      key={quest.id}
      className={cn(
        "poker-flip-shell group relative min-h-[156px] rounded-[1.5rem] [perspective:1100px] sm:min-h-[176px]",
        active && "z-10",
      )}
    >
      <div
        data-route-flip-inner
        className={cn(
          "poker-flip-inner quest-flip-inner absolute inset-0 rounded-[1.5rem]",
          isRevealed && "poker-flip-inner-front",
        )}
      >
        <button
          ref={backButtonRef}
          type="button"
          onClick={revealRouteCard}
          aria-label={`翻开航线 ${index + 1} 的任务卡`}
          aria-controls={`mission-route-card-front-${quest.id}`}
          aria-expanded={isRevealed}
          aria-hidden={isRevealed}
          inert={isRevealed ? true : undefined}
          data-testid={`mission-route-card-back-${quest.id}`}
          className="poker-flip-face quest-flip-face absolute inset-0 overflow-hidden rounded-[1.5rem] border border-brand/35 bg-slate-950 p-0 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.22)] transition duration-300 hover:-translate-y-1 hover:border-brand/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [backface-visibility:hidden]"
        >
          <MissionCardBackArtwork>
            <div className="flex items-start justify-between gap-3 p-4">
              <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
                航线 {index + 1}
              </span>
              <span className="rounded-full bg-brand px-3 py-1 text-xs font-black text-slate-950 shadow-glow">
                点击翻开
              </span>
            </div>
            <div className="flex flex-1 items-end p-4 pt-8">
              <div className="w-full rounded-[1.1rem] border border-white/12 bg-slate-950/58 p-3 shadow-inner backdrop-blur-md">
                <p className="text-base font-black text-white sm:text-lg">任务锦囊</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/78">
                  先翻开卡片，再查看目标、进度和下一步行动。
                </p>
              </div>
            </div>
          </MissionCardBackArtwork>
        </button>

        <div
          id={`mission-route-card-front-${quest.id}`}
          role="group"
          aria-label={`选择航线 ${index + 1}：${profile.visualTitle}，${progress}%`}
          aria-hidden={!isRevealed}
          inert={!isRevealed ? true : undefined}
          data-testid={`mission-route-card-front-${quest.id}`}
          className={cn(
            "poker-flip-front-face poker-flip-face quest-flip-face absolute inset-0 overflow-hidden rounded-[1.5rem] border p-3 text-left shadow-sm transition duration-300 sm:p-4 [backface-visibility:hidden]",
            active ? "border-brand bg-white shadow-[0_22px_70px_rgba(240,138,56,0.20)]" : "border-slate-200 bg-white/86 hover:border-brand/40",
          )}
          style={{ background: active ? profile.softBg : undefined }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-2xl" style={{ background: profile.accent }} />
          <div className="relative z-10 flex h-full flex-col">
            <div className="flex items-start justify-between gap-2 sm:gap-3">
              <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-black text-slate-800 shadow-sm">
                航线 {index + 1}
              </span>
              <QuestStatusBadge status={quest.status} />
            </div>
            {/* 中段压成两行（标题 + 角色·概念·进度单行），按钮 mt-auto 贴底 —— 156/176px 内不再叠压。 */}
            <div className="mt-2 flex min-h-0 flex-1 items-center gap-3">
              <CreaturePortrait profile={profile} className="h-12 w-12 shrink-0 transition duration-300 group-hover:-translate-y-1 group-hover:scale-105 sm:h-14 sm:w-14" />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-base font-black text-slate-950 sm:text-lg">{profile.visualTitle}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500">
                  <span className="line-clamp-1">{profile.creatureName}</span>
                  <span className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] font-black text-white">{profile.shortAction}</span>
                  <span className="tabular-nums">{progress}%</span>
                </p>
              </div>
            </div>
            <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-2">
              <button
                ref={selectButtonRef}
                type="button"
                onClick={() => onSelect(quest.id)}
                aria-label={`选择航线 ${index + 1}：${profile.visualTitle}，${progress}%`}
                aria-pressed={active}
                data-testid={`mission-route-select-${quest.id}`}
                className="bz-press inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                选择航线
              </button>
              <button
                type="button"
                onClick={hideRouteCard}
                data-testid={`mission-route-return-${quest.id}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white/75 px-3 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-brand/45 hover:text-brand-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                翻回
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SeasonObjectiveCreatureCard({
  objective,
  index,
}: {
  objective: StudentSeasonChallengePayload["objectives"][number];
  index: number;
}) {
  const [revealed, setRevealed] = useState(false);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const primaryLinkRef = useRef<HTMLAnchorElement>(null);
  const hasInteractedRef = useRef(false);
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
  const revealObjective = () => {
    hasInteractedRef.current = true;
    setRevealed(true);
  };
  const hideObjective = () => {
    hasInteractedRef.current = true;
    setRevealed(false);
  };

  useEffect(() => {
    if (!hasInteractedRef.current) return;
    focusAfterFlip(revealed ? primaryLinkRef.current : backButtonRef.current);
  }, [revealed]);

  return (
    <div
      data-motion-card
      data-objective-creature
      data-flip-state={revealed ? "front" : "back"}
      data-testid={`season-objective-flip-shell-${objective.id}`}
      key={objective.id}
      className="poker-flip-shell group relative min-h-[272px] rounded-[1.55rem] [perspective:1100px]"
    >
      <div
        data-objective-flip-inner
        className={cn(
          "poker-flip-inner quest-flip-inner absolute inset-0 rounded-[1.55rem]",
          revealed && "poker-flip-inner-front",
        )}
      >
        <button
          ref={backButtonRef}
          type="button"
          onClick={revealObjective}
          aria-label={`翻开赛季任务卡 ${index + 1}`}
          aria-controls={`season-objective-card-front-${objective.id}`}
          aria-expanded={revealed}
          aria-hidden={revealed}
          inert={revealed ? true : undefined}
          data-testid={`season-objective-card-back-${objective.id}`}
          className="poker-flip-face quest-flip-face absolute inset-0 overflow-hidden rounded-[1.55rem] border border-brand/35 bg-slate-950 p-0 text-left text-white shadow-[0_18px_50px_rgba(15,23,42,0.20)] transition duration-300 hover:-translate-y-1 hover:border-brand/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand [backface-visibility:hidden]"
        >
          <MissionCardBackArtwork>
            <div className="flex items-start justify-between gap-3 p-4">
              <span className="rounded-full border border-white/18 bg-white/12 px-3 py-1 text-xs font-black text-white shadow-sm backdrop-blur">
                赛季任务 {index + 1}
              </span>
              <span
                data-testid={`season-objective-flip-hint-${objective.id}`}
                className="rounded-full bg-brand px-3 py-1 text-xs font-black text-slate-950 shadow-glow"
              >
                翻开任务
              </span>
            </div>
            <div className="flex flex-1 items-end p-4 pt-8">
              <div className="w-full rounded-[1.1rem] border border-white/12 bg-slate-950/58 p-3 shadow-inner backdrop-blur-md">
                <p className="text-base font-black text-white sm:text-lg">赛季任务卡背</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-white/78">
                  翻开后再查看任务目标、进度和完成入口。
                </p>
              </div>
            </div>
          </MissionCardBackArtwork>
        </button>

        <div
          id={`season-objective-card-front-${objective.id}`}
          aria-hidden={!revealed}
          inert={!revealed ? true : undefined}
          data-testid={`season-objective-card-front-${objective.id}`}
          className={cn(
            "poker-flip-front-face poker-flip-face quest-flip-face absolute inset-0 overflow-hidden rounded-[1.55rem] border p-4 shadow-sm transition duration-300 [backface-visibility:hidden]",
            objective.done ? "border-up/20 bg-up-soft" : "border-slate-200 bg-white hover:border-brand/35",
          )}
          style={{ background: objective.done ? undefined : profile.softBg }}
        >
          <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-2xl" style={{ background: profile.accent }} />
          <div className="relative z-10 flex h-full flex-col">
            {/* 顶行合并「任务正面」标识与进度计数，中段两行标题+描述 —— 272px 内不再叠压。 */}
            <div className="flex items-center justify-between gap-3">
              <CreaturePortrait profile={profile} className="h-12 w-12 shrink-0 transition duration-300 group-hover:-translate-y-1" />
              <span className="flex shrink-0 items-center gap-1.5">
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">任务正面</span>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-sm font-black tabular-nums text-slate-700 shadow-sm">
                  {progressText}
                </span>
              </span>
            </div>
            <div className="mt-2 min-h-0 flex-1">
              <h3 className="line-clamp-1 text-lg font-black text-slate-950">{profile.visualTitle}</h3>
              <p className="mt-1 line-clamp-2 text-sm font-bold leading-6 text-slate-600">{objective.detail}</p>
              <p className="mt-1.5 line-clamp-1 text-xs font-black text-brand-ink">{profile.conceptTag} · {profile.plantLabel}</p>
            </div>
            <div {...progressAria(`${profile.visualTitle} 进度`, objective.done ? 100 : objective.progress * 100)} className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/70">
              <div className="h-full rounded-full" style={{ width: `${Math.max(objective.done ? 100 : 8, objective.progress * 100)}%`, background: profile.accent }} />
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link
                ref={primaryLinkRef}
                href={objective.href}
                aria-label={`去完成赛季任务：${profile.visualTitle}`}
                className="bz-press inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-4 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                去完成
              </Link>
              <button
                type="button"
                onClick={hideObjective}
                aria-label={`翻回赛季任务卡背：${profile.visualTitle}`}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white/70 px-4 text-xs font-black text-slate-700 transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                翻回卡背
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MissionHabitatShelf({
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
        <p className="text-sm font-bold text-slate-700">成长栖息地</p>
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
          已点亮 {unlockedCount} 位伙伴
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

export function MiniQuestCreatureCard({
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
          <p className="mt-1 line-clamp-1 text-xs font-bold text-white/74">{profile.conceptTag} · {profile.shortAction}</p>
          <div {...progressAria(`${profile.visualTitle} 进度`, quest.progress * 100)} className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${Math.max(quest.status === "locked" ? 0 : 8, quest.progress * 100)}%`, background: profile.accent }} />
          </div>
        </div>
      </div>
    </button>
  );
}
