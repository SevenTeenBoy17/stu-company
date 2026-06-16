"use client";

import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Bot,
  CalendarClock,
  CheckCircle2,
  LineChart,
  Loader2,
  PauseCircle,
  PlayCircle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { AutoInvestPayload, AutoInvestStrategy } from "@/lib/auto-invest";
import { cn, formatCurrency, formatPercent, getMarketMoveClasses } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type LoadState = "idle" | "loading" | "success" | "error";
type SubmitIntent = "simulate" | "activate" | "cancel";

const strategies: Array<{ id: AutoInvestStrategy; label: string; summary: string }> = [
  { id: "steady", label: "固定节奏", summary: "每回合固定金额，适合训练长期纪律。" },
  { id: "buyDip", label: "回撤加码", summary: "下跌时略加仓，上涨过热时慢一点。" },
  { id: "momentum", label: "趋势跟随", summary: "趋势向上略加速，走弱时降低冲动。" },
];

const badgeTone: Record<AutoInvestPayload["badges"][number]["tone"], string> = {
  brand: "bg-brand-soft text-brand-ink",
  info: "bg-info/10 text-info",
  warning: "bg-warning/10 text-warning",
  danger: "bg-error-soft text-error",
};

const planStatusCopy = {
  active: "执行中",
  cancelled: "已取消",
  completed: "已完成",
};

