"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, Loader2, ShieldCheck, Siren, Umbrella, WalletCards } from "lucide-react";

import { MoneyText } from "@/components/shared/money-text";
import type { InsurancePlanId } from "@/lib/life-cashflow";
import type { ProtectionUmbrellaPayload } from "@/lib/protection-umbrella";
import { cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type MessageState = { tone: "success" | "error"; text: string } | null;

const scenarioTone: Record<ProtectionUmbrellaPayload["scenarios"][number]["status"], string> = {
  safe: "border-down/20 bg-down-soft text-down",
  watch: "border-warning/20 bg-warning/10 text-warning",
  danger: "border-error/20 bg-error-soft text-error",
};

const scenarioLabel: Record<ProtectionUmbrellaPayload["scenarios"][number]["status"], string> = {
  safe: "可承受",
  watch: "需关注",
  danger: "压力过大",
};

function radarPoints(values: number[], size = 220) {
  const center = size / 2;
  const radius = size * 0.38;
  return values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / values.length;
      const distance = radius * (value / 100);
      return `${center + Math.cos(angle) * distance},${center + Math.sin(angle) * distance}`;
    })
    .join(" ");
}

function gridPolygon(level: number, count: number, size = 220) {
  return radarPoints(Array.from({ length: count }, () => level), size);
}

