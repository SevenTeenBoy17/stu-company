"use client";

import { Bot, Radar, Sparkles, Target } from "lucide-react";

import { MoneyInlineText, MoneyText } from "@/components/shared/money-text";
import { MARKET_REFRESH_INTERVAL_LABEL } from "@/lib/market-refresh";
import type { AllocationSuggestion, PortfolioIntel } from "@/lib/types";
import {
  cn,
  formatCurrency,
  formatDateLabel,
  formatPercent,
  getMarketMoveClasses,
} from "@/lib/utils";

type StudentAllocationPanelProps = {
  intel: PortfolioIntel;
  loading?: boolean;
  onAskAi?: () => void;
};

function buildConicGradient(intel: PortfolioIntel) {
  let offset = 0;
  const segments = intel.allocation.map((slice) => {
    const nextOffset = offset + slice.weight;
    const segment = `${slice.color} ${offset}% ${nextOffset}%`;
    offset = nextOffset;
    return segment;
  });

  return `conic-gradient(${segments.join(", ")})`;
}

function toneStyles(tone: AllocationSuggestion["tone"]) {
  if (tone === "increase") {
    return {
      dot: "bg-[#d43c33]",
      text: "text-[#d43c33]",
      surface: "bg-[#fff1f0]",
    };
  }

  if (tone === "trim") {
    return {
      dot: "bg-amber-500",
      text: "text-amber-700",
      surface: "bg-amber-500/10",
    };
  }

  return {
    dot: "bg-slate-500",
    text: "text-slate-700",
    surface: "bg-slate-200/70",
  };
}