function formatGeneratedAt(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function schedulePath(schedule: AutoInvestPayload["schedule"], width = 520, height = 150) {
  const values = schedule.length > 0 ? schedule.map((item) => item.price) : [0];
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

export function StudentAutoInvestDashboard({ initialPayload }: { initialPayload: AutoInvestPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [assetId, setAssetId] = useState(initialPayload.selected.assetId);
  const [amountPerRound, setAmountPerRound] = useState(initialPayload.selected.amountPerRound);
  const [durationRounds, setDurationRounds] = useState(initialPayload.selected.durationRounds);
  const [strategy, setStrategy] = useState<AutoInvestStrategy>(initialPayload.selected.strategy);
  const [state, setState] = useState<LoadState>("idle");
  const [busyIntent, setBusyIntent] = useState<SubmitIntent | null>(null);
  const [message, setMessage] = useState("");
  const trendPath = useMemo(() => schedulePath(payload.schedule), [payload.schedule]);
  const activePlan = payload.activePlan?.status === "active" ? payload.activePlan : null;

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-auto-reveal], [data-plan-dot]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-auto-reveal]", {
        y: 22,
        opacity: 0,
        duration: 0.58,
        ease: "power3.out",
        stagger: 0.055,
      });
      gsap.from("[data-plan-dot]", {
        scale: 0.35,
        opacity: 0,
        duration: 0.42,
        ease: "back.out(1.8)",
        stagger: 0.05,
      });
    },
    { scope: rootRef },
  );

  async function submit(intent: SubmitIntent) {
    setState("loading");
    setBusyIntent(intent);
    setMessage("");

    try {
      const response = await fetch("/api/student/auto-invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          assetId,
          amountPerRound,
          durationRounds,
          strategy,
        }),
      });
      const data = (await response.json()) as { payload?: AutoInvestPayload; message?: string };
      if (!response.ok || !data.payload) {
        throw new Error(data.message || "定投机器人暂时无法完成操作，请稍后再试。");
      }
      setPayload(data.payload);
      setAssetId(data.payload.selected.assetId);
      setAmountPerRound(data.payload.selected.amountPerRound);
      setDurationRounds(data.payload.selected.durationRounds);
      setStrategy(data.payload.selected.strategy);
      setState("success");
      setMessage(
        data.message ??
          (intent === "simulate"
            ? "机器人已按最新参数重新推演。"
            : intent === "activate"
              ? "定投计划已启动。"
              : "定投计划已取消。"),
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "定投机器人暂时无法完成操作，请稍后再试。");
    } finally {
      setBusyIntent(null);
    }
  }

  const selectedOption = payload.options.find((item) => item.assetId === payload.selected.assetId) ?? payload.options[0];
  const moveClasses = getMarketMoveClasses(selectedOption?.dayChange ?? 0);
  const latestPlan = payload.activePlan;

  return (
    <div ref={rootRef} className="space-y-6" data-testid="auto-invest-dashboard">
      <section data-auto-reveal data-motion-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">
                  Auto Invest Robot
                </p>
                <h1 className="mt-3 text-display-lg font-semibold md:text-display-xl">定投机器人训练营</h1>
                <p className="mt-4 text-body-lg leading-8 text-white/68">
                  让机器人按规则替你执行小额、分批、可复盘的投资计划。学生练的不是“猜最低点”，而是现金安全、平均成本和长期纪律。
                </p>
              </div>
              <div className="rounded-[1.7rem] border border-white/12 bg-white/[0.08] p-5">
                <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-brand-warm" />
                  <p className="text-sm font-bold text-white/58">训练状态</p>
                </div>
                <p className="mt-2 text-h1 font-black text-white">
                  {activePlan ? "真实计划执行中" : payload.summary.stageLabel}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/70">
                  更新于 {formatGeneratedAt(payload.generatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "每回合预算", value: formatCurrency(payload.selected.amountPerRound), icon: Target },
                { label: "计划期数", value: `${payload.summary.executedRounds}/${payload.selected.durationRounds} 回合`, icon: CalendarClock },
                { label: "平均成本", value: formatCurrency(payload.summary.averageCost), icon: LineChart },
                { label: "期末模拟值", value: formatCurrency(payload.summary.terminalValue), icon: TrendingUp },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} data-motion-card className="min-w-0 rounded-[1.45rem] border border-white/10 bg-white/[0.07] p-5">
                    <div className="flex items-center gap-2 text-white/58">
                      <Icon className="h-4 w-4 text-brand-warm" />
                      <p className="text-sm font-bold">{item.label}</p>
                    </div>
                    <p className="mt-3 text-[clamp(1.45rem,2.2vw,2.1rem)] font-black leading-none tabular-nums text-white">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 xl:border-l xl:border-t-0">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.07] p-5">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">当前标的</p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-h1 font-semibold text-white">{selectedOption?.name}</h2>
                  <p className="mt-1 text-sm font-bold text-white/70">{selectedOption?.symbol}</p>
                </div>
                <span className={cn("rounded-full px-3 py-1 text-sm font-black", moveClasses.darkBadge)}>
                  {formatPercent(selectedOption?.dayChange ?? 0)}
                </span>
              </div>
              <p className="mt-4 text-display-md font-black tabular-nums text-white">
                {formatCurrency(selectedOption?.currentPrice ?? 0)}
              </p>
              <p className="mt-3 text-body leading-7 text-white/58">{selectedOption?.description}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {payload.badges.map((badge) => (
                <div key={badge.label} className={cn("rounded-[1.25rem] p-4", badgeTone[badge.tone])}>
                  <p className="text-xs font-bold opacity-70">{badge.label}</p>
                  <p className="mt-2 text-h2 font-black">{badge.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      {latestPlan ? (
        <section data-auto-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-brand">Live Plan</p>
              <h2 className="mt-2 text-h1 font-semibold text-slate-950">
                当前定投计划：{planStatusCopy[latestPlan.status]}
              </h2>
              <p className="mt-2 text-body leading-7 text-slate-600">
                第 {latestPlan.startRound}-{latestPlan.endRound} 回合自动尝试买入，已执行{" "}
                {latestPlan.executedRounds.length} 回合，跳过 {latestPlan.skippedRounds.length} 回合。
              </p>
            </div>
            <button
              data-motion-button
              type="button"
              onClick={() => submit("cancel")}
              disabled={!activePlan || state === "loading"}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyIntent === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
              取消真实计划
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside data-auto-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-slate-950">机器人参数</h2>
          </div>
          <p className="mt-2 text-body leading-7 text-slate-600">
            参数越激进，现金越容易被占用。先看安全垫，再看收益率。
          </p>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-black text-slate-700">定投标的</span>
              <select
                value={assetId}
                onChange={(event) => setAssetId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-body font-bold text-slate-950 outline-none transition focus:border-brand"
              >
                {payload.options.map((option) => (
                  <option key={option.assetId} value={option.assetId}>
                    {option.name} · {option.symbol}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">每回合金额</span>
              <input
                value={amountPerRound}
                onChange={(event) => setAmountPerRound(Number(event.target.value))}
                type="number"
                min={500}
                step={500}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-body font-bold text-slate-950 outline-none transition focus:border-brand"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">持续回合</span>
              <input
                value={durationRounds}
                onChange={(event) => setDurationRounds(Number(event.target.value))}
                type="number"
                min={1}
                max={12}
                className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-body font-bold text-slate-950 outline-none transition focus:border-brand"
              />
            </label>
          </div>

          <div className="mt-6 space-y-3">
            {strategies.map((item) => {
              const active = strategy === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setStrategy(item.id)}
                  className={cn(
                    "w-full rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5",
                    active ? "border-brand bg-brand-soft" : "border-slate-200 bg-slate-50",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body font-black text-slate-950">{item.label}</p>
                    {active ? <CheckCircle2 className="h-5 w-5 text-brand" /> : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{item.summary}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-3">
            <button
              type="button"
              data-testid="auto-invest-submit"
              onClick={() => submit("simulate")}
              disabled={state === "loading"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-sm font-black text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyIntent === "simulate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              重新推演计划
            </button>
            <button
              type="button"
              onClick={() => submit("activate")}
              disabled={Boolean(activePlan) || state === "loading"}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-slate-950 shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyIntent === "activate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              启动真实定投
            </button>
          </div>
          {message ? (
            <p
              className={cn(
                "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                state === "error" ? "bg-error-soft text-error" : "bg-info/10 text-info",
              )}
            >
              {message}
            </p>
          ) : null}
        </aside>

        <div className="space-y-6">
        <section data-auto-reveal data-motion-reveal className="panel overflow-hidden rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <LineChart className="h-5 w-5 text-brand" />
                  <h2 className="text-h1 font-semibold text-slate-950">执行轨迹</h2>
                </div>
                <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                  机器人按回合拆单，重点不是每次都赚钱，而是看清价格、份额、平均成本、现金余量如何联动。
                </p>
              </div>
              <div className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                {payload.selected.startRound} - {payload.selected.endRound} 回合
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-[1.6rem] bg-slate-950 p-5 text-white">
                <svg className="h-44 w-full overflow-visible" viewBox="0 0 520 150" role="img" aria-label="定投标的价格趋势">
                  <defs>
                    <linearGradient id="autoInvestFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--amber-400)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--amber-400)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={`${trendPath} L 504 140 L 16 140 Z`} fill="url(#autoInvestFill)" />
                  <path
                    d={trendPath}
                    fill="none"
                    stroke="var(--amber-300)"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="5"
                  />
                  {payload.schedule.map((row, index) => {
                    const x = 16 + (payload.schedule.length === 1 ? 488 : (index / (payload.schedule.length - 1)) * 488);
                    return (
                      <circle
                        key={row.round}
                        data-plan-dot
                        cx={x}
                        cy={row.status === "executed" ? 128 : 138}
                        r={row.status === "executed" ? 7 : 4}
                        fill={row.status === "executed" ? "var(--amber-300)" : "var(--error-400)"}
                      />
                    );
                  })}
                </svg>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-bold text-white/70">总投入</p>
                    <p className="mt-1 text-h2 font-black">
                      <MoneyText tone="dark">{formatCurrency(payload.summary.totalInvested)}</MoneyText>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70">模拟收益</p>
                    <p className="mt-1 text-h2 font-black">
                      <MoneyText tone="dark">{formatCurrency(payload.summary.simulatedReturn)}</MoneyText>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white/70">收益率</p>
                    <p className={cn("mt-1 text-h2 font-black", getMarketMoveClasses(payload.summary.simulatedReturnRate).darkText)}>
                      {formatPercent(payload.summary.simulatedReturnRate)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                {payload.schedule.map((row) => (
                  <article key={row.round} className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-body font-black text-slate-950">第 {row.round} 回合</p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-black",
                          row.status === "executed" ? "bg-info/10 text-info" : "bg-warning/10 text-warning",
                        )}
                      >
                        {row.status === "executed" ? "已执行" : "已跳过"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-slate-500">
                      <span>价格 {formatCurrency(row.price)}</span>
                      <span>份额 {row.quantity}</span>
                      <span>投入 {formatCurrency(row.invested)}</span>
                      <span>均价 {formatCurrency(row.averageCost)}</span>
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{row.note}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <article data-auto-reveal data-motion-card className="panel rounded-[2rem] p-5 md:p-6">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-brand" />
                <h2 className="text-h1 font-semibold text-slate-950">定投 vs 一次性买入</h2>
              </div>
              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.5rem] bg-brand-soft p-5">
                  <p className="text-sm font-bold text-brand-ink">定投机器人</p>
                  <p className="mt-3 text-h1 font-black">
                    <MoneyText>{formatCurrency(payload.summary.terminalValue)}</MoneyText>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    平均成本 {formatCurrency(payload.summary.averageCost)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-slate-100 p-5">
                  <p className="text-sm font-bold text-slate-500">一次性买入</p>
                  <p className="mt-3 text-h1 font-black">
                    <MoneyText>{formatCurrency(payload.comparison.lumpSumTerminalValue)}</MoneyText>
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">
                    起始成本 {formatCurrency(payload.comparison.lumpSumAverageCost)}
                  </p>
                </div>
              </div>
              <p className="mt-5 rounded-[1.35rem] bg-slate-950 px-5 py-4 text-body font-semibold leading-7 text-white">
                本次差异：
                <MoneyText tone="dark" className="mx-1">
                  {formatCurrency(payload.comparison.autoInvestEdge)}
                </MoneyText>
                。差异不是结论，而是复盘入口：市场路径不同，胜出的策略也会不同。
              </p>
            </article>

            <article data-auto-reveal data-motion-card className="panel rounded-[2rem] p-5 md:p-6">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-brand" />
                <h2 className="text-h1 font-semibold text-slate-950">Mr.Brown 训练提示</h2>
              </div>
              <p className="mt-4 text-body font-semibold leading-7 text-slate-600">{payload.coach.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {payload.coach.concepts.map((concept) => (
                  <span key={concept} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">
                    {concept}
                  </span>
                ))}
              </div>
              <div className="mt-5 space-y-3">
                {payload.coach.nextSteps.map((step, index) => (
                  <div key={step} className="rounded-[1.2rem] bg-slate-50 p-4">
                    <p className="text-xs font-black text-brand">STEP {index + 1}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{step}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>
        </div>
      </section>
    </div>
  );
}
