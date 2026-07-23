"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  CheckCircle2,
  Compass,
  Flame,
  Grid3X3,
  Layers3,
  LineChart,
  Loader2,
  Map as MapIcon,
  ShieldCheck,
  Sparkles,
  Trophy,
  WalletCards,
} from "lucide-react";

import type { SeasonClaimResult, StudentSeasonChallengePayload } from "@/lib/season-challenges";
import type {
  StudentHomeHubPayload,
  StudentServiceEntry,
  StudentServiceGroupKey,
} from "@/lib/student-service-map";
import { studentServiceGroups } from "@/lib/student-service-map";
import { cn } from "@/lib/utils";
import { Disclosure } from "@/components/shared/disclosure";
import { MarketThermometer } from "@/components/student/market-thermometer";

gsap.registerPlugin(useGSAP);

// 服务九宫格改用工具/场景类图标，避免和任务中心的 3D 角色头像重复。
// 卡片只留 图标+标题+关键词；summary/learn 与状态完整保留在 aria-label（读屏单次完整播报；不用 title 避免 name+description 双播报）。
const serviceIcon: Record<string, string> = {
  market: "market-radar",
  opportunity: "opportunity-map",
  wealth: "wealth-chest",
  "fund-lab": "fund-basket",
  "auto-invest": "auto-invest-bot",
  life: "life-ledger",
  "goal-accounts": "goal-piggy",
  protection: "protection-umbrella",
  credit: "credit-lab-scale",
  risk: "risk-gauge",
  quests: "quest-checklist",
  history: "history-scroll",
};

const serviceTagline: Record<string, string> = {
  market: "行情 · 板块 · 观察池",
  opportunity: "先练观察，再谈买卖",
  wealth: "资产一张图",
  "fund-lab": "组合与长期配置",
  "auto-invest": "定投与节奏",
  life: "预算 · 应急金 · 保险",
  "goal-accounts": "目标储蓄与延迟满足",
  protection: "突发事件压力测试",
  credit: "利息与还款能力",
  risk: "认识自己的风险边界",
  quests: "任务 · 收藏 · 复盘",
  history: "把操作串成复盘故事",
};

const domainIcons = {
  home: Grid3X3,
  market: LineChart,
  opportunity: MapIcon,
  wealth: BadgeCheck,
};

const statusTone: Record<StudentServiceEntry["status"], string> = {
  ready: "bg-slate-100 text-slate-800",
  new: "bg-orange-100 text-orange-700",
  premium: "bg-slate-950 text-white",
};

const mapGroupIcons: Record<StudentServiceGroupKey, typeof Compass> = {
  strategy: Compass,
  assets: WalletCards,
  life: ShieldCheck,
  learning: Brain,
};

