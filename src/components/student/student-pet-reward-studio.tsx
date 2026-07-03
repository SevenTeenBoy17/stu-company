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
  Gift,
  Lock,
  PawPrint,
  RefreshCcw,
  Shuffle,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";

import { dispatchAssistantOpen } from "@/lib/assistant-config";
import type { StudentPetPayload, StudentPetReward } from "@/lib/pet-rewards";
import { cn } from "@/lib/utils";
import { useModalA11y } from "./quest-dashboard/shared";

gsap.registerPlugin(useGSAP);

// 成就难度层级标签（非盲盒稀有度）——防射幸：中性化配色，去掉 rose「大奖」晋级色阶，
// 三档都用同族低饱和暖色，只表达「达成难度」而非「抽到稀有」。
const tierLabel: Record<StudentPetReward["tier"], string> = {
  basic: "基础",
  advanced: "进阶",
  honor: "荣誉",
};

const tierClass: Record<StudentPetReward["tier"], string> = {
  basic: "border-white/14 bg-white/[0.07] text-white/72",
  advanced: "border-white/18 bg-white/[0.08] text-white/80",
  honor: "border-brand/30 bg-brand/10 text-brand-warm",
};

// 可切换 3D 卡通形象库（用户需求：20+ 可爱形象随机/自选切换）。
// "default" = 手绘布朗小栗；其余为 quest-world 12 只任务角色 + pet-avatars 10 只新宠，共 23 选。
type PetAvatarChoice = { id: string; label: string; src?: string };

const AVATAR_GALLERY: PetAvatarChoice[] = [
  { id: "default", label: "布朗小栗" },
  { id: "fox", label: "市场小狐", src: "/brand/quest-world/characters/fox-market-scout.webp" },
  { id: "cat", label: "机会侦探猫", src: "/brand/quest-world/characters/cat-opportunity-detective.webp" },
  { id: "whale", label: "现金鲸队长", src: "/brand/quest-world/characters/whale-cash-captain.webp" },
  { id: "panda", label: "研究熊猫", src: "/brand/quest-world/characters/panda-etf-researcher.webp" },
  { id: "robot", label: "雷达机器人", src: "/brand/quest-world/characters/robot-radar-helper.webp" },
  { id: "squirrel", label: "记账松鼠", src: "/brand/quest-world/characters/squirrel-budget-accountant.webp" },
  { id: "rabbit", label: "储蓄小兔", src: "/brand/quest-world/characters/rabbit-savings-banker.webp" },
  { id: "turtle", label: "安全小龟", src: "/brand/quest-world/characters/turtle-safety-guard.webp" },
  { id: "deer", label: "债券小鹿", src: "/brand/quest-world/characters/deer-bond-messenger.webp" },
  { id: "owl", label: "证据猫头鹰", src: "/brand/quest-world/characters/owl-evidence-analyst.webp" },
  { id: "lion", label: "裁判小狮", src: "/brand/quest-world/characters/lion-leaderboard-referee.webp" },
  { id: "penguin", label: "复盘企鹅", src: "/brand/quest-world/characters/penguin-history-archivist.webp" },
  { id: "dino", label: "理财小恐龙", src: "/brand/pet-avatars/pet-dino.webp" },
  { id: "shiba", label: "柴犬金金", src: "/brand/pet-avatars/pet-shiba.webp" },
  { id: "tiger", label: "虎宝存存", src: "/brand/pet-avatars/pet-tiger.webp" },
  { id: "hamster", label: "仓鼠豆豆", src: "/brand/pet-avatars/pet-hamster.webp" },
  { id: "elephant", label: "记账象宝", src: "/brand/pet-avatars/pet-elephant.webp" },
  { id: "frog", label: "青蛙芽芽", src: "/brand/pet-avatars/pet-frog.webp" },
  { id: "unicorn", label: "独角兽星星", src: "/brand/pet-avatars/pet-unicorn.webp" },
  { id: "bear", label: "熊宝藏藏", src: "/brand/pet-avatars/pet-bear.webp" },
  { id: "koi", label: "锦鲤旺旺", src: "/brand/pet-avatars/pet-koi.webp" },
  { id: "chick", label: "小鸡多多", src: "/brand/pet-avatars/pet-chick.webp" },
];

