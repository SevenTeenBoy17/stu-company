"use client";

import {
  Bot,
  ChevronRight,
  Clock3,
  Flame,
  Radar,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { MoneyText } from "@/components/shared/money-text";
import { dispatchAssistantOpen } from "@/lib/assistant-config";
import type { HistoryReviewPayload, HistoryRoundSummary } from "@/lib/types";
import { cn, formatCurrency, formatDateLabel, getMarketMoveClasses, stripMarkdown } from "@/lib/utils";

type StudentHistoryReviewDashboardProps = {
  initialPayload: HistoryReviewPayload;
};

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;

function chartPoint(index: number, total: number, value: number, min: number, max: number) {
  const x = total <= 1 ? 0 : (index / (total - 1)) * CHART_WIDTH;
  const safeRange = max - min || 1;
  const normalized = (value - min) / safeRange;
  const y = CHART_HEIGHT - normalized * CHART_HEIGHT;

  return { x, y };
}

function buildLinePath(values: number[]) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);

  return values
    .map((value, index) => {
      const point = chartPoint(index, values.length, value, min, max);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[]) {
  if (values.length === 0) return "";
  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const linePath = values
    .map((value, index) => {
      const point = chartPoint(index, values.length, value, min, max);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");

  return `${linePath} L ${CHART_WIDTH} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;
}

function ChartShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.8rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <p className="bz-eyebrow">{eyebrow}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-h2 text-fg-strong">{title}</h3>
          <p className="mt-2 max-w-2xl text-body-sm leading-7 text-fg-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: ReactNode;
}) {
  return (
    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
      <p className="text-body-sm text-fg-muted">{label}</p>
      <p className="mt-3 text-h2 tabular-nums text-fg-strong">{value}</p>
      <p className="mt-3 text-body-sm leading-6 text-fg-muted">{hint}</p>
    </div>
  );
}

function HighlightMetricValue({ value }: { value: string }) {
  return value.includes("¥") ? <MoneyText tone="dark">{value}</MoneyText> : value;
}

function NetWorthChart({ timeline }: { timeline: HistoryRoundSummary[] }) {
  const values = timeline.map((item) => item.netWorth);
  const linePath = buildLinePath(values);
  const areaPath = buildAreaPath(values);

  return (
    <div data-motion-viz className="overflow-hidden rounded-[1.5rem] bg-[#0f1729] p-4 text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-body-sm font-semibold">净值趋势</p>
          <p className="mt-1 text-caption text-white/70">
            先看账户走势，再看单笔输赢，复盘会更稳定。
          </p>
        </div>
        <TrendingUp className="h-4 w-4 text-[#ffb36d]" />
      </div>
      <div className="mt-4">
        <svg aria-hidden="true" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-56 w-full">
          <defs>
            <linearGradient id="history-net-worth-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f08a38" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#f08a38" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT * ratio}
              y2={CHART_HEIGHT * ratio}
              stroke="rgba(255,255,255,0.08)"
              strokeDasharray="4 8"
            />
          ))}
          <path d={areaPath} fill="url(#history-net-worth-fill)" />
          <path
            d={linePath}
            data-motion-viz-path
            fill="none"
            stroke="#ffd1a3"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {values.map((value, index) => {
            const point = chartPoint(index, values.length, value, Math.min(...values), Math.max(...values));
            return <circle key={`${timeline[index].round}-${value}`} data-motion-viz-point cx={point.x} cy={point.y} r="5" fill="#0f1729" stroke="#ffd1a3" strokeWidth="2.5" />;
          })}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-caption text-white/56 md:grid-cols-6">
        {timeline.map((item) => (
          <div key={`axis-${item.round}`} className="rounded-full bg-white/6 px-3 py-2 text-center">
            R{item.round}
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskDisciplineChart({ timeline }: { timeline: HistoryRoundSummary[] }) {
  const riskValues = timeline.map((item) => item.riskScore);
  const disciplineValues = timeline.map((item) => item.disciplineScore);
  const min = Math.min(...riskValues, ...disciplineValues);
  const max = Math.max(...riskValues, ...disciplineValues);

  const riskPath = riskValues
    .map((value, index) => {
      const point = chartPoint(index, riskValues.length, value, min, max);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");

  const disciplinePath = disciplineValues
    .map((value, index) => {
      const point = chartPoint(index, disciplineValues.length, value, min, max);
      return `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div data-motion-viz className="overflow-hidden rounded-[1.5rem] bg-slate-950/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-body-sm font-semibold text-fg-strong">风险分 / 纪律分</p>
          <p className="mt-1 text-caption text-fg-muted">
            两条线一起看，更容易区分&ldquo;赚得快&rdquo;和&ldquo;留得住&rdquo;之间的差别。
          </p>
        </div>
        <ShieldAlert className="h-4 w-4 text-[#f08a38]" />
      </div>
      <div className="mt-4">
        <svg aria-hidden="true" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-56 w-full">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => (
            <line
              key={ratio}
              x1="0"
              x2={CHART_WIDTH}
              y1={CHART_HEIGHT * ratio}
              y2={CHART_HEIGHT * ratio}
              stroke="rgba(15,23,42,0.08)"
              strokeDasharray="4 8"
            />
          ))}
          <path data-motion-viz-path d={riskPath} fill="none" stroke="#f08a38" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path
            data-motion-viz-path
            d={disciplinePath}
            fill="none"
            stroke="#6f7ef7"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#f08a38]/10 px-3 py-2 text-caption font-semibold text-[#944314]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f08a38]" />
          风险分
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#6f7ef7]/10 px-3 py-2 text-caption font-semibold text-[#4657d4]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#6f7ef7]" />
          纪律分
        </span>
      </div>
    </div>
  );
}