export function StudentHomeHub({ payload }: { payload: StudentHomeHubPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [season, setSeason] = useState<StudentSeasonChallengePayload>(payload.season);
  const [claimingSeason, setClaimingSeason] = useState(false);
  const [seasonClaim, setSeasonClaim] = useState<SeasonClaimResult | null>(null);
  const [seasonError, setSeasonError] = useState("");

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-hub-item], [data-finance-map]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-hub-item]", {
        y: 12,
        opacity: 0.96,
        duration: 0.42,
        ease: "power3.out",
        stagger: 0.055,
        clearProps: "transform,opacity",
      });
      gsap.from("[data-finance-map]", {
        y: 16,
        opacity: 0.94,
        duration: 0.46,
        ease: "power3.out",
        stagger: 0.07,
        delay: 0.12,
        clearProps: "transform,opacity",
      });
    },
    { scope: rootRef },
  );

  const servicesById = new Map(payload.services.map((service) => [service.id, service]));

  async function claimSeasonReward() {
    setClaimingSeason(true);
    setSeasonError("");
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
        throw new Error(data.message ?? "赛季奖励领取失败，请稍后再试。");
      }
      setSeason(data.payload);
      setSeasonClaim(data.claimed);
    } catch (error) {
      setSeasonError(error instanceof Error ? error.message : "赛季奖励领取失败，请稍后再试。");
    } finally {
      setClaimingSeason(false);
    }
  }

  return (
    <section ref={rootRef} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.22fr)_minmax(360px,0.78fr)]">
        {/* Dark hero panel — Finance OS overview */}
        <div
          data-hub-item
          className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-6 lg:p-7"
        >
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                {/* Eyebrow on dark panel → bz-eyebrow-inverse */}
                <p className="bz-eyebrow-inverse">Student Finance OS</p>
                <h2 className="mt-3 max-w-2xl text-h1 tracking-tight text-white sm:text-display-lg">
                  今日理财学习服务台
                </h2>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-body-sm font-semibold text-white">
                <Sparkles className="h-4 w-4 text-orange-300" />
                玩中学 / 学中玩
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {payload.domains.map((domain) => {
                const Icon = domainIcons[domain.key];
                return (
                  <Link
                    key={domain.key}
                    href={domain.href}
                    className="group min-h-[188px] min-w-0 rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-1 hover:bg-white/[0.1]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-2xl bg-white/10 p-3 text-orange-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/70 transition group-hover:translate-x-1 group-hover:text-orange-200" />
                    </div>
                    <p className="mt-4 text-h3 text-white">{domain.label}</p>
                    <p className="mt-2 line-clamp-1 text-body-sm leading-6 text-white/82">{domain.summary}</p>
                    <div className="mt-4 min-w-0 rounded-2xl bg-slate-900/80 px-3 py-2">
                      <p className="text-caption text-white/78">{domain.metricLabel}</p>
                      <p className="mt-1 whitespace-nowrap text-body-sm font-extrabold leading-tight tracking-tight tabular-nums text-orange-200 2xl:text-h3">
                        {domain.metricValue}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Season challenge panel */}
        <div data-hub-item data-testid="student-season-challenge" className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {/* Eyebrow on light panel → bz-eyebrow */}
              <p className="bz-eyebrow">Season</p>
              <h3 className="mt-3 text-h2 leading-tight text-fg-strong">{season.title}</h3>
            </div>
            <Trophy className="h-6 w-6 shrink-0 text-brand" />
          </div>
          {/* v2 信息收敛：赛季说明默认折叠，面板首屏只留标题+进度（文案来自 lib payload，不动数据） */}
          <Disclosure
            summary="赛季玩法说明"
            className="mt-2"
            summaryClassName="text-caption font-semibold text-fg-muted"
          >
            {season.summary}
          </Disclosure>
          <div className="mt-3">
            <div className="flex items-center justify-between text-body-sm text-fg-muted">
              <span>赛季进度</span>
              <span className="tabular-nums">{season.completedObjectives}/{season.totalObjectives} · {season.progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                data-motion-bar
                className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-emerald-300"
                style={{ width: `${season.progress}%` }}
              />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {/* v2 信息收敛：objective 只留 label+进度数字，detail 折进 Disclosure（放在 Link 外，避免 a 内嵌 button） */}
            {season.objectives.map((objective) => (
              <div
                key={objective.id}
                className="rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-orange-200 hover:bg-orange-50/70"
              >
                <Link
                  href={objective.href}
                  className="group flex items-center gap-3 py-1 transition hover:-translate-y-0.5"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                      objective.done ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-600",
                    )}
                  >
                    {objective.done ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                    <span className="text-body-sm font-semibold text-fg-strong">{objective.label}</span>
                    <span className="text-caption tabular-nums text-fg-muted">
                      {Math.min(objective.target, Math.round(objective.progress * objective.target))}/{objective.target}
                    </span>
                  </span>
                </Link>
                {/* 审查 #5：循环内固定 summary，用目标名区分可访问名（WCAG 2.4.6） */}
                <Disclosure
                  summary="怎么完成"
                  srContext={objective.label}
                  className="pl-10"
                  summaryClassName="py-1 text-caption font-medium text-fg-muted"
                  panelClassName="pb-1 pt-0 text-caption leading-5"
                >
                  {objective.detail}
                </Disclosure>
              </div>
            ))}
          </div>
          {/* Primary CTA — dark text on amber per AA rule */}
          <button
            type="button"
            data-testid="season-claim"
            data-motion-button
            data-motion-reward={season.claimable && !season.claimed ? "true" : undefined}
            aria-label={season.claimed ? "赛季奖励已领取" : season.claimable ? "领取赛季奖励" : "赛季奖励尚未解锁"}
            onClick={() => void claimSeasonReward()}
            disabled={!season.claimable || season.claimed || claimingSeason}
            className={cn(
              "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-body-sm font-semibold transition",
              season.claimable
                ? "bg-brand text-fg-default shadow-[0_18px_44px_rgba(240,138,56,0.24)] hover:-translate-y-0.5 hover:bg-brand-hover"
                : season.claimed
                  ? "bg-slate-950 text-white"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-fg-muted",
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
          {seasonClaim ? (
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-body-sm leading-6 text-emerald-700">
              {seasonClaim.summary}
            </p>
          ) : null}
          {seasonError ? (
            <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-body-sm leading-6 text-rose-700">
              {seasonError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div data-hub-item>
          <MarketThermometer payload={payload.marketTemperature} className="h-full" />
        </div>

        {/* 今日必看 panel */}
        <div data-hub-item className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">今日必看</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.today.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                aria-label={`${item.title}：${item.summary}`}
                data-daily-card
                data-testid={`daily-action-${item.id}`}
                className={cn(
                  "group block rounded-[1.4rem] border p-4 transition hover:-translate-y-0.5 sm:p-5",
                  item.done
                    ? "border-emerald-200 bg-emerald-50/75 hover:border-emerald-300 hover:bg-emerald-50"
                    : "border-slate-200 bg-slate-50 hover:border-orange-200 hover:bg-orange-50/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-caption font-semibold text-brand-ink">
                        {item.tag}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-caption text-fg-muted">
                        概念：{item.concept}
                      </span>
                      {item.done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-caption font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          已完成
                        </span>
                      ) : null}
                    </div>
                    {/* v2 信息收敛：summary 与 title 语义重复，卡面删除；完整 summary 保留在上方 aria-label 供读屏 */}
                    <p className="mt-3 text-h3 text-fg-strong">{item.title}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2">
                      <span className={cn("text-caption font-semibold", item.done ? "text-emerald-700" : "text-fg-muted")}>
                        {item.progressLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-caption font-semibold text-brand-ink">
                        {item.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-brand" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Finance Map section */}
      <div
        data-hub-item
        data-testid="student-finance-map"
        className="panel overflow-hidden rounded-[2rem] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5">
              <Layers3 className="h-4 w-4 text-brand-ink" />
              {/* Inline eyebrow variant — stays consistent with bz-eyebrow style */}
              <span className="bz-eyebrow bz-brand-text-on-light">Finance Map</span>
            </div>
            <h3 className="mt-3 text-h1 tracking-tight text-fg-strong sm:text-display-lg">
              多元理财学习版图
            </h3>
            {/* v2 信息收敛：组导语从 ~55 字压成一句 */}
            <p className="mt-2 max-w-3xl text-body leading-7 text-fg-muted">
              四条训练线，每条只给一个下一步动作。
            </p>
          </div>
          {/* Secondary CTA — outline style */}
          <Link
            href="/student/quests"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-body-sm font-semibold text-fg-strong shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-brand-ink"
          >
            查看学习任务
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-4">
          {payload.serviceMap.map((group) => {
            const Icon = mapGroupIcons[group.key];
            const progress = Math.round((group.completedCount / Math.max(group.totalCount, 1)) * 100);
            const groupServices = group.serviceIds
              .map((serviceId) => servicesById.get(serviceId))
              .filter((service): service is StudentServiceEntry => Boolean(service));

            return (
              <article
                key={group.key}
                data-finance-map
                data-motion-card
                className="group relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_22px_54px_rgba(15,23,42,0.12)] sm:p-6"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-200/30 blur-3xl transition group-hover:bg-orange-300/35" />
                <div className="relative grid gap-5 lg:grid-cols-[minmax(240px,0.78fr)_minmax(0,1.22fr)] lg:items-start">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-orange-200 shadow-[0_14px_34px_rgba(15,23,42,0.22)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-caption tabular-nums text-fg-muted">
                        {group.completedCount}/{group.totalCount}
                      </span>
                    </div>
                    <h4 className="mt-4 text-h2 tracking-tight text-fg-strong">{group.label}</h4>
                    <p className="mt-2 text-body-sm font-semibold leading-6 text-brand-ink">{group.concept}</p>
                    {/* v2 信息收敛：组 summary 默认折叠，concept 一句话承担卡面定位（summary 来自 lib payload，不动数据） */}
                    {/* 审查 #5：循环内固定 summary，用分组名区分可访问名（WCAG 2.4.6） */}
                    <Disclosure
                      summary="这条线练什么"
                      srContext={group.label}
                      className="mt-1"
                      summaryClassName="text-caption font-semibold text-fg-muted"
                      panelClassName="text-body-sm leading-7"
                    >
                      {group.summary}
                    </Disclosure>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3 text-caption text-fg-muted">
                        <span>{group.completionLabel}</span>
                        <span className="tabular-nums">{progress}%</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                        <div
                          data-motion-bar
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-300 to-emerald-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Primary group CTA — dark bg with light text (already passes AA) */}
                    <Link
                      href={group.href}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 px-5 text-body-sm font-semibold leading-none !text-white shadow-[0_16px_36px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:border-orange-600 hover:bg-orange-600 hover:!text-white sm:w-auto sm:min-w-48"
                    >
                      <span className="!text-white">{group.primaryActionLabel}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  </div>

                  <div className="hidden min-w-0 auto-rows-min gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
                    {/* v2 信息收敛：子卡只留标题+状态徽标；learn 收进 aria-label（读屏完整播报，同九宫格模式）
                        审查项 10：移动端整组隐藏——12 入口由下方九宫格独家承担，避免双份入口列表 */}
                    {groupServices.slice(0, 4).map((service) => (
                      <Link
                        key={service.id}
                        href={service.href}
                        aria-label={`${service.title}${
                          service.status === "new" ? "（新增）" : service.status === "premium" ? "（订阅）" : ""
                        }：你会学到——${service.learn}`}
                        className="self-start rounded-[1.2rem] border border-slate-200 bg-white/[0.92] p-4 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/65"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 text-body font-semibold leading-6 text-fg-strong">{service.title}</span>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption", statusTone[service.status])}>
                            {service.status === "new" ? "新" : service.status === "premium" ? "订阅" : "开"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* 服务九宫格 */}
      <div data-hub-item className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-brand" />
            <h3 className="text-h2 text-fg-strong">服务九宫格</h3>
          </div>
          <p className="text-body-sm text-fg-muted">12 个训练入口，点击即进。</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {payload.services.map((service) => (
            <Link
              key={service.id}
              href={service.href}
              data-motion-card
              aria-label={`${service.title}（${studentServiceGroups[service.group]}${
                service.status === "new" ? "·新增" : service.status === "premium" ? "·订阅" : ""
              }）：${service.summary} 你会学到：${service.learn}`}
              className="bz-press group flex min-h-[4.5rem] items-center gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Image
                src={`/brand/service-icons/${serviceIcon[service.id] ?? "market-radar"}.webp`}
                alt=""
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-[1.05rem] object-cover shadow-sm transition group-hover:scale-105"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="line-clamp-2 text-body font-semibold leading-tight text-fg-strong">{service.title}</p>
                  {service.status !== "ready" ? (
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-caption", statusTone[service.status])}>
                      {service.status === "new" ? "新增" : "订阅"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-caption text-fg-muted">
                  {serviceTagline[service.id] ?? studentServiceGroups[service.group]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