const AVATAR_BY_ID = new Map(AVATAR_GALLERY.map((choice) => [choice.id, choice]));

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RewardGlyph({ reward, small = false }: { reward: StudentPetReward; small?: boolean }) {
  const size = small ? "h-8 w-8" : "h-12 w-12";
  const common = "drop-shadow-[0_10px_24px_rgba(0,0,0,0.24)]";

  if (reward.visual.shape === "cap") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="M10 33 40 17l30 16-30 16Z" fill={reward.visual.accent} />
        <path d="M25 44c8 8 22 8 30 0v12c-8 7-22 7-30 0Z" fill="#101827" opacity="0.88" />
        <circle cx="67" cy="39" r="5" fill="#ffd18d" />
      </svg>
    );
  }

  if (reward.visual.shape === "shield") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="M40 10 64 20v18c0 16-9 27-24 34-15-7-24-18-24-34V20Z" fill={reward.visual.accent} />
        <path d="m28 39 8 8 17-20" fill="none" stroke="#fff8ed" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
      </svg>
    );
  }

  if (reward.visual.shape === "leaf") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="M62 16C35 16 18 31 18 56c24 2 43-12 44-40Z" fill={reward.visual.accent} />
        <path d="M24 56c10-14 22-23 37-35" fill="none" stroke="#fff8ed" strokeLinecap="round" strokeWidth="4" />
      </svg>
    );
  }

  if (reward.visual.shape === "crown") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="M16 54h48l5-30-18 13-11-20-11 20-18-13Z" fill={reward.visual.accent} />
        <path d="M20 58h40v7H20Z" fill="#fff0d8" />
      </svg>
    );
  }

  if (reward.visual.shape === "map") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="m16 19 16-6 16 6 16-6v48l-16 6-16-6-16 6Z" fill={reward.visual.accent} />
        <path d="M32 13v48M48 19v48" stroke="#fff8ed" strokeWidth="4" opacity="0.8" />
      </svg>
    );
  }

  if (reward.visual.shape === "spark") {
    return (
      <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
        <path d="M40 8 48 31l24 9-24 9-8 23-8-23-24-9 24-9Z" fill={reward.visual.accent} />
        <circle cx="58" cy="18" r="5" fill="#fff1cc" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 80 80" className={cn(size, common)} aria-hidden="true">
      <circle cx="40" cy="40" r="28" fill={reward.visual.accent} />
      <circle cx="40" cy="40" r="18" fill="#fff8ed" opacity="0.24" />
      <path d="M30 41h20M40 31v20" stroke="#fff8ed" strokeLinecap="round" strokeWidth="5" />
    </svg>
  );
}

