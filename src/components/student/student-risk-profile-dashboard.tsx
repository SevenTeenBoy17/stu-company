"use client";

import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle2,
  Compass,
  Loader2,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";

import type { RiskProfileAnswer, RiskProfilePayload } from "@/lib/risk-profile";
import { clamp, cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type SubmitState = "idle" | "loading" | "success" | "error";

const bandClass: Record<RiskProfilePayload["band"], string> = {
  defensive: "from-slate-950 via-slate-900 to-slate-950",
  steady: "from-slate-950 via-slate-900 to-slate-950",
  balanced: "from-slate-950 via-slate-900 to-slate-950",
  growth: "from-slate-950 via-slate-900 to-slate-950",
};

const allocationTone: Record<RiskProfilePayload["allocation"][number]["tone"], string> = {
  low: "bg-warning/10 text-warning",
  fit: "bg-down-soft text-[var(--down-700)]",
  high: "bg-error-soft text-error",
};

function radarPoints(metrics: RiskProfilePayload["radar"], radius = 78, center = 96) {
  return metrics
    .map((metric, index) => {
      const angle = (Math.PI * 2 * index) / metrics.length - Math.PI / 2;
      const valueRadius = (metric.value / 100) * radius;
      return `${(center + Math.cos(angle) * valueRadius).toFixed(1)},${(
        center + Math.sin(angle) * valueRadius
      ).toFixed(1)}`;
    })
    .join(" ");
}

function axisPoint(index: number, total: number, radius = 84, center = 96) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function upsertAnswer(answers: RiskProfileAnswer[], next: RiskProfileAnswer) {
  return answers.map((answer) => (answer.questionId === next.questionId ? next : answer));
}

function RadarChart({ metrics }: { metrics: RiskProfilePayload["radar"] }) {
  const points = radarPoints(metrics);
  const rings = [24, 42, 60, 78];
  const center = 96;
  const total = metrics.length;

  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-brand-warm" />
          <p className="text-sm font-bold text-white">6 维风险雷达</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/66">教学画像</span>
      </div>
      <svg viewBox="0 0 192 192" className="mt-4 h-56 w-full max-w-[280px] mx-auto overflow-visible">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={Array.from({ length: total })
              .map((_, index) => {
                const point = axisPoint(index, total, ring, center);
                return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="1"
          />
        ))}
        {metrics.map((metric, index) => {
          const end = axisPoint(index, total, 82, center);
          return (
            <line
              key={metric.id}
              x1={center}
              y1={center}
              x2={end.x}
              y2={end.y}
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="1"
            />
          );
        })}
        <polygon points={points} fill="rgba(248, 145, 51, 0.28)" stroke="var(--brand)" strokeWidth="3" />
        {metrics.map((metric, index) => {
          const point = axisPoint(index, total, 94, center);
          return (
            <text
              key={metric.id}
              x={point.x}
              y={point.y}
              textAnchor={point.x < center - 8 ? "end" : point.x > center + 8 ? "start" : "middle"}
              dominantBaseline="middle"
              className="fill-white/64 text-[8px] font-bold"
            >
              {metric.label.replace("意识", "").replace("承受力", "")}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export function StudentRiskProfileDashboard({ initialPayload }: { initialPayload: RiskProfilePayload }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  // Start unanswered: the profile is never persisted (GET always returns defaults),
  // so pre-filling middle options biased answers and showed a 6/6 badge + a computed
  // persona before the student interacted. Real clicks populate this.
  const [answers, setAnswers] = useState<RiskProfileAnswer[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set("[data-risk-reveal], [data-risk-score]", { opacity: 1, clearProps: "transform" });
        return;
      }

      gsap.from("[data-risk-reveal]", {
        y: 20,
        opacity: 0,
        duration: 0.64,
        ease: "power3.out",
        stagger: 0.055,
      });
      gsap.from("[data-risk-score]", {
        scale: 0.82,
        opacity: 0,
        duration: 0.72,
        ease: "back.out(1.55)",
      });
    },
    { scope: rootRef },
  );

  const selectedMap = useMemo(
    () => new Map(answers.map((answer) => [answer.questionId, answer.optionId])),
    [answers],
  );
  const completed = answers.filter((answer) => selectedMap.get(answer.questionId)).length;

  async function submitProfile() {
    if (completed === 0) {
      setSubmitState("error");
      setErrorMessage("请至少完成 1 题，再生成你的投资人格。");
      return;
    }
    setSubmitState("loading");
    setErrorMessage("");
    try {
      const response = await fetch("/api/student/risk-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await response.json()) as { payload?: RiskProfilePayload; message?: string };
      if (!response.ok || !data.payload) {
        throw new Error(data.message || "风险画像生成失败，请稍后再试。");
      }
      setPayload(data.payload);
      setAnswers(data.payload.selectedAnswers);
      setSubmitState("success");
    } catch (error) {
      setSubmitState("error");
      setErrorMessage(error instanceof Error ? error.message : "风险画像生成失败，请稍后再试。");
    }
  }

  return (
    <div ref={rootRef} className="space-y-6" data-testid="risk-profile-dashboard">
      {submitState === "success" ? (
      <section
        data-risk-reveal
        data-motion-reveal
        className={cn(
          "overflow-hidden rounded-[2rem] bg-bg-inverse text-white shadow-soft",
          "bg-gradient-to-br",
          bandClass[payload.band],
        )}
      >
        <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-18" />
          <div className="pointer-events-none absolute -left-20 top-4 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
          <div className="pointer-events-none absolute right-10 top-10 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
          <div className="relative z-10 px-6 py-7 md:px-8 md:py-9">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Risk Lab</p>
                <h2 className="mt-3 text-display-lg font-semibold md:text-display-xl">
                  投资人格实验室
                </h2>
                <p className="mt-4 text-body-lg leading-8 text-white/68">
                  通过真实生活情境测一测你的风险承受方式，再把结果映射到当前沙盘资产配置。
                  它不是买卖建议，而是一张帮助你“认识自己”的训练地图。
                </p>
              </div>
              <div data-risk-score data-motion-card className="rounded-[1.75rem] border border-white/12 bg-white/[0.08] p-5 text-right">
                <p className="text-sm font-bold text-white/58">风险人格分</p>
                <p className="mt-2 text-display-xl font-black tabular-nums text-brand-warm">{payload.score}</p>
                <p className="mt-1 text-sm font-semibold text-white/60">{formatTime(payload.generatedAt)}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div data-motion-card className="rounded-[1.8rem] border border-white/10 bg-white/[0.07] p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-slate-950">
                    <Brain className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white/56">你的投资人格</p>
                    <h2 className="text-h1 font-semibold text-white md:text-display-md">{payload.label}</h2>
                  </div>
                </div>
                <p className="mt-5 text-body-lg font-semibold leading-8 text-white">{payload.archetype}</p>
                <p className="mt-3 text-body leading-8 text-white/66">{payload.summary}</p>
                <div className="mt-5 rounded-[1.35rem] border border-brand/20 bg-brand/10 p-4">
                  <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-warm">本次核心概念</p>
                  <p className="mt-2 text-body font-semibold leading-7 text-white/78">{payload.learningConcept}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  { label: "当前净值", value: formatCurrency(payload.current.netWorth), icon: ShieldCheck },
                  { label: "风险 / 纪律", value: `${payload.current.riskScore} / ${payload.current.disciplineScore}`, icon: Compass },
                  { label: "分散评分", value: String(payload.current.diversificationScore), icon: Target },
                  { label: "当前阶段", value: payload.current.stageLabel, icon: Sparkles },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} data-motion-card className="rounded-[1.35rem] border border-white/10 bg-white/[0.07] p-4">
                      <div className="flex items-center gap-2 text-white/56">
                        <Icon className="h-4 w-4 text-brand-warm" />
                        <p className="text-xs font-bold">{item.label}</p>
                      </div>
                      <p className="mt-2 break-words text-h2 font-black tabular-nums text-white">{item.value}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="relative z-10 border-t border-white/10 bg-white/[0.04] px-6 py-7 md:px-8 xl:border-l xl:border-t-0">
            <RadarChart metrics={payload.radar} />
          </aside>
        </div>
      </section>
      ) : (
        <section
          data-risk-reveal
          data-motion-reveal
          className="rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center"
        >
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-warm">Risk Lab</p>
          <h2 className="mt-3 text-2xl font-black text-slate-950">先完成下方 6 个情境测评</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-600">
            还没有生成投资人格。答完下面 6 题后点击「生成我的投资人格」，这里会显示你的人格分、雷达图与配置地图——答案没有对错，请凭真实直觉选择。
          </p>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div data-risk-reveal data-motion-reveal className="panel rounded-[2rem] p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-brand" />
                <h2 className="text-h1 font-semibold text-slate-950">6 个情境选择</h2>
              </div>
              <p className="mt-2 max-w-2xl text-body leading-7 text-slate-600">
                每题只测一个概念，降低认知负荷。答案没有对错，关键是看见自己的决策倾向。
              </p>
            </div>
            <span className="rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white">
              {completed}/{payload.questions.length} 已选择
            </span>
          </div>

          <div className="mt-6 grid gap-4">
            {payload.questions.map((question, questionIndex) => (
              <article
                data-motion-card
                key={question.id}
                className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.06)] md:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-brand">
                      Scenario 0{questionIndex + 1}
                    </p>
                    <h3 className="mt-2 text-h2 font-semibold text-slate-950">{question.title}</h3>
                    <p className="mt-2 text-body leading-7 text-slate-600">{question.scenario}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {question.options.map((option) => {
                    const selected = selectedMap.get(question.id) === option.id;
                    return (
                      <button
                        data-motion-button
                        key={option.id}
                        type="button"
                        onClick={() =>
                          setAnswers((current) =>
                            upsertAnswer(current, { questionId: question.id, optionId: option.id }),
                          )
                        }
                        className={cn(
                          "min-h-32 rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-soft",
                          selected
                            ? "border-brand bg-brand-soft text-slate-950"
                            : "border-slate-200 bg-slate-50 text-slate-700",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-body font-black leading-6">{option.label}</p>
                          {selected ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />
                          ) : (
                            <span className="h-5 w-5 shrink-0 rounded-full border border-slate-300" />
                          )}
                        </div>
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{option.detail}</p>
                        <span className="mt-4 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">
                          {option.concept}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              data-motion-button
              type="button"
              data-testid="risk-profile-submit"
              onClick={submitProfile}
              disabled={submitState === "loading" || completed === 0}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-black text-slate-950 shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              生成我的投资人格
            </button>
            {submitState === "success" && (
              <p role="status" className="inline-flex items-center gap-2 text-sm font-bold text-down">
                <CheckCircle2 className="h-4 w-4" />
                已根据最新答案更新画像
              </p>
            )}
            {submitState === "error" && (
              <p role="alert" className="inline-flex items-center gap-2 text-sm font-bold text-error">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <aside data-risk-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">当前配置 vs 人格区间</h2>
            </div>
            <p className="mt-2 text-body leading-7 text-slate-600">
              建议区间来自你的测评倾向和当前沙盘风险，不代表真实投资建议。
            </p>

            <div className="mt-6 space-y-4">
              {payload.allocation.map((item) => {
                const currentWidth = clamp(item.current, 3, 100);
                const targetWidth = clamp(item.target, 3, 100);
                return (
                  <div key={item.id} data-motion-card className="rounded-[1.45rem] bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-body font-black text-slate-950">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.hint}</p>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-black", allocationTone[item.tone])}>
                        {item.gap > 0 ? "高于" : item.gap < 0 ? "低于" : "贴近"}
                        {Math.abs(item.gap)}%
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div>
                        <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                          <span>当前 {item.current}%</span>
                          <span>目标 {item.target}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-white">
                          <div className="h-full rounded-full bg-slate-950" style={{ width: `${currentWidth}%` }} />
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${targetWidth}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">{payload.coach.title}</h2>
            </div>
            <p className="mt-3 text-body leading-7 text-slate-600">{payload.coach.summary}</p>
            <div className="mt-5 space-y-3">
              {payload.coach.nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-slate-950">
                    {index + 1}
                  </span>
                  <p className="text-body font-semibold leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.35rem] bg-slate-950 p-4 text-white">
              <p className="text-sm font-bold text-white/58">下一站推荐</p>
              <a
                href="/student/wealth"
                className="mt-2 inline-flex items-center gap-2 text-body font-black text-brand-warm transition hover:text-white"
              >
                去财富地图检查资产分层
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-h1 font-semibold text-slate-950">雷达维度解释</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {payload.radar.map((metric) => (
                <div key={metric.id} className="rounded-[1.25rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">{metric.label}</p>
                    <span className="text-h2 font-black tabular-nums text-brand">{metric.value}</span>
                  </div>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{metric.hint}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
