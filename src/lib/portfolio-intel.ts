import { evaluateRun } from "@/lib/simulation";
import type {
  AllocationSlice,
  AllocationSuggestion,
  ExternalMarketSignal,
  HoldingExposure,
  PortfolioIntel,
  SimulationState,
} from "@/lib/types";
import { clamp, formatCurrency, formatPercent } from "@/lib/utils";

const ALLOCATION_COLORS: Record<string, string> = {
  cash: "#111c34",
  savings: "#6bbf9c",
  market: "#f08a38",
  property: "#6f7ef7",
  venture: "#f36991",
};

function toWeight(value: number, total: number) {
  if (!total) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

function normalizeTargetAllocation(slices: AllocationSlice[]) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;

  return slices.map((slice) => ({
    ...slice,
    weight: toWeight(slice.value, total),
  }));
}

function buildFallbackSignals(state: SimulationState): ExternalMarketSignal[] {
  return state.market.assets.slice(0, 3).map((asset) => ({
    key: asset.id,
    label: asset.name,
    code: asset.symbol,
    region: "SIM",
    currentPrice: asset.currentPrice,
    changePercent: asset.dayChange,
    source: "simulation",
    summary: asset.description,
  }));
}

function buildHoldings(state: SimulationState, totalCapital: number): HoldingExposure[] {
  return state.run.holdings
    .map((holding) => {
      const asset = state.market.assets.find((candidate) => candidate.id === holding.assetId);
      if (!asset) return null;

      const value = holding.quantity * asset.currentPrice;
      const pnl = (asset.currentPrice - holding.averageCost) * holding.quantity;

      return {
        id: asset.id,
        label: asset.name,
        symbol: asset.symbol,
        value,
        weight: toWeight(value, totalCapital),
        dayChange: asset.dayChange,
        pnl,
        risk: asset.risk,
      } satisfies HoldingExposure;
    })
    .filter((holding): holding is HoldingExposure => Boolean(holding))
    .sort((left, right) => right.value - left.value);
}

function resolveRegime(signals: ExternalMarketSignal[], riskScore: number) {
  const avgChange =
    signals.length > 0
      ? signals.reduce((sum, signal) => sum + signal.changePercent, 0) / signals.length
      : 0;
  const score = clamp(Math.round(56 + avgChange * 10 - (riskScore - 55) * 0.35), 18, 92);

  if (avgChange >= 1) {
    return {
      score,
      regimeLabel: "风险偏好回暖",
      regimeSummary: "外部市场脉冲偏强，但更适合有节奏地加仓，而不是一次性把现金打满。",
    };
  }

  if (avgChange <= -0.6) {
    return {
      score,
      regimeLabel: "防守优先",
      regimeSummary: "实时行情偏谨慎，当前更重要的是留出流动性和回撤缓冲，再择机配置。",
    };
  }

  return {
    score,
    regimeLabel: "震荡均衡",
    regimeSummary: "市场没有形成单边主线，组合需要在进攻和防守之间保持弹性。",
  };
}

function buildActualAllocation(state: SimulationState) {
  const evaluated = evaluateRun(state.run, state.run.currentRound);
  const slices = [
    {
      id: "cash",
      label: "可用现金",
      value: state.run.cash,
      weight: 0,
      color: ALLOCATION_COLORS.cash,
      hint: "负责下回合的出手空间与回撤缓冲。",
    },
    {
      id: "savings",
      label: "稳健储蓄",
      value: state.run.savings,
      weight: 0,
      color: ALLOCATION_COLORS.savings,
      hint: "平衡波动，保障策略不会被一次失误击穿。",
    },
    {
      id: "market",
      label: "持有资产",
      value: evaluated.holdingsValue,
      weight: 0,
      color: ALLOCATION_COLORS.market,
      hint: "股票、ETF、债券、商品和汇率对冲的总市场暴露。",
    },
    {
      id: "property",
      label: "房产配置",
      value: evaluated.propertyValue,
      weight: 0,
      color: ALLOCATION_COLORS.property,
      hint: "偏中长期与现金流视角的配置部分。",
    },
    {
      id: "venture",
      label: "创业投入",
      value: evaluated.ventureValue,
      weight: 0,
      color: ALLOCATION_COLORS.venture,
      hint: "高弹性仓位，适合小比例参与，不宜替代基础盘。",
    },
  ] satisfies AllocationSlice[];

  const totalCapital = slices.reduce((sum, slice) => sum + slice.value, 0);
  const allocation = slices.map((slice) => ({
    ...slice,
    weight: toWeight(slice.value, totalCapital),
  }));

  return {
    allocation,
    totalCapital,
    evaluated,
  };
}

