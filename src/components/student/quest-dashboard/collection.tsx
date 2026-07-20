"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BadgeCheck, Lock, Sparkles, X } from "lucide-react";

import { buildCollectionProgress } from "@/lib/cards";
import { questCardDeck } from "@/lib/content";
import { premiumMotion } from "@/lib/motion-system";
import { cn } from "@/lib/utils";

import { QuestCardArt } from "./card-art";
import {
  progressAria,
  questCategoryFromCard,
  questCategoryLabel,
  questWorldAssetBase,
  useModalA11y,
  type QuestCardCollectionView,
} from "./shared";
import { questBoxThemeFor, questBoxThemes, stableQuestThemeIndex, themeForCollectionItem, type QuestItem } from "./themes";

gsap.registerPlugin(useGSAP);

// 收藏编号 = 牌库固定位次（01-12 唯一）；旧的 id 哈希取模会让 12 张卡出现 5 对撞号（评审 visual-2）。
function cardDeckNumber(cardId: string) {
  const index = questCardDeck.findIndex((card) => card.id === cardId);
  return String((index >= 0 ? index : questCardDeck.length) + 1).padStart(2, "0");
}

// 套系集齐后的学习巩固入口（评审 game-design·通关感 + 苏格拉底约束：复用 /learn 小测，
// 奖励必须非稀缺——不发新卡、不加学习点，"奖励"就是把练过的工具串成一次巩固学习）。
const seriesConsolidationCta: Record<import("@/lib/cards").QuestCardSeries, { href: string; label: string }> = {
  foundations: { href: "/learn", label: "用一组小测巩固基础工具" },
  "risk-control": { href: "/learn", label: "做一组风险管理小测串联" },
  "systems-thinking": { href: "/learn", label: "把系统思维讲给自己听：综合小测" },
};

