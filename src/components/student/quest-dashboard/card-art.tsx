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
  rarityMeta,
  statusMeta,
} from "./shared";
import { type QuestVisualProfile } from "./themes";

export function QuestCardFallbackArt({ card }: { card: QuestCard }) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-warm">{QUEST_CARD_SERIES_LABEL[questCardSeries(card)]}</p>
          <h3 className={cn("mt-2 font-bold text-white", compact ? "text-lg" : "text-h2")}>{card.name}</h3>
        </div>
      </div>
    </div>
  );
}

export function QuestCardBackArt({ rarity = "common" }: { rarity?: QuestCard["rarity"] }) {
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
    <div className={cn("absolute inset-0 isolate overflow-hidden bg-slate-950", className)}>
      <Image
        src={missionCardBackAsset}
        alt=""
        aria-hidden="true"
        fill
        priority={priority}
        sizes="(min-width: 1280px) 420px, (min-width: 768px) 45vw, 92vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/18 via-slate-950/8 to-slate-950/46" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-950/72 via-slate-950/24 to-transparent" />
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
