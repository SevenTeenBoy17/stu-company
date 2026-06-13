"use client";

import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Landmark,
  PiggyBank,
  Radar,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WalletCards,
} from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { WealthSummary } from "@/lib/allocation";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

function buildDonut(summary: WealthSummary) {
  let offset = 0;
  return summary.allocation
    .map((slice) => {
      const next = offset + slice.weight;
      const part = `${slice.color} ${offset}% ${next}%`;
      offset = next;
      return part;
    })
    .join(", ");
}

function sparklinePath(points: WealthSummary["trend"], width = 520, height = 150) {
  const values = points.length > 0 ? points.map((point) => point.netWorth) : [0];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const usableWidth = width - 32;
  const usableHeight = height - 34;

  return values
    .map((value, index) => {
      const x = 16 + (values.length === 1 ? usableWidth : (index / (values.length - 1)) * usableWidth);
      const y = 16 + usableHeight - ((value - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function MissionBadge({ status }: { status: WealthSummary["missions"][number]["status"] }) {
  const label = status === "done" ? "已达成" : status === "watch" ? "需观察" : "进行中";
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-bold",
        status === "done" && "bg-down-soft text-down",
        status === "watch" && "bg-warning/10 text-warning",
        status === "doing" && "bg-brand-soft text-brand-ink",
      )}
    >
      {label}
    </span>
  );
}

export function StudentWealthDashboard({ summary }: { summary: WealthSummary }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hideMoney, setHideMoney] = useState(false);
  const netWorthTone = summary.roundReturn >= 0 ? "text-up" : "text-down";
  const sparkline = useMemo(() => sparklinePath(summary.trend), [summary.trend]);

  useGSAP(
    () => {
      gsap.from("[data-wealth-reveal]", {
        y: 18,
        opacity: 0,
        duration: 0.62,
        ease: "power3.out",
        stagger: 0.06,
      });
      gsap.from("[data-donut-core]", {
        scale: 0.86,
        opacity: 0,
        duration: 0.72,
        ease: "back.out(1.5)",
      });
    },
    { scope: rootRef },
  );

  const masked = hideMoney ? "¥••••••" : formatCurrency(summary.netWorth);

  return (
    <div ref={rootRef} className="space-y-6">
      <section
        data-wealth-reveal
        className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <div className="relative min-w-0 px-6 py-7 md:px-8 md:py-8">
            <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-warm">
                    My Wealth Map
                  </p>
                  <h1 className="mt-3 text-display-lg font-semibold md:text-display-xl">
                    我的财富总览
                  </h1>
                  <p className="mt-3 max-w-2xl text-body-lg leading-8 text-white/68">
                    把股票、ETF、债券、储蓄、房产、创业和负债放在一张地图里，看清每个决定如何影响净值。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHideMoney((current) => !current)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 text-sm font-bold text-white transition hover:bg-white/14"
                >
                  {hideMoney ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {hideMoney ? "显示金额" : "隐藏金额"}
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 md:col-span-2">
                  <p className="text-sm font-semibold text-white/56">当前净值</p>
                  <p className={cn("mt-3 text-display-lg font-black tabular-nums", netWorthTone)}>
                    {masked}
                  </p>
                  <p className="mt-3 text-sm text-white/58">
                    本回合收益{" "}
                    <MoneyText tone="dark">{formatCurrency(summary.roundReturn)}</MoneyText>
                    <span className="ml-2">{formatPercent(summary.roundReturnRate)}</span>
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5">
                  <p className="text-sm font-semibold text-white/56">分散度评分</p>
                  <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                    {summary.diversificationScore}
                  </p>
                  <p className="mt-3 text-sm text-white/58">{summary.stageLabel}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5">
                  <p className="text-sm font-semibold text-white/56">风险 / 纪律</p>
                  <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                    {summary.riskScore}
                    <span className="mx-2 text-h2 text-white/28">/</span>
                    {summary.disciplineScore}
                  </p>
                  <p className="mt-3 text-sm text-white/58">风险不是敌人，失控才是。</p>
                </div>
              </div>

              <div className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">净值趋势</p>
                    <p className="mt-1 text-sm text-white/52">用回合趋势看节奏，而不是被单次涨跌牵着走。</p>
                  </div>
                  <Route className="h-5 w-5 text-brand-warm" />
                </div>
                <svg className="mt-5 h-40 w-full overflow-visible" viewBox="0 0 520 150" role="img">
                  <defs>
                    <linearGradient id="wealthTrendFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber-400)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--amber-400)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkline} L 504 140 L 16 140 Z`} fill="url(#wealthTrendFill)" />
                  <path
                    d={sparkline}
                    fill="none"
                    stroke="var(--amber-300)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="5"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="relative border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 lg:border-l lg:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">
                  Allocation Ring
                </p>
                <h2 className="mt-3 text-h1 font-semibold text-white">资产配置环</h2>
              </div>
              <Radar className="h-6 w-6 text-white/60" />
            </div>
            <div className="mt-8 flex justify-center">
              <div
                data-donut-core
                className="relative h-64 w-64 rounded-full shadow-glow"
                style={{ background: `conic-gradient(${buildDonut(summary)})` }}
              >
                <div className="absolute inset-[24px] flex flex-col items-center justify-center rounded-full bg-bg-inverse">
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/46">总资产</span>
                  <span className="mt-2 text-2xl font-black">
                    <MoneyText tone="dark">{hideMoney ? "¥••••••" : formatCurrency(summary.grossAssets)}</MoneyText>
                  </span>
                  <span className="mt-1 text-xs text-white/46">未扣除负债</span>
                </div>
              </div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
              {summary.allocation.map((slice) => (
                <div key={slice.id} className="rounded-2xl bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ background: slice.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{slice.label}</p>
                        <p className="mt-1 truncate text-xs text-white/42">{slice.hint}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-black text-white">{slice.weight.toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-wealth-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Life Finance Map</p>
              <h2 className="mt-3 text-h1 font-semibold text-slate-950">多元理财地图</h2>
              <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                这不是简单看涨跌，而是训练“安全垫、成长资产、实物资产、负债刹车”之间的平衡。
              </p>
            </div>
            <Sparkles className="h-6 w-6 text-brand" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {summary.zones.map((zone) => (
              <article key={zone.id} className="rounded-[1.6rem] bg-slate-950/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-h3 font-bold text-slate-950">{zone.title}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-brand-ink">
                    {zone.weight.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-4 text-2xl font-black">
                  <MoneyText>{formatCurrency(zone.value)}</MoneyText>
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600">{zone.summary}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.8rem] border border-border bg-white p-5">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h3 className="text-h3 font-bold text-slate-950">当前配置 vs 建议区间</h3>
            </div>
            <div className="mt-5 space-y-4">
              {summary.targetAllocation.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-bold text-slate-800">{item.label}</span>
                    <span className="font-semibold text-slate-500">
                      当前 {item.current.toFixed(1)}% / 目标 {item.target.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 h-3 rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-up"
                      style={{ width: `${Math.min(100, item.current)}%` }}
                    />
                  </div>
                  <p className={cn("mt-1 text-xs font-bold", item.gap >= 0 ? "text-up" : "text-warning")}>
                    {item.gap >= 0 ? "高于建议" : "低于建议"} {Math.abs(item.gap).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside data-wealth-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-h2 font-semibold text-slate-950">Mr.Brown 建议</h2>
            </div>
            <h3 className="mt-5 text-h3 font-bold text-slate-950">{summary.coaching.title}</h3>
            <p className="mt-3 text-body leading-7 text-slate-600">{summary.coaching.summary}</p>
            <div className="mt-5 space-y-3">
              {summary.coaching.nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl bg-brand-subtle p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm font-semibold leading-6 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-brand" />
              <h2 className="text-h2 font-semibold text-slate-950">本周理财任务</h2>
            </div>
            <div className="mt-5 space-y-4">
              {summary.missions.map((mission) => (
                <article key={mission.id} className="rounded-[1.4rem] bg-slate-950/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-black text-slate-950">{mission.title}</h3>
                    <MissionBadge status={mission.status} />
                  </div>
                  <div className="mt-4 h-2.5 rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand to-down"
                      style={{ width: `${mission.progress * 100}%` }}
                    />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-500">{mission.reward}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section data-wealth-reveal className="panel rounded-[2rem] p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <WalletCards className="h-7 w-7 text-brand" />
            <div>
              <p className="text-sm font-bold text-slate-500">可用现金</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{formatCurrency(summary.cash)}</MoneyText>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <PiggyBank className="h-7 w-7 text-info" />
            <div>
              <p className="text-sm font-bold text-slate-500">稳健储蓄</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{formatCurrency(summary.savings)}</MoneyText>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <Landmark className="h-7 w-7 text-warning" />
            <div>
              <p className="text-sm font-bold text-slate-500">当前负债</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{formatCurrency(-summary.debt)}</MoneyText>
              </p>
            </div>
          </div>
          <a
            href="/student"
            className="group flex items-center justify-between gap-4 rounded-[1.5rem] bg-bg-inverse p-5 text-white transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            <div>
              <p className="text-sm font-bold text-white/52">下一步</p>
              <p className="mt-1 text-xl font-black">回到策略台执行</p>
            </div>
            <ArrowRight className="h-6 w-6 text-brand-warm transition group-hover:translate-x-1" />
          </a>
        </div>
      </section>
    </div>
  );
}
