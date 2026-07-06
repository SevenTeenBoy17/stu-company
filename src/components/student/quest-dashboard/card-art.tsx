"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { BadgeCheck, Lock } from "lucide-react";

import { QUEST_CARD_SERIES_LABEL, questCardSeries, type QuestCard } from "@/lib/cards";
import type { StudentQuestPayload, StudentQuestStatus } from "@/lib/quests";
import { cn } from "@/lib/utils";

import {
  achievementBadgeAssets,
  achievementBadgeAssetBase,
  missionCardBackAsset,
  questCardAssetBase,
  questWorldAssetBase,
  tierMeta,
  statusMeta,
} from "./shared";
import { type QuestVisualProfile } from "./themes";

export function QuestCardFallbackArt({ card }: { card: QuestCard }) {
  const meta = tierMeta[card.tier];

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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">{QUEST_CARD_SERIES_LABEL[questCardSeries(card)]}</p>
          <h3 className="mt-2 text-h2 font-bold text-white">{card.name}</h3>
        </div>
      </div>
    </div>
  );
}

export function QuestCardArt({
  card,
  compact = false,
  className,
}: {
  card: QuestCard;
  compact?: boolean;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = tierMeta[card.tier];

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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">{QUEST_CARD_SERIES_LABEL[questCardSeries(card)]}</p>
          <h3 className={cn("mt-2 font-bold text-white", compact ? "text-lg" : "text-h2")}>{card.name}</h3>
        </div>
      </div>
    </div>
  );
}

export function QuestCardBackArt({ tier = "basic" }: { tier?: QuestCard["tier"] }) {
  const [imageFailed, setImageFailed] = useState(false);
  const meta = tierMeta[tier];

  return (
    <div className="relative mt-4 min-h-32 overflow-hidden rounded-[1.25rem] border border-white/10 bg-white/[0.06]">
      {imageFailed ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(242,162,69,0.28),transparent_42%),linear-gradient(135deg,#111827,#020617)]" />
      ) : (
        <Image
          src={`${questCardAssetBase}/back-${tier}.svg`}
          alt={`${meta.label} 卡背插画`}
          fill
          sizes="(min-width: 1280px) 320px, 92vw"
          className="object-cover opacity-95"
          onError={() => setImageFailed(true)}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/64 via-transparent to-slate-950/70" />
      <div className="relative z-10 flex min-h-32 flex-col justify-end p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">学习收藏卡</p>
        <p className="mt-1 text-sm font-bold text-white">完成任务后领取</p>
      </div>
    </div>
  );
}

export function MissionCardBackArtwork({
  children,
  className,
  priority = false,
}: {
  children: ReactNode;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 isolate overflow-hidden bg-[#fff5df]", className)}>
      <Image
        src={missionCardBackAsset}
        alt=""
        aria-hidden="true"
        fill
        priority={priority}
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 45vw, 92vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,244,205,0.58),transparent_34%),radial-gradient(circle_at_78%_28%,rgba(125,211,199,0.32),transparent_32%),linear-gradient(145deg,rgba(255,247,237,0.16),rgba(15,23,42,0.18)_48%,rgba(15,23,42,0.50))]" />
      <div className="absolute inset-x-5 top-5 h-20 rounded-full bg-amber-100/18 blur-2xl" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-slate-950/80 via-slate-950/28 to-transparent" />
      <svg
        aria-hidden="true"
        viewBox="0 0 360 460"
        className="absolute inset-x-4 top-10 h-[62%] w-[calc(100%-2rem)] opacity-95"
      >
        <defs>
          <linearGradient id="mission-card-glow" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f8c46a" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#7dd3c7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#f08a2f" stopOpacity="0.78" />
          </linearGradient>
          <radialGradient id="mission-card-orb" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="180" cy="176" r="126" fill="url(#mission-card-orb)" opacity="0.32" />
        <path
          d="M44 244 C92 186 118 205 156 160 S230 104 306 136"
          fill="none"
          stroke="url(#mission-card-glow)"
          strokeLinecap="round"
          strokeWidth="12"
          opacity="0.76"
        />
        <path
          d="M180 72 L207 143 L284 154 L226 205 L243 282 L180 242 L117 282 L134 205 L76 154 L153 143 Z"
          fill="none"
          stroke="url(#mission-card-glow)"
          strokeLinejoin="round"
          strokeWidth="8"
          opacity="0.74"
        />
        <circle cx="82" cy="292" r="19" fill="#f8c46a" opacity="0.72" />
        <circle cx="284" cy="92" r="15" fill="#7dd3c7" opacity="0.64" />
        <circle cx="286" cy="262" r="28" fill="none" stroke="#f8c46a" strokeWidth="5" opacity="0.54" />
      </svg>
      <div aria-hidden className="absolute inset-4 rounded-[1.55rem] border border-amber-100/24 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
      {/* 光泽扫过只放在深色卡背、且在 z-10 文字层之下 —— 永不覆盖正面文字。 */}
      <div aria-hidden className="poker-gloss" />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}

export function CreaturePortrait({
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

export function QuestStatusBadge({ status }: { status: StudentQuestStatus }) {
  const meta = statusMeta[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export function AchievementBadgeArt({
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
          : "border-slate-200 opacity-32 grayscale blur-[2px] saturate-0",
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
      {!achievement.unlocked ? (
        <span aria-hidden="true" className="absolute inset-0 bg-white/38" />
      ) : null}
    </div>
  );
}