function PetMascot({
  payload,
  selectedReward,
  avatar,
}: {
  payload: StudentPetPayload;
  selectedReward?: StudentPetReward;
  avatar?: PetAvatarChoice;
}) {
  const mood = payload.pet.mood;
  const earTilt = mood === "alert" ? -8 : mood === "celebrating" ? 8 : 0;
  const eyeScale = mood === "focused" ? 0.72 : 1;
  const cheek = selectedReward?.visual.accent ?? "#f08a38";

  return (
    <div
      data-pet-avatar
      data-motion-float
      className="relative mx-auto flex aspect-square max-h-[260px] min-h-[210px] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[2.4rem] border border-white/10 bg-white/[0.06]"
      style={{ boxShadow: selectedReward ? `0 24px 80px ${selectedReward.visual.glow}` : undefined }}
    >
      {avatar?.src ? (
        <Image
          src={avatar.src}
          alt={`${avatar.label}，${payload.pet.moodLabel}`}
          fill
          sizes="260px"
          className="object-cover"
          priority={false}
        />
      ) : null}
      <div data-reward-orbit className="absolute right-5 top-5 z-10 rounded-3xl border border-white/12 bg-white/[0.08] p-2 backdrop-blur-sm">
        {selectedReward ? <RewardGlyph reward={selectedReward} small /> : <PawPrint className="h-8 w-8 text-brand-warm" />}
      </div>
      {avatar?.src ? null : (
      <svg viewBox="0 0 260 260" className="h-[230px] w-[230px]" role="img" aria-label={`${payload.pet.name}，${payload.pet.moodLabel}`}>
        <defs>
          <radialGradient id="petBody" cx="42%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff1ce" />
            <stop offset="58%" stopColor="#f5a14b" />
            <stop offset="100%" stopColor="#b75b28" />
          </radialGradient>
          <linearGradient id="petBelly" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#fff8e9" />
            <stop offset="100%" stopColor="#ffd89e" />
          </linearGradient>
        </defs>
        <g transform={`rotate(${earTilt} 130 130)`}>
          <path d="M74 78 48 38c-5-8 4-17 12-11l39 28Z" fill="#f6aa58" />
          <path d="M186 78 212 38c5-8-4-17-12-11l-39 28Z" fill="#f6aa58" />
        </g>
        <path d="M58 145c0-53 34-91 72-91s72 38 72 91c0 44-29 75-72 75s-72-31-72-75Z" fill="url(#petBody)" />
        <path d="M91 158c0-26 17-44 39-44s39 18 39 44c0 28-16 48-39 48s-39-20-39-48Z" fill="url(#petBelly)" opacity="0.9" />
        <g transform={`scale(1 ${eyeScale}) translate(0 ${eyeScale === 1 ? 0 : 10})`}>
          <circle cx="105" cy="125" r="8" fill="#111827" />
          <circle cx="155" cy="125" r="8" fill="#111827" />
          <circle cx="108" cy="122" r="2.5" fill="#fff" />
          <circle cx="158" cy="122" r="2.5" fill="#fff" />
        </g>
        <path d="M121 145c6 5 12 5 18 0" fill="none" stroke="#111827" strokeLinecap="round" strokeWidth="5" />
        <circle cx="88" cy="146" r="9" fill={cheek} opacity="0.32" />
        <circle cx="172" cy="146" r="9" fill={cheek} opacity="0.32" />
        <path d="M56 159c-24 5-36-5-38-20 17 10 30 9 42 0" fill="none" stroke="#f2a45d" strokeLinecap="round" strokeWidth="10" />
        {selectedReward?.visual.shape === "cap" ? (
          <g transform="translate(85 45)">
            <RewardGlyph reward={selectedReward} />
          </g>
        ) : null}
      </svg>
      )}
      <span data-reward-burst className="pointer-events-none absolute left-7 top-8 h-3 w-3 rounded-full bg-brand-warm shadow-[0_0_32px_rgba(240,138,56,0.85)]" />
      <span className="pointer-events-none absolute bottom-8 right-10 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_26px_rgba(120,216,173,0.8)]" />
    </div>
  );
}

function AvatarPickerModal({
  currentId,
  onSelect,
  onClose,
}: {
  currentId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useModalA11y(containerRef, onClose, closeButtonRef);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="选择伙伴形象"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-[1.8rem] border border-white/10 bg-slate-950 p-5 text-white shadow-2xl sm:rounded-[1.8rem] sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-h2 font-semibold">选择伙伴形象</h3>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.07] transition hover:border-brand/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-body-sm text-white/60">{AVATAR_GALLERY.length} 位 3D 伙伴，随时可换，仅影响展示。</p>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {AVATAR_GALLERY.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={choice.id === currentId}
              onClick={() => {
                onSelect(choice.id);
                onClose();
              }}
              className={cn(
                "bz-press group flex flex-col items-center gap-2 rounded-[1.2rem] border p-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                choice.id === currentId
                  ? "border-brand/60 bg-brand/15"
                  : "border-white/10 bg-white/[0.05] hover:border-brand/35 hover:bg-white/[0.09]",
              )}
            >
              <span className="relative h-16 w-16 overflow-hidden rounded-[0.9rem] border border-white/10 bg-white/[0.06] sm:h-[4.5rem] sm:w-[4.5rem]">
                {choice.src ? (
                  <Image src={choice.src} alt="" fill sizes="72px" className="object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <PawPrint className="h-7 w-7 text-brand-warm" />
                  </span>
                )}
              </span>
              <span className="text-caption font-semibold text-white/85">{choice.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TrailItem({ item }: { item: StudentPetPayload["timeline"][number] }) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-caption font-semibold",
          item.unlocked
            ? "border-brand/40 bg-brand text-slate-950"
            : "border-white/10 bg-white/[0.05] text-white/70",
        )}
      >
        {item.unlocked ? <BadgeCheck className="h-4 w-4" /> : item.round}
      </span>
      <div>
        <p className={cn("text-body-sm font-semibold", item.unlocked ? "text-white" : "text-white/70")}>{item.label}</p>
        <p className="mt-1 text-caption leading-5 text-white/70">{item.detail}</p>
      </div>
    </div>
  );
}

