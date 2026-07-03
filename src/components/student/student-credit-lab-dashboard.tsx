"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  Calculator,
  CreditCard,
  Loader2,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { CreditLabActionResult, CreditLabPayload, CreditScenarioId } from "@/lib/credit-lab";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const statusClass: Record<CreditLabPayload["selectedScenario"]["status"], string> = {
  healthy: "border-down/20 bg-down-soft text-[var(--down-700)]",
  watch: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-error/20 bg-error-soft text-error",
};

function scoreTone(score: number) {
  if (score >= 82) return "text-down";
  if (score >= 68) return "text-brand";
  if (score >= 52) return "text-warning";
  return "text-error";
}

export function StudentCreditLabDashboard({ initialPayload }: { initialPayload: CreditLabPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [scenarioId, setScenarioId] = useState<CreditScenarioId>(initialPayload.selectedScenarioId);
  const [amount, setAmount] = useState(String(initialPayload.selectedScenario.principal));
  const [result, setResult] = useState<CreditLabActionResult | null>(null);
  const [message, setMessage] = useState("");
  const [pendingIntent, setPendingIntent] = useState<"simulate" | "borrow" | "repay" | null>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-credit-reveal], [data-credit-card]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-credit-reveal]", {
        y: 18,
        opacity: 0,
        duration: 0.58,
        ease: "power3.out",
        stagger: 0.05,
      });
      gsap.from("[data-credit-card]", {
        x: 18,
        opacity: 0,
        duration: 0.54,
        ease: "power2.out",
        stagger: 0.045,
      });
    },
    { scope: rootRef },
  );

  async function submit(intent: "simulate" | "borrow" | "repay", nextScenarioId = scenarioId) {
    setMessage("");
    setResult(null);
    setPendingIntent(intent);
    try {
      const response = await fetch("/api/student/credit-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent,
          scenarioId: nextScenarioId,
          amount: Number(amount),
        }),
      });
      const data = (await response.json()) as {
        payload?: CreditLabPayload;
        applied?: CreditLabActionResult;
        message?: string;
      };
      if (!response.ok || !data.payload) {
        throw new Error(data.message || "信用实验室操作失败，请稍后再试。");
      }
      setPayload(data.payload);
      setScenarioId(data.payload.selectedScenarioId);
      setResult(data.applied ?? null);
      setMessage(
        data.applied
          ? data.applied.summary
          : "已完成模拟。请比较月供、总利息和债务率，再决定是否写入沙盘。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "信用实验室操作失败，请稍后再试。");
    } finally {
      setPendingIntent(null);
    }
  }

  const selected = payload.selectedScenario;

  return (
    <div ref={rootRef} className="space-y-6" data-testid="credit-lab-dashboard">
      {/* Dark hero panel — no .bz-hero-stat chip (amber-50 bg fails on dark) */}
      <section data-credit-reveal data-motion-reveal className="overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft">
        <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-brand/20 blur-3xl" />

          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <p className="bz-eyebrow-inverse">Credit Lab</p>
            <h1 className="mt-3 max-w-3xl text-display-lg font-semibold md:text-display-xl">
              先算清利息，再决定要不要借
            </h1>
            <p className="mt-4 max-w-3xl text-body-lg leading-8 text-white/68">
              信用实验室把分期、应急借款和提前还款放进同一张沙盘。借款会增加现金，也会同步增加债务；真正要学的是未来现金流能不能承受。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {/* Hero number — credit score — on dark bg, use text-hero-num text-white directly */}
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5 md:col-span-2">
                <p className="bz-eyebrow-inverse">信用健康分</p>
                <p className={cn("mt-3 text-hero-num tabular-nums", scoreTone(payload.overview.creditScore))}>
                  {payload.overview.creditScore}
                </p>
                <p className="mt-2 text-body-sm text-white/58">{payload.overview.stageLabel}</p>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="bz-eyebrow-inverse">债务率</p>
                <p className="mt-3 text-h2 tabular-nums text-white">{payload.overview.debtToAssets}%</p>
                <p className="mt-2 text-caption text-white/70">债务 / 总资产</p>
              </div>
              <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
                <p className="bz-eyebrow-inverse">月利息估算</p>
                <p className="mt-3 text-h2 tabular-nums text-white">
                  <MoneyText>{formatCurrency(payload.overview.monthlyInterestEstimate)}</MoneyText>
                </p>
                <p className="mt-2 text-caption text-white/70">用于教学估算</p>
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 xl:border-l xl:border-t-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="bz-eyebrow-inverse">Mr.Brown</p>
                <h2 className="mt-3 text-h1 text-white">{payload.coach.title}</h2>
              </div>
              <Sparkles className="h-6 w-6 text-brand-warm" />
            </div>
            <p className="mt-4 text-body leading-8 text-white/68">{payload.coach.summary}</p>
            <div className="mt-6 grid gap-3">
              {payload.coach.nextSteps.map((step, index) => (
                <div key={step} className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-body-sm font-semibold text-slate-950">
                      {index + 1}
                    </span>
                    <p className="text-body-sm leading-6 text-white/72">{step}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div data-credit-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-brand" />
                <h2 className="text-h1 text-fg-strong">信用场景卡</h2>
              </div>
              <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
                先模拟，再执行。执行借款或还款会写入沙盘历史，但不会凭空提高净值。
              </p>
            </div>
            <span className={cn("rounded-full border px-4 py-2 text-caption font-semibold", statusClass[selected.status])}>
              {selected.stressLabel}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {payload.scenarios.map((scenario) => (
              <button
                key={scenario.id}
                type="button"
                data-credit-card
                data-motion-card
                  onClick={() => {
                    setScenarioId(scenario.id);
                    setAmount(String(scenario.principal));
                    void submit("simulate", scenario.id);
                  }}
                className={cn(
                  "rounded-[1.55rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
                  scenario.id === scenarioId
                    ? "border-border-brand bg-brand-subtle"
                    : "border-slate-200 bg-white",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="bz-eyebrow bz-brand-text-on-light">{scenario.difficulty}</p>
                    <h3 className="mt-2 text-h3 text-fg-strong">{scenario.title}</h3>
                  </div>
                  <WalletCards className="h-5 w-5 text-brand" />
                </div>
                <p className="mt-3 text-body-sm leading-6 text-fg-muted">{scenario.purpose}</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-slate-950/[0.035] p-3">
                    <p className="text-caption text-fg-muted">本金</p>
                    <p className="mt-1 text-body-sm font-semibold tabular-nums text-fg-strong">{formatCurrency(scenario.principal)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950/[0.035] p-3">
                    <p className="text-caption text-fg-muted">总利息</p>
                    <p className="mt-1 text-body-sm font-semibold tabular-nums text-fg-strong">{formatCurrency(scenario.totalInterest)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
              <h3 className="text-h2 text-fg-strong">{selected.title}</h3>
              <p className="mt-2 text-body-sm leading-6 text-fg-muted">{selected.concept}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">
                {[
                  ["月供", selected.monthlyPayment],
                  ["总还款", selected.totalRepayment],
                  ["总利息", selected.totalInterest],
                  ["借后债务率", `${selected.debtRatioAfter}%`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-950/[0.035] p-4">
                    <p className="text-caption text-fg-muted">{label}</p>
                    <p className="mt-2 text-body-sm font-semibold tabular-nums text-fg-strong">
                      {typeof value === "number" ? formatCurrency(value) : value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5">
              <label className="text-body-sm font-semibold text-fg-strong" htmlFor="credit-amount">
                操作金额
              </label>
              <input
                id="credit-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="mt-3 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-fg-strong outline-none transition focus:border-brand"
                inputMode="numeric"
              />
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  data-testid="credit-lab-simulate"
                  onClick={() => void submit("simulate")}
                  disabled={pendingIntent !== null}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-body-sm font-semibold text-fg-default transition hover:border-brand disabled:opacity-60"
                >
                  <Calculator className="h-4 w-4" />
                  {pendingIntent === "simulate" ? "模拟中..." : "先模拟成本"}
                </button>
                <button
                  type="button"
                  data-testid="credit-lab-borrow"
                  onClick={() => void submit("borrow")}
                  disabled={pendingIntent !== null}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand px-4 text-body-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5 disabled:opacity-60"
                >
                  {pendingIntent === "borrow" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUpCircle className="h-4 w-4" />}
                  执行教学借款
                </button>
                <button
                  type="button"
                  data-testid="credit-lab-repay"
                  onClick={() => void submit("repay")}
                  disabled={pendingIntent !== null || payload.overview.debt <= 0}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-body-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pendingIntent === "repay" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownCircle className="h-4 w-4" />}
                  提前还款
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside data-credit-reveal data-motion-reveal className="space-y-6">
          <div className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-h2 text-fg-strong">还款雷达</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {payload.repaymentOptions.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "rounded-[1.35rem] border p-4",
                    option.disabled ? "border-slate-200 bg-slate-50 opacity-60" : "border-border-brand bg-brand-subtle",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body-sm font-semibold text-fg-strong">{option.label}</p>
                    <p className="text-body-sm font-semibold tabular-nums text-brand-ink">{formatCurrency(option.amount)}</p>
                  </div>
                  <p className="mt-2 text-caption leading-5 text-fg-muted">
                    预计少付利息约 {formatCurrency(option.interestSavedEstimate)}，还款后债务{" "}
                    {formatCurrency(option.afterDebt)}。
                  </p>
                </div>
              ))}
            </div>
          </div>

          {(message || result) && (
            <div
              role={message.includes("失败") || message.includes("过高") ? "alert" : "status"}
              data-testid="credit-lab-result"
              className="rounded-[2rem] border border-brand/20 bg-brand-subtle p-5 md:p-6"
            >
              <div className="flex items-start gap-3">
                {result ? (
                  <BadgeCheck className="mt-1 h-5 w-5 text-brand" />
                ) : (
                  <AlertTriangle className="mt-1 h-5 w-5 text-warning" />
                )}
                <div>
                  <h2 className="text-h3 text-fg-strong">操作反馈</h2>
                  <p className="mt-2 text-body-sm leading-6 text-fg-muted">{message}</p>
                  {result && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-caption text-fg-muted">现金</p>
                        <p className="mt-1 text-body-sm font-semibold tabular-nums text-fg-strong">{formatCurrency(result.cashAfter)}</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-caption text-fg-muted">债务</p>
                        <p className="mt-1 text-body-sm font-semibold tabular-nums text-fg-strong">{formatCurrency(result.debtAfter)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
