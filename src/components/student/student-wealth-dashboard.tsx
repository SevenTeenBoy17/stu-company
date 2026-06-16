"use client";

import { type FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
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
import type { WealthReviewAction, WealthReviewFocus, WealthReviewPayload } from "@/lib/wealth-review";

gsap.registerPlugin(useGSAP);

function buildDonut(summary: WealthSummary) {
  if (summary.allocation.length === 0) return "var(--ink-100) 0% 100%";
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
        status === "done" && "bg-emerald-50 text-emerald-700",
        status === "watch" && "bg-warning/10 text-warning",
        status === "doing" && "bg-brand-soft text-brand-ink",
      )}
    >
      {label}
    </span>
  );
}

function GatewayCard({
  href,
  title,
  summary,
  label,
}: {
  href: string;
  title: string;
  summary: string;
  label: string;
}) {
  return (
    <Link
      data-motion-card
      href={href}
      className="group rounded-[1.45rem] border border-slate-200 bg-white p-4 transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_18px_44px_rgba(15,23,42,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="rounded-full bg-brand-subtle px-2.5 py-1 text-xs font-black text-brand-ink">
            {label}
          </span>
          <h3 className="mt-3 text-lg font-black text-slate-950">{title}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{summary}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-orange-500" />
      </div>
    </Link>
  );
}