export function StudentProtectionUmbrellaDashboard({ initialPayload }: { initialPayload: ProtectionUmbrellaPayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [planId, setPlanId] = useState<InsurancePlanId>(initialPayload.selectedPlanId);
  const [stressId, setStressId] = useState(initialPayload.scenarios[0]?.id ?? "phone-repair");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<MessageState>(null);
  const [previewPending, setPreviewPending] = useState(false);
  const [pending, startTransition] = useTransition();

  const radarShape = useMemo(
    () => radarPoints(payload.dimensions.map((dimension) => dimension.value)),
    [payload.dimensions],
  );
  const selectedScenario = payload.scenarios.find((scenario) => scenario.id === stressId) ?? payload.scenarios[0];

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-protection-reveal]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-protection-reveal]", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        ease: "power3.out",
        stagger: 0.05,
      });
    },
    { scope: rootRef },
  );

  function previewPlan(nextPlanId: InsurancePlanId) {
    setPlanId(nextPlanId);
    setMessage(null);
    setPreviewPending(true);

    void fetch(`/api/student/protection?planId=${encodeURIComponent(nextPlanId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { payload?: ProtectionUmbrellaPayload; message?: string; error?: string };
        if (!response.ok || !data.payload) {
          throw new Error(data.message ?? data.error ?? "保护方案预览失败，请稍后再试。");
        }
        setPayload(data.payload);
        if (!data.payload.scenarios.some((scenario) => scenario.id === stressId)) {
          setStressId(data.payload.scenarios[0]?.id ?? "phone-repair");
        }
      })
      .catch((error) => {
        setMessage({
          tone: "error",
          text: error instanceof Error ? error.message : "保护方案预览失败，请稍后再试。",
        });
      })
      .finally(() => setPreviewPending(false));
  }

  function recordProtection() {
    setMessage(null);
    startTransition(() => {
      void fetch("/api/student/protection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId, stressId, note }),
      })
        .then(async (response) => {
          const data = (await response.json()) as { payload?: ProtectionUmbrellaPayload; message?: string; error?: string };
          if (!response.ok || !data.payload) {
            throw new Error(data.message ?? data.error ?? "保护伞复盘失败，请稍后再试。");
          }
          setPayload(data.payload);
          setPlanId(data.payload.selectedPlanId);
          setNote("");
          setMessage({ tone: "success", text: data.message ?? "保护伞复盘已记录。" });
        })
        .catch((error) => {
          setMessage({
            tone: "error",
            text: error instanceof Error ? error.message : "保护伞复盘失败，请稍后再试。",
          });
        });
    });
  }

  return (
    <div ref={rootRef} className="space-y-6 pb-24">
      <section
        data-protection-reveal
        data-motion-reveal
        className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.22)] md:p-8"
      >
        <div className="absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-orange-300">Protection Umbrella</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight md:text-5xl">
              风险保护伞：先学会防守，再追求成长
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-white/68">
              保险、应急金、债务和资产分散不是“没意思”的部分，它们决定坏情况出现时你还能不能继续学习和行动。
            </p>
          </div>
          <div data-motion-card className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-white/70">保护分</p>
              <span className="rounded-full bg-white/[0.08] px-3 py-1 text-xs font-black text-orange-100">
                {previewPending ? "预览刷新中" : "选择方案即刻预览"}
              </span>
            </div>
            <p className="mt-2 text-5xl font-black text-orange-100">{payload.overview.protectionScore}</p>
            <p className="mt-3 text-lg font-black">{payload.overview.stageLabel}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="应急金" value={<MoneyText tone="dark">{formatCurrency(payload.overview.emergencyFund)}</MoneyText>} />
              <Metric label="缓冲月数" value={`${payload.overview.runwayMonths}个月`} />
              <Metric label="债务" value={<MoneyText tone="dark">{formatCurrency(payload.overview.debt)}</MoneyText>} />
              <Metric label="月保费" value={<MoneyText tone="dark">{formatCurrency(payload.overview.monthlyPremium)}</MoneyText>} />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section data-protection-reveal data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Umbrella className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">保护伞雷达</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">
              不是投顾建议，是生活风险训练
            </span>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div data-motion-viz className="rounded-[1.6rem] bg-slate-950 p-5 text-white">
              <svg viewBox="0 0 220 220" className="mx-auto h-64 w-full max-w-72">
                {[25, 50, 75, 100].map((level) => (
                  <polygon
                    key={level}
                    points={gridPolygon(level, payload.dimensions.length)}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="1"
                  />
                ))}
                <polygon data-motion-viz-path points={radarShape} fill="rgba(249,115,22,0.25)" stroke="rgb(251,146,60)" strokeWidth="3" />
                {payload.dimensions.map((dimension, index) => {
                  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / payload.dimensions.length;
                  const x = 110 + Math.cos(angle) * 96;
                  const y = 110 + Math.sin(angle) * 96;
                  return (
                    <text key={dimension.id} x={x} y={y} textAnchor="middle" className="fill-white/70 text-[10px] font-bold">
                      {dimension.label}
                    </text>
                  );
                })}
              </svg>
            </div>

            <div className="grid gap-3">
              {payload.dimensions.map((dimension) => (
                <article key={dimension.id} data-motion-card className="rounded-[1.35rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="whitespace-nowrap text-lg font-black text-slate-950">{dimension.label}</p>
                    <span className="text-xl font-black text-orange-500">{dimension.value}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{dimension.summary}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <aside data-protection-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-orange-500" />
              <h2 className="text-2xl font-black text-slate-950">选择保护方案</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {payload.plans.map((plan) => (
                <button
                  data-motion-card
                  key={plan.id}
                  type="button"
                  data-testid={`protection-plan-${plan.id}`}
                  onClick={() => previewPlan(plan.id)}
                  disabled={previewPending || pending}
                  className={cn(
                    "rounded-[1.25rem] border p-4 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70",
                    plan.id === planId ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-black text-slate-950">{plan.title}</p>
                    <p className="text-sm font-black text-orange-500">{formatCurrency(plan.premium)}/月</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{plan.concept}</p>
                </button>
              ))}
            </div>

            <label className="mt-5 block text-sm font-black text-slate-700" htmlFor="stress-select">
              压力测试事件
            </label>
            <select
              id="stress-select"
              value={stressId}
              onChange={(event) => setStressId(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none focus:border-orange-300"
            >
              {payload.scenarios.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.title}
                </option>
              ))}
            </select>
            {selectedScenario ? (
              <div className="mt-3 rounded-[1.25rem] bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">当前预览：{selectedScenario.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                      先看坏情况里现金会被拿走多少，再决定要不要为保护付出保费。
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-black", scenarioTone[selectedScenario.status])}>
                    {scenarioLabel[selectedScenario.status]}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Metric label="自付" value={<MoneyText>{formatCurrency(selectedScenario.outOfPocket)}</MoneyText>} light />
                  <Metric label="覆盖" value={<MoneyText>{formatCurrency(selectedScenario.coveredAmount)}</MoneyText>} light />
                </div>
              </div>
            ) : null}

            <textarea
              data-testid="protection-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="例如：我想比较有保险和无保险时，运动受伤会怎样影响现金流。"
              className="mt-4 min-h-24 w-full resize-none rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-700 outline-none focus:border-orange-300"
            />

            <button
              data-motion-button
              type="button"
              data-testid="protection-submit"
              onClick={recordProtection}
              disabled={pending}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-base font-black text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <WalletCards className="h-5 w-5" />}
              记录保护复盘
            </button>
            {message ? (
              <p
                className={cn(
                  "mt-4 rounded-2xl px-4 py-3 text-sm font-bold",
                  message.tone === "success" ? "bg-down-soft text-down" : "bg-error-soft text-error",
                )}
              >
                {message.text}
              </p>
            ) : null}
          </section>

          <section className="rounded-[2rem] bg-slate-950 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-orange-300">Mr.Brown</p>
            <h2 className="mt-2 text-xl font-black">{payload.coach.title}</h2>
            <p className="mt-3 text-sm leading-7 text-white/68">{payload.coach.summary}</p>
            <div className="mt-4 space-y-3">
              {payload.coach.nextSteps.map((step) => (
                <div key={step} data-motion-card className="flex gap-3 rounded-2xl bg-white/[0.06] p-3 text-sm leading-6 text-white/78">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section data-protection-reveal data-motion-reveal data-testid="protection-history" className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-orange-500" />
            <h2 className="text-2xl font-black text-slate-950">最近保护复盘</h2>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">
            记录的是学习证据，不改变净值
          </span>
        </div>
        {payload.history.length > 0 ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {payload.history.slice(0, 3).map((item) => (
              <article key={item.id} data-motion-card className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-slate-950">{item.planTitle}</p>
                    <p className="mt-1 text-sm font-bold text-slate-400">第 {item.round} 回合 · {item.stressTitle}</p>
                  </div>
                  <span className="rounded-full bg-orange-50 px-3 py-1 text-sm font-black text-orange-500">
                    {item.score}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-500">{item.note}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-5">
            <p className="text-base font-black text-slate-950">还没有保护复盘记录</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              先选择一个保护方案，再挑一个突发事件做压力测试。记录后，它会进入历史复盘和任务中心。
            </p>
          </div>
        )}
      </section>

      <section data-protection-reveal data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5 text-orange-500" />
          <h2 className="text-2xl font-black text-slate-950">突发事件压力测试</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {payload.scenarios.map((scenario) => (
            <article key={scenario.id} data-motion-card className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-slate-950">{scenario.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-400">事件成本 {formatCurrency(scenario.cost)}</p>
                </div>
                <span className={cn("rounded-full border px-3 py-1 text-xs font-black", scenarioTone[scenario.status])}>
                  {scenarioLabel[scenario.status]}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="自付" value={<MoneyText>{formatCurrency(scenario.outOfPocket)}</MoneyText>} light />
                <Metric label="覆盖" value={<MoneyText>{formatCurrency(scenario.coveredAmount)}</MoneyText>} light />
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-500">{scenario.teachingPoint}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, light = false }: { label: string; value: ReactNode; light?: boolean }) {
  return (
    <div className={cn("rounded-2xl p-3", light ? "bg-slate-50" : "bg-white/[0.07]")}>
      <p className={cn("text-xs font-black uppercase tracking-[0.16em]", light ? "text-slate-400" : "text-white/70")}>
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-black", light ? "text-slate-950" : "text-orange-100")}>{value}</p>
    </div>
  );
}