function buildTargetAllocation(state: SimulationState, regimeLabel: string, riskScore: number) {
  let template = {
    cash: 20,
    savings: 14,
    market: 42,
    property: 14,
    venture: 10,
  };

  if (regimeLabel === "防守优先" || riskScore >= 70) {
    template = {
      cash: 24,
      savings: 18,
      market: 30,
      property: 16,
      venture: 12,
    };
  } else if (regimeLabel === "风险偏好回暖" && riskScore <= 58) {
    template = {
      cash: 16,
      savings: 10,
      market: 49,
      property: 14,
      venture: 11,
    };
  }

  return normalizeTargetAllocation([
    {
      id: "cash",
      label: "可用现金",
      value: template.cash,
      weight: template.cash,
      color: ALLOCATION_COLORS.cash,
      hint: "建议保留的出手空间。",
    },
    {
      id: "savings",
      label: "稳健储蓄",
      value: template.savings,
      weight: template.savings,
      color: ALLOCATION_COLORS.savings,
      hint: "建议承担稳定器角色的部分。",
    },
    {
      id: "market",
      label: "持有资产",
      value: template.market,
      weight: template.market,
      color: ALLOCATION_COLORS.market,
      hint: "建议承担收益引擎的部分。",
    },
    {
      id: "property",
      label: "房产配置",
      value: template.property,
      weight: template.property,
      color: ALLOCATION_COLORS.property,
      hint: "建议承接中长期现金流的部分。",
    },
    {
      id: "venture",
      label: "创业投入",
      value: template.venture,
      weight: template.venture,
      color: ALLOCATION_COLORS.venture,
      hint: "建议保持探索但不过度放大的部分。",
    },
  ]);
}

function buildSuggestions(input: {
  actual: AllocationSlice[];
  target: AllocationSlice[];
  holdings: HoldingExposure[];
  riskScore: number;
  debt: number;
}) {
  const suggestions: AllocationSuggestion[] = [];
  const actualMap = new Map(input.actual.map((slice) => [slice.id, slice.weight]));
  const targetMap = new Map(input.target.map((slice) => [slice.id, slice.weight]));

  const marketGap = (actualMap.get("market") ?? 0) - (targetMap.get("market") ?? 0);
  if (marketGap >= 8) {
    suggestions.push({
      id: "trim-market",
      label: "先把市场暴露收回一点",
      tone: "trim",
      detail: `当前持有资产占比比建议值高出 ${marketGap.toFixed(1)}%，优先减掉高波动和高集中部分。`,
    });
  } else if (marketGap <= -8) {
    suggestions.push({
      id: "increase-market",
      label: "可以分批补回核心仓位",
      tone: "increase",
      detail: `当前持有资产占比比建议值低了 ${Math.abs(marketGap).toFixed(1)}%，可用分批买入代替一次性满仓。`,
    });
  }

  const liquidityActual = (actualMap.get("cash") ?? 0) + (actualMap.get("savings") ?? 0);
  const liquidityTarget = (targetMap.get("cash") ?? 0) + (targetMap.get("savings") ?? 0);
  if (liquidityActual + 5 < liquidityTarget) {
    suggestions.push({
      id: "raise-liquidity",
      label: "给组合补一点流动性",
      tone: "increase",
      detail: `当前流动性只有 ${liquidityActual.toFixed(1)}%，低于建议的 ${liquidityTarget.toFixed(1)}%，下一回合容易被动。`,
    });
  }

  const topHolding = input.holdings[0];
  if (topHolding && topHolding.weight >= 16) {
    suggestions.push({
      id: "reduce-concentration",
      label: `降低 ${topHolding.label} 的单点集中度`,
      tone: "trim",
      detail: `${topHolding.label} 已占总资产 ${topHolding.weight.toFixed(1)}%，建议把它放回“核心仓位”而不是“单点押注”。`,
    });
  }

  if (input.debt > 0 && input.riskScore >= 60) {
    suggestions.push({
      id: "stabilize-debt",
      label: "先稳住杠杆节奏",
      tone: "hold",
      detail: `当前仍有 ${formatCurrency(input.debt)} 债务，风险分 ${input.riskScore} 不算低，先控制节奏比追排名更重要。`,
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: "keep-balance",
      label: "保持现在的均衡结构",
      tone: "hold",
      detail: "组合目前没有明显失衡，接下来重点观察行情变化是否真的支持你加大风险暴露。",
    });
  }

  return suggestions.slice(0, 4);
}