function CapitalStructureChart({ timeline }: { timeline: HistoryRoundSummary[] }) {
  const maxValue = Math.max(...timeline.map((item) => Math.max(item.cash, item.savings, item.debt || 0, 1)));

  return (
    <div data-motion-viz className="rounded-[1.5rem] bg-slate-950/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-body-sm font-semibold text-fg-strong">现金 / 储蓄 / 债务结构</p>
          <p className="mt-1 text-caption text-fg-muted">
            先看资金结构有没有呼吸感，再决定下一轮要不要扩张。
          </p>
        </div>
        <Wallet className="h-4 w-4 text-[#f08a38]" />
      </div>
      <div className="mt-5 space-y-4">
        {timeline.map((item) => (
          <div key={`capital-${item.round}`}>
            <div className="mb-2 flex items-center justify-between gap-3 text-caption text-fg-muted">
              <span>R{item.round}</span>
              <span>{item.theme}</span>
            </div>
            <div className="grid gap-2">
              {[
                { label: "现金", value: item.cash, color: "bg-[#111827]" },
                { label: "储蓄", value: item.savings, color: "bg-[#7dd3a6]" },
                { label: "债务", value: item.debt, color: "bg-[#f08a38]" },
              ].map((row) => (
                <div key={`${item.round}-${row.label}`} className="flex items-center gap-3">
                  <div className="w-12 shrink-0 text-caption text-fg-muted">{row.label}</div>
                  <div className="h-2.5 flex-1 rounded-full bg-white">
                    <div
                      data-motion-viz-bar
                      data-motion-origin="left center"
                      className={cn("h-full rounded-full", row.color)}
                      style={{ width: `${Math.max(4, (row.value / maxValue) * 100)}%` }}
                    />
                  </div>
                  <div className="min-w-[6rem] shrink-0 text-right text-caption text-fg-muted">
                    <MoneyText>{formatCurrency(row.value)}</MoneyText>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function highlightToneClasses(tone: HistoryReviewPayload["highlights"][number]["tone"]) {
  if (tone === "positive") {
    return {
      surface: "border-[#d43c33]/18 bg-[#d43c33]/10",
      badge: "bg-[#d43c33]/14 text-[#ffb7af]",
    };
  }

  if (tone === "warning") {
    return {
      surface: "border-amber-300/15 bg-amber-300/8",
      badge: "bg-amber-300/15 text-amber-200",
    };
  }

  return {
    surface: "border-white/10 bg-white/[0.05]",
    badge: "bg-white/10 text-white/72",
  };
}

function eventSignalClasses(signal: string) {
  if (signal === "利好") {
    return "bg-[#fff1f0] text-[#bf2419]";
  }
  if (signal === "利空") {
    return "bg-[#eefbf3] text-[#0f7038]";
  }
  return "bg-slate-100 text-slate-600";
}

function learningSignalClasses(tone: HistoryReviewPayload["learningSignals"][number]["tone"]) {
  if (tone === "protect") {
    return "border-[#0f9d58]/15 bg-[#eefbf3] text-[#0f7038]";
  }

  if (tone === "review") {
    return "border-[#6f7ef7]/15 bg-[#f0f2ff] text-[#4657d4]";
  }

  if (tone === "build") {
    // contrast fix: was text-[#b96621] (~3.88:1 on #fff4e9) → now text-[#944314] (~6.5:1)
    return "border-[#f08a38]/18 bg-[#fff4e9] text-[#944314]";
  }

  return "border-slate-200 bg-white text-slate-700";
}

export function StudentHistoryReviewDashboard({
  initialPayload,
}: StudentHistoryReviewDashboardProps) {
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLatest() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/student/history-review", {
          cache: "no-store",
        });
        const nextPayload = (await response.json()) as HistoryReviewPayload & { error?: string };

        if (!response.ok || nextPayload.error) {
          throw new Error(nextPayload.error ?? "历史复盘刷新失败。");
        }

        if (!cancelled) {
          setPayload(nextPayload);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "历史复盘刷新失败。");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 pb-20 sm:pb-24">
      {/* Hero KPI row — light surface, use text-h2 for secondary metrics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="累计回合"
          value={`${payload.metrics.roundsCompleted} / 12`}
          hint={`当前处在${payload.metrics.stageLabel}，适合先看曲线，再回头看动作。`}
        />
        {/* Hero number: 当前净值 is the key metric for this screen */}
        <div className="min-w-0 rounded-[1.7rem] border border-slate-200/80 bg-white/88 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)]">
          <p className="text-body-sm text-fg-muted">当前净值</p>
          {/* 该卡处在 xl 四列窄格，长币种值用可收缩字号 + truncate，避免溢出叠到相邻卡。 */}
          <p className="mt-3 truncate text-[1.75rem] font-extrabold leading-tight tracking-tight tabular-nums text-fg-strong">
            <MoneyText>{formatCurrency(payload.metrics.currentNetWorth)}</MoneyText>
          </p>
          <p className="mt-3 text-body-sm leading-6 text-fg-muted">
            历史峰值 <MoneyText>{formatCurrency(payload.metrics.peakNetWorth)}</MoneyText>
          </p>
        </div>
        <MetricCard
          label="最大回撤"
          value={`${payload.metrics.maxDrawdown.toFixed(1)}%`}
          hint="这项越稳，说明你越能把收益留在账户里。"
        />
        <MetricCard
          label="纪律趋势"
          value={`${payload.metrics.disciplineTrend >= 0 ? "+" : ""}${payload.metrics.disciplineTrend}`}
          hint={`风险区间 ${payload.metrics.riskRange[0]} - ${payload.metrics.riskRange[1]}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
        <div className="space-y-6">
          <section
            data-motion-reveal
            className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/88 shadow-[0_28px_70px_rgba(15,23,42,0.08)]"
          >
            <div>
              {/* Dark hero panel */}
              <div className="relative overflow-hidden bg-[#0e1629] px-5 py-5 text-white sm:px-6 sm:py-6 lg:px-7 lg:py-7">
                <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
                <div className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full bg-[#f08a38]/18 blur-3xl sm:-left-20 sm:top-12 sm:h-48 sm:w-48" />
                <div className="pointer-events-none absolute bottom-0 right-0 h-36 w-36 rounded-full bg-[#6f7ef7]/16 blur-3xl sm:h-56 sm:w-56" />

                <div className="relative z-10">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="bz-eyebrow-inverse">History Review</p>
                      <h2 className="mt-3 text-h1 md:text-display-sm">
                        历史操作下的趋势复盘面板
                      </h2>
                      <p className="mt-3 max-w-2xl text-body leading-7 text-white/72">
                        把每一回合的净值、风险、纪律和资金结构放在同一条线上看，更容易识别&ldquo;做对了什么&rdquo;。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-caption font-semibold text-white/78">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDateLabel(new Date(payload.generatedAt))}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {payload.highlights.map((highlight) => {
                      const tone = highlightToneClasses(highlight.tone);
                      return (
                        <div
                          key={highlight.id}
                          className={cn(
                            "flex h-full flex-col rounded-[1.4rem] border px-4 py-4 backdrop-blur",
                            tone.surface,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-caption font-semibold uppercase tracking-[0.16em] text-white/70">
                              R{highlight.round}
                            </p>
                            <span
                              className={cn(
                                "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-caption font-semibold",
                                tone.badge,
                              )}
                            >
                              {highlight.metricLabel}
                            </span>
                          </div>
                          <p className="mt-2.5 text-body-sm font-semibold leading-snug text-white">
                            {highlight.title}
                          </p>
                          <p className="mt-2 line-clamp-3 text-caption leading-6 text-white/64">
                            {highlight.detail}
                          </p>
                          <p className="mt-auto pt-3 text-h3 font-semibold text-white">
                            <HighlightMetricValue value={highlight.metricValue} />
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Light content area */}
              <div className="bg-white/92 px-5 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
                <p className="bz-eyebrow">历史操作速写</p>
                <h3 className="mt-3 text-h2 text-fg-strong">先看节奏，再拆动作</h3>
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  {[
                    { label: "买入次数", value: `${payload.metrics.buyCount}`, hint: "主动加仓" },
                    { label: "卖出次数", value: `${payload.metrics.sellCount}`, hint: "兑现或回收" },
                    { label: "现金管理", value: `${payload.metrics.cashActions}`, hint: "储蓄 / 贷款 / 偿还" },
                    { label: "扩张动作", value: `${payload.metrics.expansionActions}`, hint: "房产 / 创业" },
                    { label: "学习动作", value: `${payload.metrics.learningActions}`, hint: "观察 / 实验 / 保护" },
                    { label: "复盘沉淀", value: `${payload.metrics.reviewActions}`, hint: "计划 / 奖励 / 自选" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[1.4rem] bg-slate-950/[0.03] px-4 py-4">
                      <p className="text-body-sm text-fg-muted">{item.label}</p>
                      <p className="mt-2 text-h2 tabular-nums text-fg-strong">{item.value}</p>
                      <p className="mt-2 text-caption text-fg-muted">{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-[1.5rem] bg-[#fff4e9] p-4">
                  <div className="flex items-start gap-3">
                    <Radar className="mt-0.5 h-4 w-4 shrink-0 text-[#f08a38]" />
                    <p className="text-body-sm leading-7 text-fg-default">
                      当前历史页默认按&ldquo;回合趋势优先&rdquo;组织。建议先观察净值、风险与纪律的转折，再进入每个回合的动作细节。
                    </p>
                  </div>
                </div>
                <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-semibold text-fg-strong">学习信号已进入复盘</p>
                      <p className="mt-1 text-caption leading-6 text-fg-muted">
                        机会观察、基金实验、目标账户和保护伞不会直接改变收益，但会影响你的长期决策质量。
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-950/[0.04] px-3 py-1.5 text-caption font-semibold text-fg-muted">
                      {payload.learningSignals.length > 0 ? `${payload.learningSignals.length} 类信号` : "待点亮"}
                    </span>
                  </div>
                  {payload.learningSignals.length > 0 ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {payload.learningSignals.map((signal) => (
                        <div
                          key={signal.id}
                          className={cn(
                            "rounded-[1.2rem] border px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.04)]",
                            learningSignalClasses(signal.tone),
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            {/* contrast fix: label inherits safe color from learningSignalClasses (≥4.5:1) */}
                            <p className="text-body-sm font-semibold">{signal.label}</p>
                            <span className="rounded-full bg-white/70 px-2.5 py-1 text-caption font-semibold">
                              ×{signal.count}
                            </span>
                          </div>
                          {/* contrast fix: was opacity-80 (compounding ~2.88:1) → explicit text-fg-muted */}
                          <p className="mt-2 text-caption leading-6 text-fg-muted">{signal.detail}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-body-sm leading-7 text-fg-muted">
                      还没有明显学习信号。可以先去&ldquo;机会训练&rdquo;写一张观察单，或在&ldquo;我的财富&rdquo;提交一次持有复盘。
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <ChartShell
            eyebrow="Trend Board"
            title="回合表现可视化"
            description="把净值路径、风控评分和资金结构放在一起，能更快看出哪些动作在放大波动，哪些动作在帮你稳住节奏。"
          >
            <div className="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
              <NetWorthChart timeline={payload.timeline} />
              <RiskDisciplineChart timeline={payload.timeline} />
            </div>
            <div className="mt-4">
              <CapitalStructureChart timeline={payload.timeline} />
            </div>
          </ChartShell>

          <ChartShell
            eyebrow="Timeline"
            title="按回合展开的历史操作"
            description="每个回合都保留了主题、事件和动作分组。先看摘要，再展开动作，会比从流水里硬找问题更高效。"
          >
            <div className="space-y-4">
              {payload.actionGroups.map((group, index) => (
                <details
                  key={`round-group-${group.round}`}
                  open={index < 2}
                  className="group rounded-[1.6rem] border border-slate-200 bg-slate-950/[0.02] px-5 py-4"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brand-subtle px-2.5 py-1 text-caption font-semibold text-brand-ink">
                          R{group.round}
                        </span>
                        <span className="rounded-full bg-white px-2.5 py-1 text-caption text-fg-muted">
                          {group.theme}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-caption font-semibold",
                            eventSignalClasses(group.eventSignal),
                          )}
                        >
                          {group.eventSignal}
                        </span>
                      </div>
                      <h4 className="mt-3 text-h3 text-fg-strong">{group.headline}</h4>
                      <p className="mt-2 text-body-sm leading-7 text-fg-muted">{group.summary}</p>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-fg-muted transition-transform group-open:rotate-90" />
                  </summary>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-[1.3rem] bg-white px-4 py-3 text-body-sm text-fg-muted shadow-sm">
                      事件：{group.eventTitle}
                    </div>
                    {group.items.length > 0 ? (
                      group.items.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-950/[0.04] px-2.5 py-1 text-caption font-semibold text-fg-muted">
                                  {item.type}
                                </span>
                                <span className="text-caption text-fg-muted">
                                  {formatDateLabel(new Date(item.timestamp))}
                                </span>
                              </div>
                              <p className="mt-2 line-clamp-2 break-all text-body font-semibold text-fg-strong">{item.label}</p>
                              <p className="mt-2 text-body-sm leading-7 text-fg-muted">{item.impact}</p>
                            </div>
                            <div className="text-right">
                              <p
                                className={cn(
                                  "text-body-sm font-semibold",
                                  item.amount > 0
                                    ? getMarketMoveClasses(item.amount).text
                                    : item.amount < 0
                                      ? getMarketMoveClasses(item.amount).text
                                      : "text-fg-muted",
                                )}
                              >
                                {item.amount === 0 ? "节奏推进" : <MoneyText>{formatCurrency(item.amount)}</MoneyText>}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  dispatchAssistantOpen({
                                    prompt: `请结合我的历史复盘页，继续解释这一步"${item.label}"为什么重要，以及我下一回合应该怎么验证。`,
                                    actionLogId: item.id,
                                    autoSend: true,
                                  })
                                }
                                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-3 text-caption font-semibold text-fg-default transition-colors hover:border-brand hover:text-brand-ink"
                              >
                                <Bot className="h-3.5 w-3.5" />
                                让 AI 继续解释
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-white px-4 py-5 text-body-sm leading-7 text-fg-muted">
                        这一回合没有新增动作，适合重点看净值、风险分和纪律分为什么仍在变化。
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </ChartShell>
        </div>

        {/* AI Review sidebar */}
        <div className="space-y-6">
          <section
            className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.08)] sm:p-6 xl:sticky xl:top-6"
            data-history-ai-review="true"
            style={{ opacity: 1, transform: "none" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="bz-eyebrow">AI Review</p>
                <h2 className="mt-3 text-h2 text-fg-strong">Mr.Brown 的历史复盘建议</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/[0.04] px-3 py-2 text-caption font-semibold text-fg-muted">
                <Bot className="h-3.5 w-3.5 text-[#f08a38]" />
                {payload.aiReview.provider === "remote" ? "远端模型已参与" : "本地教学兜底"}
              </div>
            </div>

            {error ? (
              <div className="mt-5 rounded-[1.4rem] border border-amber-300/30 bg-amber-50 px-4 py-3 text-body-sm leading-7 text-amber-800">
                {error}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div className="rounded-[1.6rem] bg-[#fff4e9] p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#f08a38]" />
                  <p className="text-h3 text-fg-strong">AI 总结</p>
                </div>
                <p className="mt-3 text-body-sm leading-8 text-fg-default">{stripMarkdown(payload.aiReview.summary)}</p>
              </div>

              <div className="rounded-[1.6rem] bg-slate-950/[0.03] p-5">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-[#f08a38]" />
                  <p className="text-h3 text-fg-strong">诊断分析</p>
                </div>
                <div className="mt-4 space-y-3">
                  {payload.aiReview.analysis.map((item, index) => (
                    <div key={`analysis-${index}`} className="rounded-[1.2rem] bg-white px-4 py-3 shadow-sm">
                      <p className="text-body-sm leading-7 text-fg-default">{stripMarkdown(item)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-[#f08a38]" />
                  <p className="text-h3 text-fg-strong">下一步参考建议</p>
                </div>
                <div className="mt-4 space-y-3">
                  {payload.aiReview.nextSteps.map((item, index) => (
                    <div
                      key={`next-step-${index}`}
                      className="rounded-[1.2rem] border border-slate-200 bg-slate-950/[0.02] px-4 py-3"
                    >
                      <p className="bz-eyebrow">
                        Step 0{index + 1}
                      </p>
                      <p className="mt-2 text-body-sm leading-7 text-fg-default">{stripMarkdown(item)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Primary CTA — ghost style (secondary action, not the page's one primary CTA) */}
            <button
              type="button"
              onClick={() =>
                dispatchAssistantOpen({
                  prompt: "请结合我的历史操作继续解释下一步建议，并告诉我下一回合最值得优先验证的一个动作。",
                  autoSend: true,
                })
              }
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-3 text-body-sm font-semibold text-fg-default transition-colors hover:border-brand hover:text-brand-ink"
            >
              <Bot className="h-4 w-4" />
              再次让 AI 解释
            </button>

            <div className="mt-4 flex items-center gap-2 text-caption text-fg-muted">
              {loading ? <span>正在刷新最新历史复盘...</span> : <span>页面会在进入时拉取最新 AI 复盘。</span>}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