export function StudentPetRewardStudio({ initialPayload }: { initialPayload: StudentPetPayload }) {
  const rootRef = useRef<HTMLElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const firstUnlockedReward = payload.rewards.find((item) => item.unlocked) ?? payload.rewards[0];
  const [selectedRewardId, setSelectedRewardId] = useState(firstUnlockedReward?.id ?? "");
  const [status, setStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const storageKey = `brown-zone-pet-equipped-${payload.pet.id}`;

  // 3D 形象切换：SSR 一律先渲染默认形象，挂载后再读 localStorage 换装（水合安全）。
  const [avatarId, setAvatarId] = useState("default");
  const [isAvatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const avatarStorageKey = `brown-zone-pet-avatar-${payload.pet.id}`;
  const avatar = AVATAR_BY_ID.get(avatarId) ?? AVATAR_BY_ID.get("default");

  useEffect(() => {
    const saved = window.localStorage.getItem(avatarStorageKey);
    if (saved && AVATAR_BY_ID.has(saved)) setAvatarId(saved);
  }, [avatarStorageKey]);

  function selectAvatar(id: string) {
    setAvatarId(id);
    window.localStorage.setItem(avatarStorageKey, id);
  }

  function randomAvatar() {
    const others = AVATAR_GALLERY.filter((choice) => choice.id !== avatarId);
    selectAvatar(others[Math.floor(Math.random() * others.length)].id);
  }

  const selectedReward = useMemo(
    () => payload.rewards.find((item) => item.id === selectedRewardId) ?? firstUnlockedReward,
    [firstUnlockedReward, payload.rewards, selectedRewardId],
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const savedReward = payload.rewards.find((item) => item.id === saved && item.unlocked);
    if (savedReward) {
      setSelectedRewardId(savedReward.id);
    } else if (firstUnlockedReward) {
      setSelectedRewardId(firstUnlockedReward.id);
    }
  }, [firstUnlockedReward, payload.rewards, storageKey]);

  useEffect(() => {
    if (selectedReward?.unlocked) {
      window.localStorage.setItem(storageKey, selectedReward.id);
    }
  }, [selectedReward, storageKey]);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-pet-panel], [data-pet-avatar], [data-pet-stat], [data-reward-card]", {
          opacity: 1,
          clearProps: "transform",
        });
        return;
      }

      // `data-pet-panel` is the useGSAP scope root (rootRef); a scoped
      // "[data-pet-panel]" selector matches no descendant, so the panel entrance
      // was silently dropped. Target the root element directly.
      if (rootRef.current) {
        gsap.from(rootRef.current, {
          y: 22,
          opacity: 0,
          duration: 0.62,
          ease: "power3.out",
        });
      }
      gsap.from("[data-pet-stat]", {
        y: 12,
        opacity: 0,
        duration: 0.48,
        stagger: 0.045,
        ease: "power3.out",
      });
      gsap.fromTo(
        "[data-pet-avatar]",
        { rotate: -2, scale: 0.96 },
        { rotate: 0, scale: 1, duration: 0.72, ease: "back.out(1.55)" },
      );
      gsap.from("[data-reward-card]", {
        x: 14,
        opacity: 0,
        duration: 0.5,
        stagger: 0.035,
        ease: "power3.out",
      });
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        "[data-reward-orbit]",
        { scale: 0.76, rotate: -12, opacity: 0.7 },
        { scale: 1, rotate: 0, opacity: 1, duration: 0.54, ease: "back.out(1.6)" },
      );
      gsap.fromTo(
        "[data-reward-burst]",
        { scale: 0, opacity: 0.1 },
        { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" },
      );
    },
    { scope: rootRef, dependencies: [selectedRewardId] },
  );

  async function refreshPet() {
    setIsRefreshing(true);
    setStatus("");
    try {
      const response = await fetch("/api/student/pet-rewards", { cache: "no-store" });
      const data = (await response.json()) as { payload?: StudentPetPayload; message?: string; error?: string };
      if (!response.ok || !data.payload) {
        throw new Error(data.message ?? "萌宠奖励刷新失败，请稍后重试。");
      }
      setPayload(data.payload);
      setStatus("萌宠状态已同步到最新沙盘行为。");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "萌宠奖励刷新失败，请稍后重试。");
    } finally {
      setIsRefreshing(false);
    }
  }

  const stats = [
    { label: "能量", value: payload.pet.energy, detail: "现金流与节奏" },
    { label: "信任", value: payload.pet.trust, detail: "回合与奖励记录" },
    { label: "专注", value: payload.pet.focus, detail: "纪律与学习" },
  ];

  // 成长轨迹减字：常显最近 2 个已解锁 + 下一个待解锁目标，其余收进「查看全部」。
  const unlockedTrail = payload.timeline.filter((item) => item.unlocked);
  const nextLockedTrail = payload.timeline.find((item) => !item.unlocked);
  const focusIds = new Set(
    [...unlockedTrail.slice(-2), ...(nextLockedTrail ? [nextLockedTrail] : [])].map((item) => item.id),
  );
  const trailFocus = payload.timeline.filter((item) => focusIds.has(item.id));
  const trailRest = payload.timeline.filter((item) => !focusIds.has(item.id));

  return (
    <section
      ref={rootRef}
      data-pet-panel
      data-motion-reveal
      data-testid="student-pet-reward-studio"
      className="@container/petstudio overflow-hidden rounded-[2.2rem] bg-slate-950 text-white shadow-[0_32px_90px_rgba(15,23,42,0.2)]"
    >
      {/* 布局按面板自身宽度分级（此前固定 xl 三栏在 1440 视口把中列压到 258px → 一行一字）：
          <50rem 全部纵排；≥50rem 左形象+中内容双栏、奖励区横跨底部；≥70rem 三栏（平台 max-w-screen-2xl 下面板最宽 1215px，70rem=1120px 保证该档真实可达）。 */}
      <div className="relative grid gap-0 @[50rem]/petstudio:grid-cols-[320px_minmax(0,1fr)] @[70rem]/petstudio:grid-cols-[330px_minmax(0,1fr)_390px]">
        <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
        <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-24 h-64 w-64 rounded-full bg-emerald-300/10 blur-3xl" />

        {/* ── Left: mascot column ── */}
        <div className="relative z-10 border-b border-white/10 p-5 sm:p-6 @[50rem]/petstudio:border-b-0 @[50rem]/petstudio:border-r">
          <div className="flex items-center justify-between gap-3">
            <div>
              {/* Eyebrow on dark panel → bz-eyebrow-inverse */}
              <p className="bz-eyebrow-inverse">Pet Studio</p>
              {/* Card/section title → font-semibold (was font-black) */}
              <h2 className="mt-2 text-h1 font-semibold tracking-tight md:text-display-sm">{payload.pet.name}</h2>
              <p className="mt-1 text-body-sm text-white/70">
                {payload.pet.species} / {payload.pet.stageLabel}
              </p>
            </div>
            <span className="rounded-full border border-white/12 bg-white/[0.07] px-3 py-1.5 text-body-sm font-semibold text-brand-warm">
              Lv.{payload.pet.level}
            </span>
          </div>
          <PetMascot payload={payload} selectedReward={selectedReward} avatar={avatar} />
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              data-motion-button
              type="button"
              onClick={() => setAvatarPickerOpen(true)}
              className="bz-press inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-4 text-body-sm font-semibold text-white transition hover:border-brand/40 hover:bg-brand/20"
            >
              <WandSparkles className="h-4 w-4 text-brand-warm" />
              切换形象
            </button>
            <button
              data-motion-button
              type="button"
              aria-label="随机换一位伙伴形象"
              onClick={randomAvatar}
              className="bz-press inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.08] px-4 text-body-sm font-semibold text-white transition hover:border-brand/40 hover:bg-brand/20"
            >
              <Shuffle className="h-4 w-4 text-brand-warm" />
              随机
            </button>
          </div>
          {/* 评审 P1：面板根的 @container(container-type) 与 GSAP 残留 transform 都会把 fixed
              后代的包含块改成面板自身（遮罩只盖面板且被 overflow-hidden 裁剪）——必须 portal 到 body。
              仅在客户端点击后挂载，无 SSR/水合风险。 */}
          {isAvatarPickerOpen
            ? createPortal(
                <AvatarPickerModal currentId={avatarId} onSelect={selectAvatar} onClose={() => setAvatarPickerOpen(false)} />,
                document.body,
              )
            : null}
          <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-body-sm font-semibold text-white">成长经验</span>
              <span className="text-body-sm font-semibold text-brand-warm">
                {payload.pet.xpToNext > 0 ? `还差 ${payload.pet.xpToNext} XP` : "满级训练中"}
              </span>
            </div>
            <div data-motion-viz className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                data-motion-viz-bar
                data-motion-origin="left center"
                className="h-full rounded-full bg-gradient-to-r from-brand via-warning to-emerald-300"
                style={{ width: `${Math.max(8, payload.pet.xpProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Centre: stats + actions ──
            @container：下方 Next Quest/成长轨迹 双栏只在本列自身 ≥44rem 时开启，
            防止 xl 外层三栏把中列压窄后再对半分（曾出现一行一字的竖条）。 */}
        <div className="@container relative z-10 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-body-sm font-semibold text-brand-warm">
                <PawPrint className="h-4 w-4" />
                {payload.pet.moodLabel}
              </div>
              {/* ONE hero: the streak/reward count rendered via text-hero-num below on the
                  stat cards. The headline here is the mascot's title → display size, font-semibold */}
              <h3 className="mt-4 text-display-sm font-semibold leading-tight md:text-display-md">{payload.pet.headline}</h3>
              {/* 减字：教练详评默认收起，点击展开（用户反馈：界面文字过多，细节转点击查看） */}
              <details className="group/coach mt-3 max-w-3xl">
                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-body-sm font-semibold text-white/80 transition hover:border-brand/40 hover:text-white [&::-webkit-details-marker]:hidden">
                  教练详评
                  <ArrowRight className="h-3.5 w-3.5 transition group-open/coach:rotate-90" />
                </summary>
                <p className="mt-3 text-body leading-8 text-white/64">{payload.pet.coachNote}</p>
              </details>
            </div>
            <button
              data-motion-button
              type="button"
              aria-label="同步萌宠状态"
              onClick={() => void refreshPet()}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-4 text-body-sm font-semibold text-white transition hover:border-brand/40 hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              同步萌宠
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {stats.map((stat, index) => (
              <div key={stat.label} data-pet-stat data-motion-card className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body-sm font-semibold text-white">{stat.label}</p>
                  {/* Hero number on the FIRST stat (streak/energy — most prominent); others → text-h2.
                      .bz-hero-stat = LIGHT amber-50 chip; on this dark card it makes the amber-300
                      text fail AA, so keep the hero-num scale without the light chip. */}
                  {index === 0 ? (
                    <span className="text-hero-num tabular-nums text-brand-warm">{stat.value}</span>
                  ) : (
                    <span className="text-h2 tabular-nums text-brand-warm">{stat.value}</span>
                  )}
                </div>
                <div data-motion-viz className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    data-motion-viz-bar
                    data-motion-origin="left center"
                    className="h-full rounded-full bg-gradient-to-r from-brand to-emerald-300"
                    style={{ width: `${stat.value}%` }}
                  />
                </div>
                <p className="mt-3 text-caption text-white/70">{stat.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 @[44rem]:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  {/* Eyebrow on dark → bz-eyebrow-inverse */}
                  <p className="bz-eyebrow-inverse">Next Quest</p>
                  <h4 className="mt-2 text-h2 font-semibold">下一步让伙伴长大</h4>
                </div>
                <WandSparkles className="h-5 w-5 text-brand-warm" />
              </div>
              <div className="mt-4 grid gap-3">
                {payload.nextActions.map((action) => (
                  <Link
                    data-motion-card
                    key={action.id}
                    href={action.href}
                    className="group rounded-[1.2rem] border border-white/10 bg-slate-950/35 p-3 transition hover:border-brand/40 hover:bg-brand/12"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-body-sm font-semibold text-white">{action.title}</p>
                        <p className="mt-1 line-clamp-2 text-caption leading-5 text-white/70">{action.detail}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-brand-warm transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-4">
              {/* Eyebrow on dark → bz-eyebrow-inverse */}
              <p className="bz-eyebrow-inverse">Memory Trail</p>
              <h4 className="mt-2 text-h2 font-semibold">成长轨迹</h4>
              {/* 减字：常显=最近 2 个已解锁 + 下一个目标；其余里程碑收进「查看全部」。 */}
              <div className="mt-4 space-y-3">
                {trailFocus.map((item) => (
                  <TrailItem key={item.id} item={item} />
                ))}
              </div>
              {trailRest.length > 0 ? (
                <details className="group/trail mt-3">
                  <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 text-body-sm font-semibold text-white/80 transition hover:border-brand/40 hover:text-white [&::-webkit-details-marker]:hidden">
                    查看全部 {payload.timeline.length} 个里程碑
                    <ArrowRight className="h-3.5 w-3.5 transition group-open/trail:rotate-90" />
                  </summary>
                  <div className="mt-3 space-y-3">
                    {trailRest.map((item) => (
                      <TrailItem key={item.id} item={item} />
                    ))}
                  </div>
                </details>
              ) : null}
            </div>
          </div>

          {status ? (
            <p role="status" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-body-sm text-white/70">
              {status}
            </p>
          ) : null}
        </div>

        {/* ── Right: reward codex ── */}
        <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] p-5 sm:p-6 @[50rem]/petstudio:col-span-2 @[70rem]/petstudio:col-span-1 @[70rem]/petstudio:border-l @[70rem]/petstudio:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              {/* Eyebrow on dark → bz-eyebrow-inverse */}
              <p className="bz-eyebrow-inverse">Reward Codex</p>
              <h3 className="mt-2 text-h1 font-semibold">奖励图鉴</h3>
              <p className="mt-2 text-body-sm text-white/70">
                {payload.summary.unlocked}/{payload.summary.total} 已点亮 / 下一件：{payload.summary.nextRewardTitle}
              </p>
            </div>
            <Gift className="h-6 w-6 text-brand-warm" />
          </div>

          <div className="mt-5 grid max-h-[560px] gap-3 overflow-y-auto pr-1 @[50rem]/petstudio:grid-cols-2 @[70rem]/petstudio:grid-cols-1">
            {payload.rewards.map((reward) => {
              const active = selectedReward?.id === reward.id;
              return (
                <button
                  data-reward-card
                  data-motion-card
                  key={reward.id}
                  type="button"
                  aria-label={`${reward.unlocked ? "装备奖励" : "查看解锁条件"}：${reward.title}`}
                  onClick={() => {
                    if (reward.unlocked) {
                      setSelectedRewardId(reward.id);
                      setStatus(`${reward.title} 已装备到 ${payload.pet.name}。`);
                    } else {
                      setStatus(reward.unlockHint);
                    }
                  }}
                  className={cn(
                    "w-full rounded-[1.35rem] border p-3 text-left transition",
                    reward.unlocked
                      ? "border-white/10 bg-white/[0.07] hover:border-brand/40 hover:bg-brand/12"
                      : "border-white/8 bg-white/[0.03] opacity-72",
                    active && "border-brand/60 bg-brand/16 shadow-[0_18px_48px_rgba(240,138,56,0.18)]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn("rounded-2xl p-2", reward.unlocked ? "bg-white/[0.08]" : "bg-white/[0.04] grayscale")}>
                      {reward.unlocked ? <RewardGlyph reward={reward} small /> : <Lock className="h-8 w-8 text-white/70" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-body-sm font-semibold text-white">{reward.title}</p>
                        <span className={cn("rounded-full border px-2 py-0.5 text-caption font-semibold", tierClass[reward.tier])}>
                          {tierLabel[reward.tier]}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-caption leading-5 text-white/70">
                        {reward.unlocked ? reward.description : reward.unlockHint}
                      </p>
                      {/* Source label — eyebrow pattern on dark */}
                      <p className="mt-2 bz-eyebrow-inverse text-brand-warm">{reward.source}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div data-motion-reward className="mt-5 rounded-[1.35rem] border border-brand/25 bg-brand/12 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-1 h-5 w-5 shrink-0 text-brand-warm" />
              <p className="text-body-sm leading-6 text-white/68">{payload.summary.safetyNote}</p>
            </div>
            <button
              data-motion-button
              type="button"
              aria-label="让 KeyAI 解释奖励建议"
              onClick={() =>
                dispatchAssistantOpen({
                  prompt: `请结合我的萌宠状态（${payload.pet.moodLabel}，等级 ${payload.pet.level}）和已解锁奖励，解释下一步该训练哪个理财习惯。`,
                  autoSend: true,
                })
              }
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-body-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5"
            >
              让 KeyAI 解释奖励建议
              <ArrowRight className="h-4 w-4" />
            </button>
            <p className="mt-3 text-caption text-white/70">更新于 {formatTime(payload.generatedAt)}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