function buildLocalCoachNote(intel: Omit<PortfolioIntel, "coachNote" | "coachProvider">, state: SimulationState) {
  const topHolding = intel.holdings[0];
  const opening = `AI 配置判断：当前更偏「${intel.regimeLabel}」，你的组合风险分是 ${state.run.snapshots.at(-1)?.riskScore ?? "--"}。`;
  const focus = topHolding
    ? `${topHolding.label} 现在占总资产 ${topHolding.weight.toFixed(1)}%，${topHolding.dayChange >= 0 ? "短线情绪偏热" : "短线承压明显"}。`
    : "你当前没有明显的单一持仓压力，说明组合还保留着调整空间。";
  const advice = intel.suggestions
    .slice(0, 2)
    .map((item) => item.detail)
    .join(" ");

  return [opening, focus, advice].join(" ");
}

export function buildPortfolioAiContext(
  state: SimulationState,
  intel: Omit<PortfolioIntel, "coachNote" | "coachProvider">,
) {
  return [
    `学生：${state.user.name} / ${state.user.title}`,
    `当前回合：${state.run.currentRound}/${state.run.totalRounds}`,
    `市场主线：${state.market.round.theme} - ${state.market.round.headline}`,
    `当前事件：${state.market.event.title} - ${state.market.event.description}`,
    `市场脉冲：${intel.marketSignals.map((item) => `${item.label} ${formatPercent(item.changePercent)}`).join("；")}`,
    `当前配置：${intel.allocation.map((item) => `${item.label} ${item.weight.toFixed(1)}%`).join("；")}`,
    `建议配置：${intel.targetAllocation.map((item) => `${item.label} ${item.weight.toFixed(1)}%`).join("；")}`,
    `重点持有：${
      intel.holdings.length > 0
        ? intel.holdings
            .slice(0, 3)
            .map((item) => `${item.label} ${item.weight.toFixed(1)}%，浮盈亏 ${formatCurrency(item.pnl)}`)
            .join("；")
        : "暂无持仓"
    }`,
    `建议动作：${intel.suggestions.map((item) => item.label).join("；")}`,
    "请输出 1 段简洁判断，再给 3 条行动建议。每条建议都要落到仓位、节奏或观察点，不给保证式买卖结论。",
  ].join("\n");
}

export function buildPortfolioIntel(
  state: SimulationState,
  input?: {
    marketSignals?: ExternalMarketSignal[];
    marketNote?: string;
    asOf?: string;
    coachNote?: string;
    coachProvider?: "remote" | "fallback";
  },
): PortfolioIntel {
  const { allocation, totalCapital, evaluated } = buildActualAllocation(state);
  const marketSignals =
    input?.marketSignals && input.marketSignals.length > 0
      ? input.marketSignals
      : buildFallbackSignals(state);
  const { score, regimeLabel, regimeSummary } = resolveRegime(marketSignals, evaluated.riskScore);
  const targetAllocation = buildTargetAllocation(state, regimeLabel, evaluated.riskScore);
  const holdings = buildHoldings(state, totalCapital);
  const suggestions = buildSuggestions({
    actual: allocation,
    target: targetAllocation,
    holdings,
    riskScore: evaluated.riskScore,
    debt: state.run.debt,
  });

  const provider: PortfolioIntel["provider"] =
    marketSignals.length > 0 && marketSignals.every((signal) => signal.source === "tsanghi")
      ? "tsanghi"
      : marketSignals.every((signal) => signal.source === "itick")
      ? "itick"
      : marketSignals.every((signal) => signal.source === "alltick")
        ? "alltick"
        : marketSignals.some(
              (signal) =>
                signal.source === "tsanghi" ||
                signal.source === "itick" ||
                signal.source === "alltick",
            )
        ? "hybrid"
        : "fallback";

  const draft = {
    asOf: input?.asOf ?? new Date().toISOString(),
    provider,
    regimeLabel,
    regimeSummary,
    marketNote: input?.marketNote ?? "当前使用教学行情脉冲与本地仓位估算。",
    score,
    marketSignals,
    allocation,
    targetAllocation,
    holdings,
    suggestions,
  };

  return {
    ...draft,
    coachNote: input?.coachNote ?? buildLocalCoachNote(draft, state),
    coachProvider: input?.coachProvider ?? "fallback",
  };
}