export function StudentWealthDashboard({
  summary: initialSummary,
  review: initialReview,
}: {
  summary: WealthSummary;
  review: WealthReviewPayload;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [review, setReview] = useState(initialReview);
  const [hideMoney, setHideMoney] = useState(false);
  const [form, setForm] = useState<{
    focus: WealthReviewFocus;
    action: WealthReviewAction;
    confidence: number;
    note: string;
  }>({
    focus: initialReview.recommendedFocus,
    action: "hold-and-watch",
    confidence: 68,
    note: "",
  });
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({
    type: "idle",
    message: "",
  });
  const sparkline = useMemo(() => sparklinePath(summary.trend), [summary.trend]);
  const netWorthText = hideMoney ? "¥••••••" : formatCurrency(summary.netWorth);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-wealth-reveal], [data-donut-core]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-wealth-reveal]", {
        y: 18,
        opacity: 0,
        duration: 0.62,
        ease: "power3.out",
        stagger: 0.055,
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

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.note.trim().length < 8) {
      setStatus({ type: "error", message: "请先写下至少 8 个字的复盘理由，再记录持有计划。" });
      return;
    }
    setStatus({ type: "loading", message: "正在记录持有计划..." });

    try {
      const response = await fetch("/api/student/wealth-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => ({}))) as {
        summary?: WealthSummary;
        review?: WealthReviewPayload;
        message?: string;
      };

      if (!response.ok || !data.summary || !data.review) {
        throw new Error(data.message ?? "财富复盘提交失败，请稍后再试。");
      }

      setSummary(data.summary);
      setReview(data.review);
      setForm((current) => ({ ...current, note: "" }));
      setStatus({ type: "success", message: data.message ?? "财富复盘已记录。" });
    } catch (error) {
      setStatus({
        type: "error",
        message: error instanceof Error ? error.message : "财富复盘提交失败，请稍后再试。",
      });
    }
  }

  return (
    <div ref={rootRef} data-testid="wealth-dashboard" className="space-y-6">
      <section
        data-wealth-reveal
        data-motion-reveal
        className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft"
      >
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)]">
          <div className="relative min-w-0 px-6 py-7 md:px-8 md:py-8">
            <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
            <div className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.22em] text-brand-warm">My Wealth Map</p>
                  <h2 className="mt-3 text-display-lg font-semibold md:text-display-xl">我的财富持有总入口</h2>
                  <p className="mt-3 max-w-2xl text-body-lg leading-8 text-white/68">
                    把现金、储蓄、股票、ETF、债券、房产、创业和负债放到一张地图里，先看全局，再决定下一步模拟动作。
                  </p>
                </div>
                <button
                  data-motion-button
                  type="button"
                  onClick={() => setHideMoney((current) => !current)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 text-sm font-bold text-white transition hover:bg-white/14"
                >
                  {hideMoney ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {hideMoney ? "显示金额" : "隐藏金额"}
                </button>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-4">
                <div data-motion-card className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5 md:col-span-2">
                  <p className="text-sm font-semibold text-white/56">当前净值</p>
                  <p className="mt-3 text-display-lg font-black tabular-nums">
                    <MoneyText tone="dark">{netWorthText}</MoneyText>
                  </p>
                  <p className="mt-3 text-sm text-white/58">
                    本回合变化{" "}
                    <MoneyText tone="dark">{formatCurrency(summary.roundReturn)}</MoneyText>
                    <span className="ml-2">{formatPercent(summary.roundReturnRate)}</span>
                  </p>
                </div>
                <div data-motion-card className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5">
                  <p className="text-sm font-semibold text-white/56">分散度评分</p>
                  <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                    {summary.diversificationScore}
                  </p>
                  <p className="mt-3 text-sm text-white/58">{summary.stageLabel}</p>
                </div>
                <div data-motion-card className="rounded-[1.5rem] border border-white/10 bg-white/[0.07] p-5">
                  <p className="text-sm font-semibold text-white/56">风险 / 纪律</p>
                  <p className="mt-3 text-display-lg font-black tabular-nums text-white">
                    {summary.riskScore}
                    <span className="mx-2 text-h2 text-white/70">/</span>
                    {summary.disciplineScore}
                  </p>
                  <p className="mt-3 text-sm text-white/58">风险不是敌人，失控才是。</p>
                </div>
              </div>

              <div data-motion-viz className="mt-6 rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-white">净值趋势</p>
                    <p className="mt-1 text-sm text-white/70">用回合趋势看节奏，而不是被单次涨跌牵着走。</p>
                  </div>
                  <Route className="h-5 w-5 text-brand-warm" />
                </div>
                <svg className="mt-5 h-40 w-full overflow-visible" viewBox="0 0 520 150" role="img" aria-label="净值趋势图">
                  <defs>
                    <linearGradient id="wealthTrendFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber-400)" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="var(--amber-400)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${sparkline} L 504 140 L 16 140 Z`} fill="url(#wealthTrendFill)" />
                  <path
                    data-motion-viz-path
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

          <div className="relative border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">Allocation Ring</p>
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
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">总资产</span>
                  <span className="mt-2 text-2xl font-black">
                    <MoneyText tone="dark">{hideMoney ? "¥••••••" : formatCurrency(summary.grossAssets)}</MoneyText>
                  </span>
                  <span className="mt-1 text-xs text-white/70">未扣除负债</span>
                </div>
              </div>
            </div>
            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {summary.allocation.map((slice) => (
                <div key={slice.id} data-motion-card className="rounded-2xl bg-white/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 rounded-full" style={{ background: slice.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{slice.label}</p>
                        <p className="mt-1 truncate text-xs text-white/70">{slice.hint}</p>
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

      <section data-wealth-reveal data-motion-reveal data-testid="wealth-total-gateway" className="panel rounded-[2rem] p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Holding Gateway</p>
            <h2 className="mt-3 text-h1 font-semibold text-slate-950">持有总入口</h2>
            <p className="mt-2 max-w-3xl text-body leading-7 text-slate-600">
              参考理财 App 的“持有页”心智，但转译为课堂模拟：每个入口都服务于计划、复盘和风险理解，不引导真实买卖。
            </p>
          </div>
          <Sparkles className="h-6 w-6 text-brand" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <GatewayCard href="/student/history" label="复盘" title="查看历史操作" summary="把交易、观察单、基金实验和保护伞串成行为故事。" />
          <GatewayCard href="/student/fund-lab" label="组合" title="基金/ETF 实验" summary="比较分散配置、回撤和风险评分，训练长期持有意识。" />
          <GatewayCard href="/student/goal-accounts" label="生活" title="目标账户" summary="把电脑、研学、备用金和创业启动金拆成可执行目标。" />
          <GatewayCard href="/student/protection" label="防守" title="风险保护伞" summary="用应急金、保险、债务和分散度做突发事件压力测试。" />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <section data-wealth-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Life Finance Map</p>
              <h2 className="mt-3 text-h1 font-semibold text-slate-950">多元理财地图</h2>
              <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                真实理财不只看一只资产涨跌，而是在安全垫、成长资产、生活目标和负债之间保持可持续的节奏。
              </p>
            </div>
            <Target className="h-6 w-6 text-brand" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {summary.zones.map((zone) => (
              <article key={zone.id} data-motion-card className="rounded-[1.6rem] bg-slate-950/[0.035] p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-h3 font-bold text-slate-950">{zone.title}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-brand-ink">
                    {zone.weight.toFixed(1)}%
                  </span>
                </div>
                <p className="mt-4 text-2xl font-black">
                  <MoneyText>{hideMoney ? "¥••••••" : formatCurrency(zone.value)}</MoneyText>
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
            <div data-motion-viz className="mt-5 space-y-4">
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

        <aside data-wealth-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-h2 font-semibold text-slate-950">Mr.Brown 建议</h2>
            </div>
            <h3 className="mt-5 text-h3 font-bold text-slate-950">{summary.coaching.title}</h3>
            <p className="mt-3 text-body leading-7 text-slate-600">{summary.coaching.summary}</p>
            <div className="mt-5 space-y-3">
              {summary.coaching.nextSteps.map((step, index) => (
                <div key={step} data-motion-card className="flex gap-3 rounded-2xl bg-brand-subtle p-4">
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
                <article key={mission.id} data-motion-card className="rounded-[1.4rem] bg-slate-950/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-black text-slate-950">{mission.title}</h3>
                    <MissionBadge status={mission.status} />
                  </div>
                  <div className="mt-4 h-2.5 rounded-full bg-white">
                    <div
                      data-motion-viz-bar
                      data-motion-origin="left center"
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

      <section data-wealth-reveal data-motion-reveal className="panel overflow-hidden rounded-[2rem] p-0">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
          <form onSubmit={submitReview} className="min-w-0 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Holding Plan</p>
                <h2 className="mt-3 text-h1 font-semibold text-slate-950">本回合持有计划复盘</h2>
                <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                  先写计划，再执行动作。记录不会改变净值，但会进入历史复盘，帮助你看清自己为什么持有。
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-subtle px-4 py-2 text-sm font-black text-brand-ink">
                <ClipboardCheck className="h-4 w-4" />
                计划分 {review.planScore}
              </span>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <div className="rounded-[1.6rem] bg-slate-950/[0.035] p-4">
                <p className="text-sm font-black text-slate-950">1. 本回合最该关注什么？</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {review.focusOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, focus: option.id }))}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        form.focus === option.id
                          ? "border-brand bg-brand text-white shadow-[0_16px_34px_rgba(249,115,22,0.22)]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:bg-brand-subtle",
                      )}
                    >
                      <span className="block text-base font-black">{option.label}</span>
                      <span className={cn("mt-1 block text-xs leading-5", form.focus === option.id ? "text-white/72" : "text-slate-500")}>
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.6rem] bg-slate-950/[0.035] p-4">
                <p className="text-sm font-black text-slate-950">2. 下一步更像哪种动作？</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {review.actionOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, action: option.id }))}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        form.action === option.id
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-white",
                      )}
                    >
                      <span className="block text-base font-black">{option.label}</span>
                      <span className={cn("mt-1 block text-xs leading-5", form.action === option.id ? "text-white/65" : "text-slate-500")}>
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
              <label className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                <span className="text-sm font-black text-slate-950">信心刻度</span>
                <span className="mt-2 block text-3xl font-black text-brand">{form.confidence}</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={form.confidence}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, confidence: Number(event.target.value) }))
                  }
                  className="mt-4 w-full accent-orange-500"
                />
                <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                  高信心也要写下风险假设，避免把热度当确定性。
                </span>
              </label>

              <label className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                <span className="text-sm font-black text-slate-950">复盘理由</span>
                <textarea
                  value={form.note}
                  onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                  rows={4}
                  maxLength={240}
                  placeholder="例：当前成长资产比例偏高，我先不继续加仓，下一回合观察现金垫是否恢复到目标区间。"
                  className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      form.note.trim().length < 8 ? "text-rose-500" : "text-slate-400",
                    )}
                  >
                    {form.note.trim().length < 8
                      ? `还需 ${8 - form.note.trim().length} 个字（至少写 8 个字）`
                      : `${form.note.length}/240`}
                  </p>
                  <button
                    type="submit"
                    data-testid="wealth-review-submit"
                    disabled={status.type === "loading" || form.note.trim().length < 8}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-white shadow-[0_16px_36px_rgba(249,115,22,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {status.type === "loading" ? "正在记录" : "记录持有计划"}
                  </button>
                </div>
              </label>
            </div>

            {status.message ? (
              <p
                className={cn(
                  "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                  status.type === "error" && "bg-error/10 text-error",
                  status.type === "success" && "bg-emerald-50 text-emerald-700",
                  status.type === "loading" && "bg-slate-100 text-slate-500",
                )}
              >
                {status.message}
              </p>
            ) : null}
          </form>

          <aside className="min-w-0 border-t border-slate-200 bg-slate-50 p-5 md:p-6 xl:border-l xl:border-t-0">
            <div className="rounded-[1.6rem] bg-white p-5 shadow-sm">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mr.Brown Review</p>
              <h3 className="mt-3 text-h2 font-black text-slate-950">{review.coach.title}</h3>
              <p className="mt-3 text-body leading-7 text-slate-600">{review.coach.summary}</p>
              <div className="mt-5 grid gap-3">
                {review.coach.nextSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold leading-6 text-slate-600">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-[1.6rem] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-h3 font-black text-slate-950">最近复盘记录</h3>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
                  {review.reviewCount} 次
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {review.history.length > 0 ? (
                  review.history.slice(0, 3).map((item) => (
                    <article key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-base font-black text-slate-950">{item.focusLabel}</p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-brand-ink">
                          {item.actionLabel} · {item.score}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-slate-500">
                        {item.note}
                      </p>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
                    还没有持有计划记录。先写一条理由，下一次历史复盘就能看到它。
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section data-wealth-reveal className="panel rounded-[2rem] p-5 md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <WalletCards className="h-7 w-7 text-brand" />
            <div>
              <p className="text-sm font-bold text-slate-500">可用现金</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{hideMoney ? "¥••••••" : formatCurrency(summary.cash)}</MoneyText>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <PiggyBank className="h-7 w-7 text-info" />
            <div>
              <p className="text-sm font-bold text-slate-500">稳健储蓄</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{hideMoney ? "¥••••••" : formatCurrency(summary.savings)}</MoneyText>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-[1.5rem] bg-white p-5">
            <Landmark className="h-7 w-7 text-warning" />
            <div>
              <p className="text-sm font-bold text-slate-500">当前负债</p>
              <p className="mt-1 text-xl font-black">
                <MoneyText>{hideMoney ? "¥••••••" : formatCurrency(-summary.debt)}</MoneyText>
              </p>
            </div>
          </div>
          <Link
            href="/student"
            className="group flex items-center justify-between gap-4 rounded-[1.5rem] bg-bg-inverse p-5 text-white transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            <div>
              <p className="text-sm font-bold text-white/70">下一步</p>
              <p className="mt-1 text-xl font-black">回到策略台执行</p>
            </div>
            <ArrowRight className="h-6 w-6 text-brand-warm transition group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </div>
  );
}
