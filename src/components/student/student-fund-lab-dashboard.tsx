"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Bot, CheckCircle2, Layers3, Loader2, PieChart, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { FundLabPayload, FundLabPlan } from "@/lib/fund-lab";
import { cn, formatPercent } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type MessageState = { tone: "success" | "error"; text: string } | null;

function sparkline(points: number[], width = 320, height = 110) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  return points
    .map((point, index) => {
      const x = (index / Math.max(1, points.length - 1)) * width;
      const y = height - ((point - min) / span) * height;
      return `${x},${y}`;
    })
    .join(" ");
}

const planTone: Record<FundLabPlan, string> = {
  defensive: "border-emerald-200 bg-emerald-50/70",
  balanced: "border-orange-200 bg-orange-50/70",
  growth: "border-rose-200 bg-rose-50/70",
};

export function StudentFundLabDashboard({ initialPayload }: { initialPayload: FundLabPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const previewRequestRef = useRef(0);
  const [payload, setPayload] = useState(initialPayload);
  const [plan, setPlan] = useState<FundLabPlan>(initialPayload.selectedPlan.id);
  const [amount, setAmount] = useState(initialPayload.selectedPlan.amount);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pending, startTransition] = useTransition();

  const allocationRows = useMemo(
    () =>
      payload.selectedPlan.allocations.map((allocation) => ({
        ...allocation,
        fund: payload.funds.find((fund) => fund.id === allocation.fundId)!,
      })),
    [payload],
  );

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-fund-item]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-fund-item]", {
        opacity: 0,
        y: 20,
        duration: 0.52,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope: rootRef },
  );

  async function previewCombination(nextPlan: FundLabPlan, nextAmount = amount) {
    const normalizedAmount = Math.max(1000, Math.min(120000, Math.round(nextAmount || 1000)));
    const version = previewRequestRef.current + 1;
    previewRequestRef.current = version;
    setPlan(nextPlan);
    setAmount(normalizedAmount);
    setMessage(null);
    setPreviewPending(true);

    try {
      const params = new URLSearchParams({ plan: nextPlan, amount: String(normalizedAmount) });
      const response = await fetch(`/api/student/fund-lab?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as { payload?: FundLabPayload; message?: string; error?: string };
      if (!response.ok || !data.payload) {
        throw new Error(data.message ?? "基金实验预览失败，请稍后重试。");
      }
      if (previewRequestRef.current !== version) return;
      setPayload(data.payload);
      setPlan(data.payload.selectedPlan.id);
      setAmount(data.payload.selectedPlan.amount);
    } catch (error) {
      if (previewRequestRef.current !== version) return;
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "基金实验预览失败，请稍后再试。",
      });
    } finally {
      if (previewRequestRef.current === version) {
        setPreviewPending(false);
      }
    }
  }

  function requestPayload(intent: "simulate" | "record") {
    if (intent === "simulate") {
      void previewCombination(plan, amount);
      return;
    }

    setMessage(null);
    startTransition(() => {
      void fetch("/api/student/fund-lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent, plan, amount, note }),
      })
        .then(async (response) => {
          const data = (await response.json()) as { payload?: FundLabPayload; message?: string; error?: string };
          if (!response.ok || !data.payload) {
            throw new Error(data.message ?? "基金实验记录失败，请稍后重试。");
          }
          setPayload(data.payload);
          setPlan(data.payload.selectedPlan.id);
          setAmount(data.payload.selectedPlan.amount);
          setNote("");
          setMessage({ tone: "success", text: data.message ?? "基金实验已记录。" });
        })
        .catch((error) => {
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : "基金实验记录失败，请稍后再试。",
          });
        });
    });
  }

  return (
    <div ref={rootRef} className="space-y-6 pb-24" data-testid="fund-lab-dashboard">
      <section
        data-fund-item
        data-motion-reveal
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.24)] md:p-8"
      >
        <div className="absolute -right-16 top-0 h-72 w-72 rounded-full bg-orange-400/20 blur-3xl" />
        <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-orange-300">Fund / ETF Lab</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">
              基金/ETF 实验室：用组合理解长期理财
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/70">
              把指数、债券、黄金和主题基金放在一起比较。这里不推荐真实产品，只训练“分散、回撤、定投、目标金额”这些核心概念。
            </p>
          </div>
          <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-5" aria-busy={previewPending}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white/70">当前实验组合</p>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-orange-200">
                {previewPending ? "正在刷新预览" : "选择即刻预览"}
              </span>
            </div>
            <p className="mt-2 text-3xl font-black text-orange-200">{payload.selectedPlan.label}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="预期年化" value={`${payload.selectedPlan.expectedReturn}%`} />
              <Metric label="风险分" value={payload.selectedPlan.riskScore} />
              <Metric label="最大回撤" value={`${payload.selectedPlan.maxDrawdown}%`} />
              <Metric label="分散度" value={payload.selectedPlan.diversificationScore} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
        <section data-fund-item data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-orange-500" />
            <h2 className="text-2xl font-black text-slate-950">基金池对比</h2>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {payload.funds.map((fund) => (
              <article key={fund.id} data-motion-card className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-slate-950">{fund.name}</p>
                    <p className="mt-1 text-sm font-bold text-slate-600">{fund.type}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    风险 {fund.risk}
                  </span>
                </div>
                <svg viewBox="0 0 320 110" className="mt-4 h-28 w-full overflow-visible rounded-2xl bg-slate-50 p-3">
                  <polyline
                    points={sparkline(fund.series)}
                    fill="none"
                    stroke="rgb(249 115 22)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="mt-4 text-sm leading-7 text-slate-600">{fund.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Metric label="模拟年化" value={formatPercent(fund.expectedReturn)} light />
                  <Metric label="最大回撤" value={`${fund.maxDrawdown}%`} light />
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside data-fund-item data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">模拟配置</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {payload.plans.map((item) => (
                <button
                  data-motion-button
                  key={item.id}
                  type="button"
                  data-testid={`fund-plan-${item.id}`}
                  disabled={previewPending || pending}
                  onClick={() => void previewCombination(item.id)}
                  className={cn(
                    "rounded-[1.4rem] border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-70",
                    plan === item.id ? planTone[item.id] : "border-slate-200 bg-slate-50",
                  )}
                >
                  <p className="text-lg font-black text-slate-950">{item.label}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.summary}</p>
                </button>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="mb-2 block text-sm font-black text-slate-600">模拟金额</span>
              <input
                data-testid="fund-amount"
                type="number"
                min={1000}
                max={120000}
                value={amount}
                onBlur={() => void previewCombination(plan, amount)}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold outline-none focus:border-orange-400"
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-black text-slate-600">配置理由</span>
              <textarea
                data-testid="fund-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                placeholder="例如：我选择均衡组合，是因为既想保留成长空间，也不想让单一主题过度影响净值。"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold leading-7 outline-none focus:border-orange-400"
              />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-testid="fund-preview"
                disabled={pending || previewPending}
                onClick={() => requestPayload("simulate")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-base font-black text-slate-700 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {previewPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                预览组合
              </button>
              <button
                type="button"
                data-testid="fund-record"
                disabled={pending || previewPending}
                onClick={() => requestPayload("record")}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-orange-400 px-5 text-base font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                记录实验
              </button>
            </div>
            {message ? (
              <p
                className={cn(
                  "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                  message.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">配置比例</h2>
            </div>
            <div className="mt-5 space-y-3">
              {allocationRows.map((row) => (
                <div key={row.fundId} className="rounded-[1.35rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{row.fund.name}</p>
                      <p className="text-sm font-bold text-slate-600">{row.fund.type}</p>
                    </div>
                    <p className="text-lg font-black text-orange-700">{row.weight}%</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${row.weight}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section data-fund-item data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-black text-slate-950">{payload.coach.title}</h2>
        </div>
        <p className="mt-4 text-base leading-8 text-slate-600">{payload.coach.summary}</p>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {payload.coach.nextSteps.map((step) => (
            <p key={step} data-motion-card className="flex gap-3 rounded-[1.4rem] bg-slate-50 px-4 py-3 text-sm font-bold leading-6 text-slate-600">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              {step}
            </p>
          ))}
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3" data-testid="fund-history">
          {payload.history.length > 0 ? (
            payload.history.slice(0, 3).map((entry) => (
              <article key={entry.id} data-motion-card className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
                <p className="text-lg font-black text-slate-950">{entry.planLabel}</p>
                <p className="mt-1 text-sm font-bold text-orange-700">
                  第 {entry.round} 回合 · <MoneyText>{`¥${entry.amount.toLocaleString("zh-CN")}`}</MoneyText>
                </p>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{entry.note}</p>
              </article>
            ))
          ) : (
            <p className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-base font-semibold text-slate-600 lg:col-span-3">
              还没有基金实验记录。先预览一个组合，再把配置理由记录进历史复盘。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  light = false,
}: {
  label: string;
  value: string | number;
  light?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl p-3", light ? "bg-slate-50" : "bg-white/10")}>
      <p className={cn("text-xs font-bold", light ? "text-slate-600" : "text-white/70")}>{label}</p>
      <p className={cn("mt-1 text-lg font-black", light ? "text-slate-950" : "text-white")}>{value}</p>
    </div>
  );
}
