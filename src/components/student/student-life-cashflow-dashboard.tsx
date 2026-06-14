"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  HeartPulse,
  Loader2,
  PiggyBank,
  ReceiptText,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Umbrella,
  WalletCards,
} from "lucide-react";

import type {
  BudgetPlanId,
  InsurancePlanId,
  LifeCashflowApplicationResult,
  LifeCashflowPayload,
} from "@/lib/life-cashflow";
import { clamp, cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type LoadState = "idle" | "loading" | "success" | "error";

const stressTone: Record<LifeCashflowPayload["stressEvents"][number]["status"], string> = {
  safe: "bg-info/10 text-info",
  watch: "bg-warning/10 text-warning",
  danger: "bg-error-soft text-error",
};

const rowIcon: Record<LifeCashflowPayload["budgetRows"][number]["id"], typeof ReceiptText> = {
  essentials: ReceiptText,
  learning: Sparkles,
  social: HeartPulse,
  saving: PiggyBank,
};

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StudentLifeCashflowDashboard({ initialPayload }: { initialPayload: LifeCashflowPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [planId, setPlanId] = useState<BudgetPlanId>(initialPayload.selectedPlanId);
  const [insuranceId, setInsuranceId] = useState<InsurancePlanId>(initialPayload.selectedInsuranceId);
  const [state, setState] = useState<LoadState>("idle");
  const [applyState, setApplyState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [lastApplied, setLastApplied] = useState<LifeCashflowApplicationResult | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-life-reveal], [data-stress-card]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-life-reveal]", {
        y: 20,
        opacity: 0,
        duration: 0.62,
        ease: "power3.out",
        stagger: 0.055,
      });
      gsap.from("[data-stress-card]", {
        x: 18,
        opacity: 0,
        duration: 0.56,
        ease: "power2.out",
        stagger: 0.045,
      });
    },
    { scope: rootRef },
  );

  async function recalculate(nextPlanId = planId, nextInsuranceId = insuranceId) {
    setState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/student/life-cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "simulate", planId: nextPlanId, insuranceId: nextInsuranceId }),
      });
      const data = (await response.json()) as { payload?: LifeCashflowPayload; message?: string };
      if (!response.ok || !data.payload) {
        throw new Error(data.message || "生活现金流测算失败，请稍后再试。");
      }
      setPayload(data.payload);
      setPlanId(data.payload.selectedPlanId);
      setInsuranceId(data.payload.selectedInsuranceId);
      setState("success");
      setMessage("已根据最新方案更新现金流压力测试。");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "生活现金流测算失败，请稍后再试。");
    }
  }

  async function applyChallenge() {
    setApplyState("loading");
    setMessage("");
    try {
      const response = await fetch("/api/student/life-cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "apply", planId, insuranceId }),
      });
      const data = (await response.json()) as {
        payload?: LifeCashflowPayload;
        applied?: LifeCashflowApplicationResult;
        message?: string;
      };
      if (!response.ok || !data.payload || !data.applied) {
        throw new Error(data.message || "本月预算挑战执行失败，请稍后再试。");
      }
      setPayload(data.payload);
      setPlanId(data.payload.selectedPlanId);
      setInsuranceId(data.payload.selectedInsuranceId);
      setLastApplied(data.applied);
      setApplyState("success");
      setMessage("本月预算挑战已写入沙盘历史，并同步更新现金、储蓄和债务。");
    } catch (error) {
      setApplyState("error");
      setMessage(error instanceof Error ? error.message : "本月预算挑战执行失败，请稍后再试。");
    }
  }

  const emergencyProgress = clamp(
    (payload.overview.emergencyFund / Math.max(payload.overview.emergencyTarget, 1)) * 100,
    4,
    100,
  );
  const busy = state === "loading" || applyState === "loading";

  return (
    <div ref={rootRef} className="space-y-6" data-testid="life-cashflow-dashboard">
      <section data-life-reveal data-motion-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Life Ledger</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <h1 className="text-display-lg font-semibold md:text-display-xl">生活现金流实验室</h1>
                <p className="mt-4 text-body-lg leading-8 text-white/68">
                  把每月收入、必要支出、自动储蓄、保险保费和突发事件放在同一张账本里。
                  真实理财不只是市场涨跌，更是现金流能不能扛住生活。
                </p>
              </div>
              <div className="rounded-[1.7rem] border border-white/12 bg-white/[0.08] p-5">
                <p className="text-sm font-bold text-white/58">现金流评分</p>
                <p className="mt-2 text-display-xl font-black tabular-nums text-brand-warm">
                  {payload.overview.cashflowScore}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/60">{payload.overview.stageLabel}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {[
                {
                  label: "模拟月收入",
                  value: formatCurrency(payload.overview.monthlyIncome),
                  icon: CircleDollarSign,
                  hint: "奖学金、零花钱和兼职式收入合并估算。",
                },
                {
                  label: "必要支出",
                  value: formatCurrency(payload.overview.requiredExpense),
                  icon: ReceiptText,
                  hint: "必须支付的生活成本、债务和保费。",
                },
                {
                  label: "计划储蓄",
                  value: formatCurrency(payload.overview.plannedSaving),
                  icon: PiggyBank,
                  hint: `储蓄率 ${payload.overview.savingsRate}%`,
                },
                {
                  label: "可撑月数",
                  value: `${payload.overview.runwayMonths} 月`,
                  icon: Umbrella,
                  hint: "现金和储蓄能覆盖几个月必要开销。",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                <div key={item.label} className="min-w-0 rounded-[1.45rem] border border-white/10 bg-white/[0.07] p-5">
                    <div className="flex items-center gap-2 text-white/58">
                      <Icon className="h-4 w-4 text-brand-warm" />
                    <p className="text-sm font-bold">{item.label}</p>
                  </div>
                    <p className="mt-3 whitespace-nowrap text-h1 font-black tabular-nums text-white">{item.value}</p>
                    <p className="mt-2 text-xs font-semibold leading-5 text-white/52">{item.hint}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 xl:border-l xl:border-t-0">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.07] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white/56">应急金进度</p>
                  <p className="mt-2 text-h1 font-black text-white">
                    {formatCurrency(payload.overview.emergencyFund)}
                  </p>
                </div>
                <ShieldCheck className="h-8 w-8 text-brand-warm" />
              </div>
              <div className="mt-5 h-4 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-brand to-info" style={{ width: `${emergencyProgress}%` }} />
              </div>
              <div className="mt-3 flex justify-between gap-3 text-xs font-bold text-white/58">
                <span>目标 {formatCurrency(payload.overview.emergencyTarget)}</span>
                <span>
                  {payload.overview.emergencyGap > 0
                    ? `缺口 ${formatCurrency(payload.overview.emergencyGap)}`
                    : "已达标"}
                </span>
              </div>
            </div>

            <div className="mt-5 rounded-[1.7rem] border border-brand/20 bg-brand/10 p-5">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-warm">Mr.Brown</p>
              <h2 className="mt-3 text-h1 font-semibold text-white">{payload.coach.title}</h2>
              <p className="mt-3 text-body leading-7 text-white/66">{payload.coach.summary}</p>
              <button
                type="button"
                data-testid="life-cashflow-apply"
                onClick={() => void applyChallenge()}
                disabled={busy}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {applyState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                执行本月预算挑战
              </button>
            </div>

            {lastApplied && (
              <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-white/[0.07] p-5" data-testid="life-cashflow-result">
                <p className="text-sm font-bold text-white/56">本月执行结果</p>
                <p className="mt-3 text-body font-semibold leading-7 text-white/76">{lastApplied.summary}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-bold">
                  <div className="rounded-2xl bg-white/[0.08] p-3">
                    <p className="text-white/48">转入储蓄</p>
                    <p className="mt-1 text-brand-warm">{formatCurrency(lastApplied.savingTransferred)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.08] p-3">
                    <p className="text-white/48">偿还债务</p>
                    <p className="mt-1 text-brand-warm">{formatCurrency(lastApplied.debtPaid)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.08] p-3">
                    <p className="text-white/48">应急金</p>
                    <p className="mt-1 text-white">{formatCurrency(lastApplied.emergencyFundAfter)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/[0.08] p-3">
                    <p className="text-white/48">新评分</p>
                    <p className="mt-1 text-white">{lastApplied.cashflowScoreAfter}</p>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div data-life-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <WalletCards className="h-5 w-5 text-brand" />
                  <h2 className="text-h1 font-semibold text-slate-950">选择预算策略</h2>
                </div>
                <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                  预算不是少花钱比赛，而是给重要目标留位置。切换方案后会重新测算现金流。
                </p>
              </div>
              <button
                type="button"
                data-testid="life-cashflow-submit"
                onClick={() => recalculate()}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                重新测算
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {payload.plans.map((plan) => {
                const active = plan.id === planId;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    data-testid={`budget-plan-${plan.id}`}
                    onClick={() => {
                      setPlanId(plan.id);
                      void recalculate(plan.id, insuranceId);
                    }}
                    className={cn(
                      "min-h-40 rounded-[1.5rem] border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
                      active ? "border-brand bg-brand-soft" : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-h2 font-black text-slate-950">{plan.title}</h3>
                      {active ? <CheckCircle2 className="h-5 w-5 text-brand" /> : <span className="h-5 w-5 rounded-full border border-slate-300" />}
                    </div>
                    <p className="mt-3 text-body font-semibold leading-7 text-slate-600">{plan.tagline}</p>
                    <p className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">{plan.concept}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ReceiptText className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">本月预算分配</h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {payload.budgetRows.map((row) => {
                const Icon = rowIcon[row.id];
                return (
                  <article key={row.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="text-h2 font-black text-slate-950">{row.label}</h3>
                          <p className="text-sm font-bold text-slate-400">{row.ratio}%</p>
                        </div>
                      </div>
                      <p className="text-h2 font-black tabular-nums text-brand">{formatCurrency(row.amount)}</p>
                    </div>
                    <div className="mt-4 h-3 rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${clamp(row.ratio, 4, 100)}%` }} />
                    </div>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{row.hint}</p>
                  </article>
                );
              })}
            </div>
          </section>
        </div>

        <aside data-life-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Umbrella className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">保险方案</h2>
            </div>
            <p className="mt-2 text-body leading-7 text-slate-600">{payload.insurance.summary}</p>
            <div className="mt-5 space-y-3">
              {payload.insurance.options.map((option) => {
                const active = option.id === insuranceId;
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`insurance-plan-${option.id}`}
                    onClick={() => {
                      setInsuranceId(option.id);
                      void recalculate(planId, option.id);
                    }}
                    className={cn(
                      "w-full rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5",
                      active ? "border-brand bg-brand-soft" : "border-slate-200 bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-body font-black text-slate-950">{option.title}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          保费 {formatCurrency(option.premium)} · 覆盖 {Math.round(option.coverageRate * 100)}%
                        </p>
                      </div>
                      {active && <CheckCircle2 className="h-5 w-5 text-brand" />}
                    </div>
                    <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{option.concept}</p>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 rounded-[1.35rem] bg-slate-950 p-4 text-white">
              <p className="text-sm font-bold text-white/58">保障评分</p>
              <p className="mt-2 text-display-md font-black tabular-nums text-brand-warm">
                {payload.insurance.coverageScore}
              </p>
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">突发事件压力测试</h2>
            </div>
            <div className="mt-5 space-y-3">
              {payload.stressEvents.map((event) => (
                <article key={event.id} data-stress-card data-motion-card className="rounded-[1.35rem] border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body font-black text-slate-950">{event.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">原始成本 {formatCurrency(event.cost)}</p>
                    </div>
                    <span className={cn("rounded-full px-3 py-1 text-xs font-black", stressTone[event.status])}>
                      {event.status === "safe" ? "可承受" : event.status === "watch" ? "需观察" : "现金紧张"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-slate-400">保险覆盖</p>
                      <p className="mt-1 text-slate-950">{formatCurrency(event.coveredAmount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-slate-400">自付金额</p>
                      <p className="mt-1 text-brand">{formatCurrency(event.outOfPocket)}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{event.teachingPoint}</p>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section data-life-reveal data-motion-reveal className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-slate-950">4 周生活账本训练</h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {payload.weeklyPlan.map((week) => (
              <article key={week.week} className="rounded-[1.5rem] bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">Week 0{week.week}</p>
                <h3 className="mt-3 text-h2 font-black text-slate-950">{week.title}</h3>
                <p className="mt-3 text-body font-semibold text-slate-600">本周弹性预算 {formatCurrency(week.budget)}</p>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">{week.checkpoint}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-brand" />
            <h2 className="text-h1 font-semibold text-slate-950">下一步行动</h2>
          </div>
          <div className="mt-5 space-y-3">
            {payload.coach.nextSteps.map((step, index) => (
              <div key={step} className="flex gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
                  {index + 1}
                </span>
                <p className="text-body font-semibold leading-7 text-slate-700">{step}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs font-bold text-slate-400">最近测算：{formatTime(payload.generatedAt)}</p>
          {(state === "success" || applyState === "success") && (
            <p role="status" className="mt-4 flex items-center gap-2 text-sm font-bold text-info">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          )}
          {(state === "error" || applyState === "error") && (
            <p role="alert" className="mt-4 flex items-center gap-2 text-sm font-bold text-error">
              <AlertCircle className="h-4 w-4" />
              {message}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
