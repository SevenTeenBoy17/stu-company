"use client";

import { useRef, useState } from "react";
import Link from "next/link";
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
import { MarketThermometer } from "@/components/student/market-thermometer";

gsap.registerPlugin(useGSAP);

const domainIcons = {
  home: Grid3X3,
  market: LineChart,
  opportunity: MapIcon,
  wealth: BadgeCheck,
};

const statusTone: Record<StudentServiceEntry["status"], string> = {
  ready: "bg-slate-100 text-slate-700",
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
        throw new Error(data.message ?? data.error ?? "赛季奖励领取失败，请稍后再试。");
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
        <div
          data-hub-item
          className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-6 lg:p-7"
        >
          <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">Student Finance OS</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">
                  今日理财学习服务台
                </h2>
                <p className="mt-3 max-w-3xl text-base font-semibold leading-8 text-white/72">
                  像真实理财 App 一样组织信息，但所有动作都服务于课堂模拟、概念理解和复盘训练。
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold text-white">
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
                    className="group min-h-[188px] rounded-[1.4rem] border border-white/10 bg-white/[0.06] p-4 transition hover:-translate-y-1 hover:bg-white/[0.1]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-2xl bg-white/10 p-3 text-orange-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-white/70 transition group-hover:translate-x-1 group-hover:text-orange-200" />
                    </div>
                    <p className="mt-4 text-xl font-black text-white">{domain.label}</p>
                    <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-white/64">{domain.summary}</p>
                    <div className="mt-4 rounded-2xl bg-slate-900/80 px-3 py-2">
                      <p className="text-xs font-bold text-white/70">{domain.metricLabel}</p>
                      <p className="mt-1 text-lg font-black text-orange-200">{domain.metricValue}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div data-hub-item data-testid="student-season-challenge" className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-orange-500">Season</p>
              <h3 className="mt-3 text-2xl font-black leading-tight text-slate-950">{season.title}</h3>
            </div>
            <Trophy className="h-6 w-6 shrink-0 text-orange-500" />
          </div>
          <p className="mt-3 text-base font-semibold leading-8 text-slate-600">{season.summary}</p>
          <div className="mt-5">
            <div className="flex items-center justify-between text-sm font-bold text-slate-600">
              <span>赛季进度</span>
              <span>{season.completedObjectives}/{season.totalObjectives} · {season.progress}%</span>
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
            {season.objectives.map((objective) => (
              <Link
                key={objective.id}
                href={objective.href}
                className="group flex items-start gap-3 rounded-[1.15rem] border border-slate-200 bg-slate-50 px-3 py-3 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/70"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    objective.done ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-600",
                  )}
                >
                  {objective.done ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-slate-950">{objective.label}</span>
                    <span className="text-xs font-black text-slate-600">
                      {Math.min(objective.target, Math.round(objective.progress * objective.target))}/{objective.target}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-600">
                    {objective.detail}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            data-testid="season-claim"
            data-motion-button
            data-motion-reward={season.claimable && !season.claimed ? "true" : undefined}
            onClick={() => void claimSeasonReward()}
            disabled={!season.claimable || season.claimed || claimingSeason}
            className={cn(
              "mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-black transition",
              season.claimable
                ? "bg-orange-500 text-white shadow-[0_18px_44px_rgba(240,138,56,0.24)] hover:-translate-y-0.5 hover:bg-orange-600"
                : season.claimed
                  ? "bg-slate-950 text-white"
                  : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-600",
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
            <p className="mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-700">
              {seasonClaim.summary}
            </p>
          ) : null}
          {seasonError ? (
            <p className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">
              {seasonError}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div data-hub-item>
          <MarketThermometer payload={payload.marketTemperature} className="h-full" />
        </div>

        <div data-hub-item className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">今日必看</h3>
          </div>
          <div className="mt-5 space-y-3">
            {payload.today.map((item) => (
              <Link
                key={item.id}
                href={item.href}
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
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-orange-700">
                        {item.tag}
                      </span>
                      <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-slate-600">
                        概念：{item.concept}
                      </span>
                      {item.done ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          已完成
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-lg font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.summary}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white px-3 py-2">
                      <span className={cn("text-xs font-black", item.done ? "text-emerald-700" : "text-slate-600")}>
                        {item.progressLabel}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-black text-orange-700">
                        {item.actionLabel}
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div
        data-hub-item
        data-testid="student-finance-map"
        className="panel overflow-hidden rounded-[2rem] p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-orange-700">
              <Layers3 className="h-4 w-4" />
              Finance Map
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              多元理财学习版图
            </h3>
            <p className="mt-2 max-w-3xl text-base font-semibold leading-7 text-slate-600">
              参考真实生活里的理财入口，把“市场、持有、生活目标、复盘任务”拆成四条训练线。每条线只给一个下一步动作，降低认知负荷，也方便课堂检查。
            </p>
          </div>
          <Link
            href="/student/quests"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
          >
            查看学习任务
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
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
                className="group relative overflow-hidden rounded-[1.7rem] border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-4 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_22px_54px_rgba(15,23,42,0.12)] sm:p-5"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-200/30 blur-3xl transition group-hover:bg-orange-300/35" />
                <div className="relative grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-orange-200 shadow-[0_14px_34px_rgba(15,23,42,0.22)]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                        {group.completedCount}/{group.totalCount}
                      </span>
                    </div>
                    <h4 className="mt-4 text-2xl font-black tracking-tight text-slate-950">{group.label}</h4>
                    <p className="mt-2 text-sm font-bold leading-6 text-orange-700">{group.concept}</p>
                    <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{group.summary}</p>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-600">
                        <span>{group.completionLabel}</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
                        <div
                          data-motion-bar
                          className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-300 to-emerald-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    <Link
                      href={group.href}
                      className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-950 bg-slate-950 px-4 text-sm font-black text-white shadow-[0_16px_36px_rgba(15,23,42,0.20)] transition hover:-translate-y-0.5 hover:border-orange-600 hover:bg-orange-600"
                    >
                      {group.primaryActionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    {groupServices.slice(0, 4).map((service) => (
                      <Link
                        key={service.id}
                        href={service.href}
                        className="rounded-[1.2rem] border border-slate-200 bg-white/90 p-3 transition hover:-translate-y-0.5 hover:border-orange-200 hover:bg-orange-50/65"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-black text-slate-950">{service.title}</span>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.68rem] font-black", statusTone[service.status])}>
                            {service.status === "new" ? "新" : service.status === "premium" ? "订阅" : "开"}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-600">
                          {service.learn}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div data-hub-item className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">服务九宫格</h3>
          </div>
          <p className="text-sm font-bold text-slate-600">把真实生活里的投资、预算、风险和复盘拆成可玩的训练入口。</p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {payload.services.map((service) => (
            <Link
              key={service.id}
              href={service.href}
              data-motion-card
              className="group min-h-[158px] rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">{service.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-600">{studentServiceGroups[service.group]}</p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-1 text-[0.68rem] font-black", statusTone[service.status])}>
                  {service.status === "new" ? "新增" : service.status === "premium" ? "订阅" : "可用"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-slate-600">{service.summary}</p>
              <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600">
                你会学到：{service.learn}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
