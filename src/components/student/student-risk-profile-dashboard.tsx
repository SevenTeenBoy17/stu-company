"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import Image from "next/image";
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

import { Disclosure } from "@/components/shared/disclosure";
import type { RiskProfileAnswer, RiskProfilePayload } from "@/lib/risk-profile";
import type { BehaviorPersona } from "@/lib/types";
import { clamp, cn, formatCurrency } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type SubmitState = "idle" | "loading" | "success" | "error";
type BehaviorState = "idle" | "loading" | "success" | "error";
const SCENARIO_CARD_BACK_SRC = "/brand/quest-cards/risk-scenario-card-back-v2.png";

type BehaviorPersonaResponse = {
  persona?: BehaviorPersona;
  provider?: string;
  analyzedAt?: string | null;
  cached?: boolean;
  message?: string;
};

// Each risk band gets a DISTINCT cool→warm color temperature so the gradient
// itself encodes the risk level: defensive (cool/sober) → growth (warm/energetic).
// All four stay dark-toned (deep mid stop) so light text on the chip remains AA-legible.
const bandClass: Record<RiskProfilePayload["band"], string> = {
  defensive: "from-slate-950 via-blue-950 to-slate-950",
  steady: "from-slate-950 via-teal-950 to-slate-950",
  balanced: "from-slate-950 via-amber-950 to-slate-950",
  growth: "from-slate-950 via-orange-950 to-slate-950",
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

/** 展示层截断：只保留 lib payload 文案的第一句，长解说交给 Disclosure（不动数据本体）。 */
function firstSentence(text: string) {
  const index = text.indexOf("。");
  return index === -1 ? text : text.slice(0, index + 1);
}

function behaviorProviderLabel(provider?: string, cached?: boolean) {
  if (cached) return "已缓存画像";
  return provider === "fallback" ? "本地教学兜底" : "AI 生成";
}

function upsertAnswer(answers: RiskProfileAnswer[], next: RiskProfileAnswer) {
  const exists = answers.some((answer) => answer.questionId === next.questionId);
  return exists
    ? answers.map((answer) => (answer.questionId === next.questionId ? next : answer))
    : [...answers, next];
}

function ScenarioCardBack({
  index,
  answered,
  revealed,
  onReveal,
}: {
  index: number;
  answered: boolean;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onReveal}
      tabIndex={revealed ? -1 : 0}
      aria-hidden={revealed}
      data-testid={`risk-scenario-card-back-${index + 1}`}
      className={cn(
        "group absolute inset-0 flex h-full min-h-[38rem] w-full flex-col overflow-hidden rounded-[1.8rem] border border-amber-200/70 bg-slate-950 p-5 text-left text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] outline-none transition focus-visible:ring-4 focus-visible:ring-orange-300",
        revealed && "pointer-events-none",
      )}
      style={{ backfaceVisibility: "hidden" }}
    >
      <Image
        src={SCENARIO_CARD_BACK_SRC}
        alt=""
        fill
        sizes="(max-width: 768px) 86vw, 360px"
        priority={index < 2}
        className="pointer-events-none object-cover opacity-95 transition duration-700 group-hover:scale-[1.035]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.12),rgba(2,6,23,0.1)_42%,rgba(2,6,23,0.78)),radial-gradient(circle_at_25%_18%,rgba(248,145,51,0.18),transparent_30%)]" />
      <div className="pointer-events-none absolute inset-4 rounded-[1.45rem] border border-white/14 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.2)]" />
      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="rounded-full bg-white/10 px-3 py-1 text-caption font-bold uppercase tracking-[0.2em] text-orange-200">
          Scenario {String(index + 1).padStart(2, "0")}
        </span>
        {answered ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/18 px-3 py-1 text-caption font-bold text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            已选择
          </span>
        ) : (
          <span className="rounded-full bg-white/10 px-3 py-1 text-caption font-bold text-white/70">未翻开</span>
        )}
      </div>

      <div className="relative z-10 mt-8 flex flex-1 items-center justify-center">
        <div
          data-testid="risk-scenario-card-back-badge"
          className="rounded-full border border-amber-200/30 bg-slate-950/82 px-5 py-2.5 text-body-sm font-bold tracking-[0.12em] text-amber-100 shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-md"
        >
          探索情境
        </div>
      </div>

      <div className="relative z-10 flex justify-center rounded-[1.35rem] border border-white/12 bg-slate-950/55 p-4 shadow-[0_18px_42px_rgba(0,0,0,0.22)] backdrop-blur-md">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-body-sm font-bold text-slate-950 transition group-hover:translate-x-1">
          翻开卡片
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
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
          <p className="text-h3 text-white">6 维风险雷达</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-caption font-semibold text-white/70">教学画像</span>
      </div>
      {/* 六维数据已在下方「雷达维度解释」以文本完整暴露，此图为纯装饰 → aria-hidden，
          避免屏幕阅读器读到无名 SVG（itest5 R3 P3）。 */}
      <svg viewBox="0 0 192 192" aria-hidden="true" className="mt-4 h-56 w-full max-w-[280px] mx-auto overflow-visible">
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

export function StudentRiskProfileDashboard({
  initialPayload,
  initialAnswersPersisted = false,
}: {
  initialPayload: RiskProfilePayload;
  initialAnswersPersisted?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState(initialPayload);
  const [answers, setAnswers] = useState<RiskProfileAnswer[]>(
    initialAnswersPersisted ? initialPayload.selectedAnswers : [],
  );
  const [revealedQuestionIds, setRevealedQuestionIds] = useState<Set<string>>(() => new Set());
  const [submitState, setSubmitState] = useState<SubmitState>(initialAnswersPersisted ? "success" : "idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [behaviorState, setBehaviorState] = useState<BehaviorState>("idle");
  const [behaviorError, setBehaviorError] = useState("");
  const [behaviorPersona, setBehaviorPersona] = useState<BehaviorPersona | null>(null);
  const [behaviorMeta, setBehaviorMeta] = useState<{
    provider?: string;
    analyzedAt?: string | null;
    cached?: boolean;
  } | null>(null);
  const [isBehaviorPending, startBehaviorTransition] = useTransition();
  const [behaviorSlow, setBehaviorSlow] = useState(false);

  const isLoading = behaviorState === "loading" || isBehaviorPending;

  useEffect(() => {
    if (!isLoading) {
      setBehaviorSlow(false);
      return;
    }
    const timer = setTimeout(() => setBehaviorSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoading]);

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
  const validQuestionIds = useMemo(() => new Set(payload.questions.map((q) => q.id)), [payload.questions]);
  const completed = answers.filter((answer) => validQuestionIds.has(answer.questionId)).length;
  const revealedCount = revealedQuestionIds.size;

  function revealQuestion(questionId: string) {
    setRevealedQuestionIds((current) => {
      if (current.has(questionId)) return current;
      const next = new Set(current);
      next.add(questionId);
      return next;
    });
  }

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

  function submitBehaviorPersona() {
    if (behaviorState === "loading" || isBehaviorPending) return;

    startBehaviorTransition(async () => {
      setBehaviorState("loading");
      setBehaviorError("");
      try {
        const response = await fetch("/api/student/risk-profile/behavior", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = (await response.json().catch(() => ({}))) as BehaviorPersonaResponse;
        if (!response.ok || !data.persona) {
          throw new Error(data.message || "行为复评暂时不可用，请稍后再试。");
        }
        setBehaviorPersona(data.persona);
        setBehaviorMeta({
          provider: data.provider,
          analyzedAt: data.analyzedAt ?? null,
          cached: Boolean(data.cached),
        });
        setBehaviorState("success");
      } catch (error) {
        setBehaviorState("error");
        setBehaviorError(error instanceof Error ? error.message : "行为复评暂时不可用，请稍后再试。");
      }
    });
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
                <p className="bz-eyebrow-inverse">Risk Lab</p>
                <h2 className="mt-3 text-display-lg font-semibold md:text-display-xl">
                  投资人格实验室
                </h2>
                <p className="mt-4 text-body-lg leading-8 text-white/68">
                  通过真实生活情境测一测你的风险承受方式，再把结果映射到当前沙盘资产配置。
                  它不是买卖建议，而是一张帮助你“认识自己”的训练地图。
                </p>
              </div>
              <div data-risk-score data-motion-card className="rounded-[1.75rem] border border-white/12 bg-white/[0.08] p-5 text-right">
                <span className="bz-hero-stat items-end">
                  <span className="bz-eyebrow bz-brand-text-on-light">风险人格分</span>
                  <span className="text-hero-num tabular-nums bz-brand-text-on-light">{payload.score}</span>
                </span>
                <p className="mt-2 text-body-sm font-semibold text-white/60">{formatTime(payload.generatedAt)}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div data-motion-card className="rounded-[1.8rem] border border-white/10 bg-white/[0.07] p-5 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-slate-950">
                    <Brain className="h-5 w-5" />
                  </span>
                  <p className="bz-eyebrow-inverse normal-case tracking-normal">你的投资人格</p>
                </div>
                {/* 图形化：人格 label 用大字排版承担视觉主体，archetype 作为副标题一行 */}
                <h2 className="mt-4 text-display-md font-semibold leading-tight text-white md:text-display-xl">
                  {payload.label}
                </h2>
                <p className="mt-3 text-body-lg font-semibold leading-8 text-brand-warm">{payload.archetype}</p>
                <p className="mt-3 text-body leading-8 text-white/66">{firstSentence(payload.summary)}</p>
                <Disclosure
                  summary="本次核心概念"
                  className="mt-5 rounded-[1.35rem] border border-brand/20 bg-brand/10 px-3 py-1"
                  summaryClassName="text-white hover:text-brand-warm"
                  panelClassName="text-white/78 font-semibold leading-7"
                >
                  {payload.learningConcept}
                </Disclosure>
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
                        <p className="text-caption font-semibold">{item.label}</p>
                      </div>
                      <p className="mt-2 break-words text-h2 tabular-nums text-white">{item.value}</p>
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
          <p className="bz-eyebrow">Risk Lab</p>
          <h2 className="mt-3 text-h1 text-fg-strong">先完成下方 6 个情境测评</h2>
          <p className="mx-auto mt-3 max-w-xl text-body-sm leading-7 text-fg-muted">
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
                <h2 className="text-h1 text-fg-strong">6 个情境选择</h2>
              </div>
              <p className="mt-2 max-w-2xl text-body leading-7 text-fg-muted">
                每题只测一个概念，降低认知负荷。答案没有对错，关键是看见自己的决策倾向。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span data-testid="risk-reveal-counter" className="rounded-full bg-brand-soft px-4 py-2 text-body-sm font-semibold text-brand-ink">
                {revealedCount}/{payload.questions.length} 已翻开
              </span>
              <span data-testid="risk-counter" className="rounded-full bg-slate-950 px-4 py-2 text-body-sm font-semibold text-white">
                {completed}/{payload.questions.length} 已选择
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            {payload.questions.map((question, questionIndex) => {
              const revealed = revealedQuestionIds.has(question.id);
              const selectedOptionId = selectedMap.get(question.id);

              return (
                <article
                  data-motion-card
                  key={question.id}
                  data-testid={`risk-scenario-flip-card-${questionIndex + 1}`}
                  className="relative min-h-[38rem]"
                  style={{ perspective: "1400px" }}
                >
                  <div
                    className="relative h-full min-h-[38rem] transition-transform duration-500 [transform-style:preserve-3d]"
                    style={{ transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
                  >
                    <ScenarioCardBack
                      index={questionIndex}
                      answered={Boolean(selectedOptionId)}
                      revealed={revealed}
                      onReveal={() => revealQuestion(question.id)}
                    />

                    <div
                      aria-hidden={!revealed}
                      className="absolute inset-0 flex h-full min-h-[38rem] flex-col overflow-y-auto rounded-[1.8rem] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] md:p-5"
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="bz-eyebrow bz-brand-text-on-light">
                            Scenario 0{questionIndex + 1}
                          </p>
                          <h3 className="mt-2 text-h2 text-fg-strong">{question.title}</h3>
                          <p className="mt-2 text-body leading-7 text-fg-muted">{question.scenario}</p>
                        </div>
                        {selectedOptionId ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-down-soft px-3 py-1 text-caption font-bold text-[var(--down-700)]">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            已选择
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-caption font-bold text-slate-600">待选择</span>
                        )}
                      </div>

                      <div className="mt-4 grid flex-1 gap-3">
                        {question.options.map((option) => {
                          const selected = selectedOptionId === option.id;
                          return (
                            <button
                              data-motion-button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              tabIndex={revealed ? 0 : -1}
                              disabled={!revealed}
                              onClick={() =>
                                setAnswers((current) =>
                                  upsertAnswer(current, { questionId: question.id, optionId: option.id }),
                                )
                              }
                              className={cn(
                                "rounded-[1.2rem] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-soft disabled:pointer-events-none",
                                selected
                                  ? "border-brand bg-brand-soft text-slate-950"
                                  : "border-slate-200 bg-slate-50 text-slate-700",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-body font-semibold leading-6">{option.label}</p>
                                {selected ? (
                                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" />
                                ) : (
                                  <span className="h-5 w-5 shrink-0 rounded-full border border-slate-300" />
                                )}
                              </div>
                              <p className="mt-2 text-body-sm leading-6 text-slate-600">{option.detail}</p>
                              <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-caption font-semibold text-slate-600">
                                {option.concept}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              data-motion-button
              type="button"
              data-testid="risk-profile-submit"
              onClick={submitProfile}
              disabled={submitState === "loading" || completed === 0}
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-body-sm font-semibold text-slate-950 shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitState === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              生成我的投资人格
            </button>
            {submitState === "success" && (
              <p role="status" className="inline-flex items-center gap-2 text-body-sm font-semibold text-down">
                <CheckCircle2 className="h-4 w-4" />
                已根据最新答案更新画像
              </p>
            )}
            {submitState === "error" && (
              <p role="alert" className="inline-flex items-center gap-2 text-body-sm font-semibold text-error">
                <AlertCircle className="h-4 w-4" />
                {errorMessage}
              </p>
            )}
          </div>
        </div>

        <aside data-risk-reveal data-motion-reveal className="space-y-6">
          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <Brain className="h-5 w-5 text-brand" />
                  <h2 className="text-h1 text-fg-strong">用真实行为复评</h2>
                </div>
                <p className="mt-2 text-body leading-7 text-fg-muted">
                  结合你的回合记录、仓位纪律、学习进度和风险信号，生成一张更贴近真实操作的行为画像。
                </p>
              </div>
              {behaviorState === "success" && (
                <span className="bz-brand-chip rounded-full px-3 py-1 text-caption font-semibold">
                  {behaviorProviderLabel(behaviorMeta?.provider, behaviorMeta?.cached)}
                </span>
              )}
            </div>

            <button
              data-motion-button
              type="button"
              data-testid="behavior-persona-submit"
              onClick={submitBehaviorPersona}
              disabled={behaviorState === "loading" || isBehaviorPending}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-body-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              {isLoading ? "正在复评行为画像..." : "用我的真实行为复评"}
            </button>

            {isLoading && behaviorSlow && (
              <p
                role="status"
                aria-live="polite"
                data-testid="behavior-slow-hint"
                className="mt-3 text-center text-body-sm font-semibold text-slate-500"
              >
                AI 正在分析你的真实操作，稍等几秒…
              </p>
            )}

            {behaviorState === "idle" && (
              <div className="mt-4 rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-body-sm font-semibold leading-6 text-slate-600">
                  建议完成几次交易、储蓄或学习任务后再复评，结果会比单次问卷更接近你的真实决策节奏。
                </p>
              </div>
            )}

            {behaviorState === "error" && (
              <p role="alert" className="mt-4 flex gap-2 rounded-[1.35rem] border border-error/20 bg-error-soft p-4 text-body-sm font-semibold leading-6 text-error">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {behaviorError || "行为复评暂时不可用，请稍后再试。"}
              </p>
            )}

            {behaviorPersona && behaviorState === "success" && (
              <div
                data-testid="behavior-persona-card"
                className="mt-5 space-y-4 rounded-[1.55rem] border border-slate-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="bz-eyebrow bz-brand-text-on-light">Behavior Persona</p>
                    <h3 className="mt-2 text-h2 text-fg-strong">{behaviorPersona.label}</h3>
                    <p className="mt-1 text-body-sm font-semibold text-slate-500">{behaviorPersona.archetype}</p>
                  </div>
                  <span className="rounded-full bg-slate-950 px-3 py-1 text-caption font-semibold text-white">
                    {behaviorPersona.confidence === "high"
                      ? "高置信"
                      : behaviorPersona.confidence === "medium"
                        ? "中置信"
                        : "低置信"}
                  </span>
                </div>
                <p className="text-body font-semibold leading-7 text-fg-strong">
                  {firstSentence(behaviorPersona.summary)}
                </p>

                {/* Intent-vs-behavior comparison block (UX-01) */}
                <div
                  data-testid="intent-vs-behavior"
                  className="rounded-[1.15rem] border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="bz-eyebrow text-fg-muted">问卷 vs 行为</p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    <p className="text-body-sm font-semibold leading-6 text-slate-700">
                      <span className="font-bold text-fg-strong">问卷倾向：</span>
                      {payload.label}（你说的偏好）
                    </p>
                    <p className="text-body-sm font-semibold leading-6 text-slate-700">
                      <span className="font-bold text-fg-strong">真实行为：</span>
                      {behaviorPersona.label}（你实际的操作）
                    </p>
                  </div>
                  {behaviorPersona.band !== payload.band ? (
                    <p
                      data-testid="intent-behavior-diff"
                      className="mt-2.5 rounded-[0.85rem] bg-warning/10 px-3 py-2 text-body-sm font-semibold leading-6 text-slate-800"
                    >
                      口头偏好和真实操作出现了差距 —— 这正是最值得复盘的地方：你说自己偏
                      <span className="font-bold">{payload.label}</span>，但真实操作更接近
                      <span className="font-bold">{behaviorPersona.label}</span>。
                    </p>
                  ) : (
                    <p
                      data-testid="intent-behavior-same"
                      className="mt-2.5 rounded-[0.85rem] bg-down-soft px-3 py-2 text-body-sm font-semibold leading-6 text-[var(--down-700)]"
                    >
                      你的真实操作和问卷倾向一致。
                    </p>
                  )}
                </div>

                {/* 信息收敛：行为证据 / 下一步训练 默认收起，键盘可达（Disclosure） */}
                <Disclosure
                  summary="查看行为证据与下一步训练"
                  className="rounded-[1.15rem] border border-slate-200 px-2"
                >
                  <div className="grid gap-3">
                    <div className="rounded-[1.15rem] bg-slate-50 p-3">
                      <p className="bz-eyebrow text-fg-muted">行为证据</p>
                      <ul className="mt-2 space-y-2">
                        {behaviorPersona.evidence.map((item) => (
                          <li key={item} className="flex gap-2 text-body-sm font-semibold leading-6 text-slate-700">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[1.15rem] bg-brand-soft p-3">
                      <p className="bz-eyebrow bz-brand-text-on-light">下一步训练</p>
                      <ol className="mt-2 space-y-2">
                        {behaviorPersona.nextSteps.map((step, index) => (
                          <li key={step} className="flex gap-2 text-body-sm font-semibold leading-6 text-slate-800">
                            <span>{index + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </Disclosure>
                {behaviorMeta?.analyzedAt && (
                  <p className="text-caption font-semibold text-slate-500">复评时间：{formatTime(behaviorMeta.analyzedAt)}</p>
                )}
              </div>
            )}
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <Target className="h-5 w-5 text-brand" />
              <h2 className="text-h1 text-fg-strong">当前配置 vs 人格区间</h2>
            </div>
            <p className="mt-2 text-body leading-7 text-fg-muted">
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
                        <p className="text-body font-semibold text-fg-strong">{item.label}</p>
                        <p className="mt-1 text-body-sm font-semibold leading-6 text-slate-600">{item.hint}</p>
                      </div>
                      <span className={cn("rounded-full px-3 py-1 text-caption font-semibold", allocationTone[item.tone])}>
                        {item.gap > 0 ? "高于" : item.gap < 0 ? "低于" : "贴近"}
                        {Math.abs(item.gap)}%
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div>
                        <div className="mb-1 flex justify-between text-caption font-semibold text-slate-600">
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
              <h2 className="text-h1 text-fg-strong">{payload.coach.title}</h2>
            </div>
            <p className="mt-3 text-body leading-7 text-fg-muted">{payload.coach.summary}</p>
            <div className="mt-5 space-y-3">
              {payload.coach.nextSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-[1.35rem] border border-slate-200 bg-white p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-body-sm font-semibold text-slate-950">
                    {index + 1}
                  </span>
                  <p className="text-body font-semibold leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[1.35rem] bg-slate-950 p-4 text-white">
              <p className="bz-eyebrow-inverse normal-case tracking-normal text-white/58">下一站推荐</p>
              <a
                href="/student/wealth"
                className="mt-2 inline-flex items-center gap-2 text-body font-semibold text-brand-warm transition hover:text-white"
              >
                去财富地图检查资产分层
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 md:p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-brand" />
              <h2 className="text-h1 text-fg-strong">雷达维度解释</h2>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {payload.radar.map((metric) => (
                <div key={metric.id} className="rounded-[1.25rem] bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-body-sm font-semibold text-fg-strong">{metric.label}</p>
                    <span className="bz-brand-text-on-light text-h2 tabular-nums">{metric.value}</span>
                  </div>
                  <p className="mt-2 text-caption font-semibold leading-5 text-slate-600">{metric.hint}</p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