export function StudentAllocationPanel({
  intel,
  loading = false,
  onAskAi,
}: StudentAllocationPanelProps) {
  const providerLabel =
    intel.provider === "alltick"
      ? "AllTick 实时"
      : intel.provider === "hybrid"
        ? "混合行情"
        : "教学回放";

  return (
    <section className="panel overflow-hidden rounded-[2.2rem]">
      <div className="grid xl:grid-cols-[1.12fr_0.88fr]">
        <div className="relative overflow-hidden bg-[#0e1629] px-6 py-6 text-white md:px-7 md:py-7">
          <div className="grid-strokes pointer-events-none absolute inset-0 opacity-20" />
          <div className="pointer-events-none absolute -left-20 top-10 h-48 w-48 rounded-full bg-[#f08a38]/18 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#6f7ef7]/16 blur-3xl" />

          <div className="relative z-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#ffb36d]">
                  AI 配置中枢
                </p>
                <h2 className="mt-3 text-[2rem] font-semibold md:text-[2.2rem]">
                  策略总览下的实时配置面板
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-8 text-white/74 md:text-base">
                  {intel.regimeSummary}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-medium text-white/78">
                <Radar className="h-3.5 w-3.5" />
                {providerLabel}
              </div>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[0.7fr_1.3fr]">
              <div className="rounded-[1.8rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/48">配置倾向</p>
                    <p className="mt-2 text-[1.65rem] font-semibold">{intel.regimeLabel}</p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/72">
                    评分 {intel.score}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <div
                    className="relative h-48 w-48 rounded-full"
                    style={{ backgroundImage: buildConicGradient(intel) }}
                  >
                    <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-[#0f1830]">
                      <span className="text-xs uppercase tracking-[0.2em] text-white/48">总资产</span>
                      <span className="mt-2 text-2xl font-semibold">
                        <MoneyText tone="dark">
                          {formatCurrency(intel.allocation.reduce((sum, item) => sum + item.value, 0))}
                        </MoneyText>
                      </span>
                      <span className="mt-1 text-xs text-white/56">实时配置估算</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {intel.allocation.map((slice) => (
                    <div key={slice.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        <div>
                          <p className="text-sm font-medium text-white">{slice.label}</p>
                          <p className="text-xs text-white/46">{slice.hint}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{slice.weight.toFixed(1)}%</p>
                        <p className="text-xs">
                          <MoneyText tone="dark">{formatCurrency(slice.value)}</MoneyText>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {intel.marketSignals.map((signal) => (
                    <div
                      key={signal.key}
                      className="rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-4 backdrop-blur"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-all text-xs font-semibold leading-5 text-white sm:text-sm">{signal.label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/42">
                            {signal.code} · {signal.region}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            getMarketMoveClasses(signal.changePercent).darkBadge,
                          )}
                        >
                          {formatPercent(signal.changePercent)}
                        </span>
                      </div>
                      <p className="mt-4 text-2xl font-semibold">
                        {signal.currentPrice !== null ? (
                          <MoneyText tone="dark">{formatCurrency(signal.currentPrice)}</MoneyText>
                        ) : (
                          "--"
                        )}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/58">{signal.summary}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/48">当前持有热区</p>
                      <p className="mt-2 text-[1.35rem] font-semibold text-white">重点持有与仓位温度</p>
                    </div>
                    <Sparkles className="h-4 w-4 text-[#ffb36d]" />
                  </div>
                  <div className="mt-4 space-y-3">
                    {intel.holdings.length > 0 ? (
                      intel.holdings.slice(0, 4).map((holding) => (
                        <div key={holding.id} className="rounded-[1.2rem] bg-white/[0.05] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {holding.label} <span className="text-white/38">{holding.symbol}</span>
                              </p>
                              <p className="mt-1 text-xs text-white/48">
                                {holding.weight.toFixed(1)}% 总资产 · 风险 {holding.risk}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">
                                <MoneyText tone="dark">{formatCurrency(holding.value)}</MoneyText>
                              </p>
                              <p
                                className="mt-1 text-xs font-medium"
                              >
                                浮盈亏 <MoneyText tone="dark">{formatCurrency(holding.pnl)}</MoneyText>
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 rounded-full bg-white/8">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#f08a38] to-[#ffd1a3]"
                              style={{ width: `${Math.min(100, holding.weight * 3.2)}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[1.4rem] border border-dashed border-white/12 px-4 py-5 text-sm text-white/56">
                        你当前还没有形成持仓，买入后这里会自动生成更细的配置建议。
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/92 px-6 py-6 md:px-7 md:py-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#f08a38]">
                KeyAI / 再平衡建议
              </p>
              <h3 className="mt-3 text-[2rem] font-semibold text-slate-950">
                基于行情与当前持有的 AI 配置判断
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-950/[0.04] px-3 py-2 text-xs font-medium text-slate-600">
                {formatDateLabel(new Date(intel.asOf))}
              </span>
              <span className="rounded-full bg-slate-950/[0.04] px-3 py-2 text-xs font-medium text-slate-600">
                每 {MARKET_REFRESH_INTERVAL_LABEL} 自动刷新
              </span>
              {onAskAi ? (
                <button
                  type="button"
                  onClick={onAskAi}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-[#f08a38] hover:text-[#b96621]"
                >
                  <Bot className="h-4 w-4" />
                  让 AI 解释配置
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 rounded-[1.7rem] bg-[#fff4e9] p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                <Bot className="h-3.5 w-3.5 text-[#f08a38]" />
                {intel.coachProvider === "remote" ? "远端模型已参与分析" : "本地教学兜底已接管"}
              </div>
              {loading ? (
                <span className="text-xs font-medium text-slate-500">正在刷新行情与建议...</span>
              ) : null}
            </div>
            <p className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-700">
              <MoneyInlineText text={intel.coachNote} />
            </p>
            <p className="mt-4 whitespace-pre-line text-xs leading-6 text-slate-500">
              <MoneyInlineText text={intel.marketNote} />
            </p>
          </div>

          <div className="mt-6 rounded-[1.7rem] bg-slate-950/[0.03] p-5">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#f08a38]" />
              <p className="text-[1.35rem] font-semibold text-slate-950">当前配置 vs 建议区间</p>
            </div>
            <div className="mt-4 space-y-4">
              {intel.allocation.map((slice) => {
                const target = intel.targetAllocation.find((item) => item.id === slice.id);
                const delta = slice.weight - (target?.weight ?? 0);

                return (
                  <div key={slice.id}>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{slice.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{slice.hint}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {slice.weight.toFixed(1)}%
                          <span className="ml-2 text-xs font-medium text-slate-500">
                            目标 {target?.weight.toFixed(1) ?? "--"}%
                          </span>
                        </p>
                        <p
                          className={cn(
                            "mt-1 text-xs font-medium",
                            delta >= 3 ? "text-amber-600" : delta <= -3 ? "text-[#d43c33]" : "text-slate-500",
                          )}
                        >
                          {delta >= 0 ? "高于建议" : "低于建议"} {Math.abs(delta).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, slice.weight)}%`,
                          backgroundColor: slice.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {intel.suggestions.map((suggestion) => {
              const tone = toneStyles(suggestion.tone);
              return (
                <div key={suggestion.id} className={cn("rounded-[1.5rem] p-4", tone.surface)}>
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} />
                    <p className={cn("text-sm font-semibold", tone.text)}>{suggestion.label}</p>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    <MoneyInlineText text={suggestion.detail} />
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