// 学习工具组进度（doc §2.2）：把「N 张已收藏」升级为有完成度的三套系进度，
// 只表达学习路径，不使用数量缺口、完成套系等收集压力词；禁倒计时词。
export function CollectionMeter({ items }: { items: QuestCardCollectionView[] }) {
  const progress = useMemo(
    () => buildCollectionProgress(items.map((item) => item.card.id), questCardDeck),
    [items],
  );
  return (
    <div
      data-testid="collection-meter"
      className="mt-5 grid gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3"
    >
      {progress.map((s) => {
        const pct = s.total > 0 ? Math.round((s.owned / s.total) * 100) : 0;
        return (
          <div key={s.series} className="rounded-[1.1rem] border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-fg-strong">{s.label}</p>
              <span className="text-xs font-bold tabular-nums text-fg-muted">
                {s.owned}/{s.total}
              </span>
            </div>
            <div
              {...progressAria(`${s.label}套系进度`, pct)}
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500",
                  s.complete ? "bg-gradient-to-r from-amber-400 to-amber-500" : "bg-gradient-to-r from-brand via-warning to-up",
                )}
                style={{ width: `${Math.max(s.owned > 0 ? 8 : 0, pct)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-5 text-fg-muted">
              {/* systems-thinking 已由「解锁 4 种工具 / 黑天鹅演练」两个任务触发器接通，
                  三套系全部真实可达，进度文案统一（不再有"即将开放"占位）。 */}
              {s.complete
                ? `✓ ${s.label}工具组已点亮 · 这组工具你都练过一遍`
                : `已收藏 ${s.owned}/${s.total} · 完成对应任务继续点亮`}
            </p>
            {s.complete ? (
              <Link
                href={seriesConsolidationCta[s.series].href}
                data-testid={`series-consolidation-cta-${s.series}`}
                className="bz-press mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-amber-300/70 bg-amber-50 px-3 text-xs font-black text-amber-900 transition hover:-translate-y-0.5 hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {seriesConsolidationCta[s.series].label}
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function QuestCardCollection({ items }: { items: QuestCardCollectionView[] }) {
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
            卡片只记录学习与复盘轨迹，不改变净值、学习点或学习榜。刷新页面后，已经收藏的卡也会继续保留。
          </p>
        </div>
        <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold tabular-nums text-white">
          {items.length} 张已收藏
        </span>
      </div>

      <CollectionMeter items={items} />

      {items.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => {
            const cardTheme = questBoxThemes[stableQuestThemeIndex(item.card.id)];
            const cardNo = cardDeckNumber(item.card.id);
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
                  {questCategoryFromCard(item) ? (
                    <p className="mt-1 text-[11px] font-bold text-brand-ink">
                      呼应你练过的「{questCategoryLabel(questCategoryFromCard(item)!)}」
                    </p>
                  ) : null}
                  <div className="mt-3 rounded-[1.1rem] bg-white/72 p-3 text-xs leading-5 text-fg-muted">
                    来自「{cardTheme.world}」· {questTitle}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 grid gap-5 overflow-hidden rounded-[1.8rem] border border-dashed border-amber-200 bg-[linear-gradient(135deg,#fffaf0,#f8fafc_55%,#eef6ff)] p-5 md:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1fr)] md:p-6">
          <div className="flex min-h-56 flex-col justify-center">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/78 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-brand-ink shadow-sm">
              Card Library
            </span>
            <h3 className="mt-4 text-2xl font-black text-fg-strong">还没有收藏卡片</h3>
            <p className="mt-3 max-w-md text-sm font-semibold leading-7 text-fg-muted">
              完成任务后点击“领取学习卡”，卡片会像学习战利品一样加入这里。它只记录复盘轨迹，不改变净值和排名。
            </p>
            <Link
              href="#mission-main"
              className="mt-5 inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white shadow-[0_14px_34px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              去翻开任务锦囊
            </Link>
          </div>
          <div className="relative min-h-64">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-56 w-40 -translate-x-[82%] -translate-y-1/2 -rotate-12 overflow-hidden rounded-[1.4rem] border border-white/80 bg-slate-950 shadow-2xl shadow-slate-950/18">
              <Image src="/brand/quest-cards/back-basic.svg" alt="" fill sizes="180px" className="object-cover opacity-95" />
            </div>
            <div aria-hidden className="absolute left-1/2 top-1/2 h-60 w-44 -translate-x-1/2 -translate-y-1/2 rotate-3 overflow-hidden rounded-[1.5rem] border border-white/80 bg-slate-950 shadow-2xl shadow-slate-950/22">
              <Image src="/brand/quest-cards/back-advanced.svg" alt="" fill sizes="200px" className="object-cover opacity-95" />
            </div>
            <div aria-hidden className="absolute left-1/2 top-1/2 h-56 w-40 -translate-y-[46%] translate-x-[18%] rotate-12 overflow-hidden rounded-[1.4rem] border border-white/80 bg-slate-950 shadow-2xl shadow-slate-950/18">
              <Image src="/brand/quest-cards/back-system.svg" alt="" fill sizes="180px" className="object-cover opacity-95" />
            </div>
            <div className="absolute bottom-2 left-1/2 w-[min(92%,22rem)] -translate-x-1/2 rounded-[1.4rem] border border-white/80 bg-white/82 p-4 text-center shadow-card backdrop-blur">
              <p className="text-sm font-black text-fg-strong">第一张卡正在等待领取</p>
              <p className="mt-1 text-xs font-semibold text-fg-muted">完成任意可领取锦囊后，这里会自动生成收藏记录。</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// 海报式奖励弹窗（对齐参考图「吉祥物获得弹出界面」）：巨号编号 + 大角色名 + 3D 角色英雄 + 醒目渐变底。
export function MascotRewardModal({
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
  const number = cardDeckNumber(item.card.id);
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
        className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-[720px] overflow-x-hidden overflow-y-auto rounded-[2rem] text-white shadow-[0_40px_120px_rgba(2,6,23,0.5)]"
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
          {/* a11y：主题渐变 from 段为浅色(#fff1d8 等)，白字对比仅 ~1.12:1。左侧文字栏铺深色 scrim
              使白字稳定 ≥4.5:1（大标题更宽裕），右侧渐隐保留角色与渐变的海报观感。 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/55 to-transparent"
          />
          <div className="relative z-10">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-caption font-bold uppercase tracking-[0.2em] backdrop-blur">
              新伙伴加入图鉴 · 第 {number} 张
            </span>
            <h2 className="mt-4 text-display-md font-black leading-[1.05] sm:text-display-lg">{theme.creature}</h2>
            <p className="mt-1 text-h3 font-bold text-white/92">{item.card.name}</p>
            <p className="mt-3 max-w-sm text-body-sm font-medium leading-7 text-white/82">{item.card.teachingLine}</p>
            {questCategoryFromCard(item) ? (
              <p className="mt-2 text-caption font-semibold text-white/80">
                这张卡呼应你刚练的「{questCategoryLabel(questCategoryFromCard(item)!)}」
              </p>
            ) : null}
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

// 伙伴图鉴（对齐参考图「吉祥物待领取界面」）：12 位学习伙伴的鲜亮竖卡栅格，按收藏点亮，未点亮显剪影。
export function CompanionAlbum({
  collection,
  quests,
}: {
  collection: QuestCardCollectionView[];
  quests: QuestItem[];
}) {
  const unlocked = useMemo(() => {
    const set = new Set<string>();
    // 永久里程碑（绝不变灰）：已收藏卡 + 已领取(claimed)的任务——两者都是一次性持久记录。
    // 另把 status==="done"（当前可领取）也点亮做即时反馈（doc §5.5 完成即解锁）。这部分基于 live
    // 指标，若 diversification/cashBuffer 等回合间下跌会回到未点亮——但只影响「尚未领取」的伙伴，
    // 反映「当前已不再达标、需重新完成才能领取」；已领取/已收藏的永久伙伴不受影响，故可接受。
    collection.forEach((item) => set.add(themeForCollectionItem(item, quests).id));
    quests.forEach((quest, index) => {
      if (quest.status === "done" || quest.claimed) set.add(questBoxThemeFor(quest, index).id);
    });
    return set;
  }, [collection, quests]);
  // 任一任务位置可点亮的伙伴集合 = 可达；其余（如 lion-rank/penguin-review）为赛季 roadmap、当前不可达，
  // 不再对其谎称「完成对应任务即可点亮」（避免图鉴永远集不满的习得性无助）。
  const reachableIds = useMemo(
    () => new Set(quests.map((quest, index) => questBoxThemeFor(quest, index).id)),
    [quests],
  );
  const unlockedCount = questBoxThemes.filter((theme) => unlocked.has(theme.id)).length;

  return (
    <section id="companion-album" data-quest-reveal data-testid="companion-album" className="panel scroll-mt-24 rounded-[2rem] p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-fg-strong">伙伴图鉴</h2>
          </div>
          <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
            每收藏一类任务卡，就点亮一位学习伙伴。点亮已开放的伙伴，记录你的学习足迹。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold tabular-nums text-white">
          已点亮 {unlockedCount} 位伙伴
        </span>
      </div>
      {/* §19.7 移动端：图鉴改双行横向流（44% 宽≈2.3 列露出），滑动距离减半；sm 起还原网格。
          itest4 R3 P2：横滑容器内的 article 无可聚焦子元素 → 键盘用户无法滚动查看。给容器
          tabIndex=0 + role/aria-label，使其可聚焦（原生滚动容器聚焦后方向键即可左右滚动）。 */}
      <div
        tabIndex={0}
        role="group"
        aria-label="伙伴图鉴，聚焦后可用方向键左右滚动查看"
        className="mt-6 grid snap-x snap-mandatory grid-flow-col grid-rows-2 auto-cols-[44%] gap-3 overflow-x-auto pb-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [&>*]:snap-start sm:snap-none sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-3 sm:grid-rows-none sm:overflow-visible sm:pb-0 lg:grid-cols-4 xl:grid-cols-6"
      >
        {questBoxThemes.map((theme, index) => {
          const isUnlocked = unlocked.has(theme.id);
          const isRoadmap = !isUnlocked && !reachableIds.has(theme.id);
          return (
            <article
              key={theme.id}
              data-companion-unlocked={isUnlocked ? "true" : "false"}
              aria-label={
                isUnlocked
                  ? `已点亮的学习伙伴：${theme.creature}，来自${theme.world}`
                  : isRoadmap
                    ? `学习伙伴 ${index + 1}，本期暂未开放`
                    : `未点亮的学习伙伴 ${index + 1}，完成对应任务后点亮`
              }
              className={cn(
                "group relative flex aspect-[3/4] flex-col overflow-hidden rounded-[1.3rem] border p-3 shadow-sm transition duration-300",
                isUnlocked ? "border-white/15 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/15" : "border-slate-200 opacity-72",
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
                    isUnlocked ? "" : "opacity-28 grayscale blur-[2.2px] saturate-0",
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
                  {/* 12 任务已一一对应 12 伙伴（systems-thinking 触发器接通），isRoadmap 仅在
                      任务数少于图鉴格数的中途态才出现；文案去时间稀缺（合规），如实说"暂未开放"。 */}
                  {isUnlocked ? theme.world : isRoadmap ? "本期暂未开放" : "完成任务即可点亮"}
                </p>
              </div>
              <span
                className={cn(
                  "mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-wider",
                  isUnlocked ? "bg-white/88 text-slate-950" : "bg-slate-900 text-white",
                )}
              >
                {isUnlocked ? (
                  <>
                    <BadgeCheck className="h-3 w-3" /> 已点亮
                  </>
                ) : isRoadmap ? (
                  <>
                    <Lock className="h-3 w-3" /> 暂未开放
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
