import { marketRounds } from "@/lib/market-data";
import { getEventCard } from "@/lib/simulation";
import type {
  ActionLog,
  HistoryActionGroup,
  HistoryActionGroupItem,
  HistoryHighlight,
  HistoryReviewInsight,
  HistoryReviewPayload,
  HistoryRoundSummary,
  SimulationState,
} from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

function getRoundMeta(round: number) {
  return marketRounds[Math.max(0, Math.min(marketRounds.length - 1, round - 1))];
}

function formatPercentValue(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function getStageLabel(round: number) {
  if (round <= 3) return "建仓观察期";
  if (round <= 7) return "扩张试错期";
  if (round <= 10) return "再平衡期";
  return "收官复盘期";
}

function describeActionImpact(entry: ActionLog) {
  if (entry.type === "trade") {
    return entry.amount < 0
      ? "增加了市场敞口，也更考验你对仓位节奏的控制。"
      : "回收了流动性，适合拿来复查是否兑现了原先计划。";
  }

  if (entry.type === "bank") {
    if (entry.label.includes("贷款")) return "可用现金上升了，但杠杆压力也同步抬高。";
    if (entry.label.includes("储蓄")) return "把现金管理动作纳入了节奏控制，缓冲垫更清楚了。";
    return "这一步主要影响的是现金流安全边界，而不是短线排名。";
  }

  if (entry.type === "property") {
    return "房产动作会长期占用现金流，更适合放在中段和后段回合复查。";
  }

  if (entry.type === "venture") {
    return "创业投入更看重退出节奏和项目集中度，不适合情绪化加码。";
  }

  return "这一步改变了你的回合节奏，适合结合前后两轮净值一起回看。";
}

function getDirection(entry: ActionLog): HistoryActionGroupItem["direction"] {
  if (entry.amount > 0) return "inflow";
  if (entry.amount < 0) return "outflow";
  return "neutral";
}

function buildTimeline(state: SimulationState): HistoryRoundSummary[] {
  return [...state.run.snapshots]
    .sort((left, right) => left.round - right.round)
    .map((snapshot) => {
      const round = getRoundMeta(snapshot.round);
      const event = getEventCard(round.eventId);

      return {
        round: snapshot.round,
        theme: round.theme,
        headline: round.headline,
        eventTitle: event.title,
        eventSignal: event.signal,
        netWorth: snapshot.netWorth,
        cash: snapshot.cash,
        savings: snapshot.savings,
        debt: snapshot.debt,
        riskScore: snapshot.riskScore,
        disciplineScore: snapshot.disciplineScore,
        reflection: snapshot.reflection,
      };
    });
}

function buildActionGroups(state: SimulationState, timeline: HistoryRoundSummary[]) {
  const roundMap = new Map(timeline.map((entry) => [entry.round, entry]));
  return timeline
    .slice()
    .sort((left, right) => right.round - left.round)
    .map<HistoryActionGroup>((entry) => {
      const items = state.run.actionLog
        .filter((log) => log.round === entry.round)
        .slice()
        .sort((left, right) => +new Date(right.timestamp) - +new Date(left.timestamp))
        .map<HistoryActionGroupItem>((log) => ({
          id: log.id,
          type: log.type,
          label: log.label,
          amount: log.amount,
          timestamp: log.timestamp,
          direction: getDirection(log),
          impact: describeActionImpact(log),
        }));

      const roundMeta = roundMap.get(entry.round);

      return {
        round: entry.round,
        theme: entry.theme,
        headline: entry.headline,
        eventTitle: entry.eventTitle,
        eventSignal: entry.eventSignal,
        summary:
          items.length > 0
            ? roundMeta?.reflection ?? "这一回合有动作发生，适合结合净值曲线检查执行质量。"
            : "这一回合更偏观察与承接，适合重点看净值与风险分有没有跟上主题变化。",
        items,
      };
    });
}

function buildMetrics(timeline: HistoryRoundSummary[], actionLog: ActionLog[]) {
  const latest = timeline.at(-1);
  const first = timeline.at(0);
  const buyCount = actionLog.filter((entry) => entry.type === "trade" && entry.amount < 0).length;
  const sellCount = actionLog.filter((entry) => entry.type === "trade" && entry.amount > 0).length;
  const cashActions = actionLog.filter((entry) => entry.type === "bank").length;
  const expansionActions = actionLog.filter(
    (entry) => entry.type === "property" || entry.type === "venture",
  ).length;

  let peak = timeline[0]?.netWorth ?? 0;
  let maxDrawdown = 0;
  for (const point of timeline) {
    peak = Math.max(peak, point.netWorth);
    if (peak > 0) {
      maxDrawdown = Math.max(maxDrawdown, ((peak - point.netWorth) / peak) * 100);
    }
  }

  return {
    roundsCompleted: timeline.length,
    currentNetWorth: latest?.netWorth ?? 0,
    peakNetWorth: Math.max(...timeline.map((item) => item.netWorth)),
    buyCount,
    sellCount,
    cashActions,
    expansionActions,
    maxDrawdown,
    stageLabel: getStageLabel(latest?.round ?? 1),
    riskRange: [
      Math.min(...timeline.map((item) => item.riskScore)),
      Math.max(...timeline.map((item) => item.riskScore)),
    ] as [number, number],
    disciplineTrend: (latest?.disciplineScore ?? 0) - (first?.disciplineScore ?? 0),
  };
}

function buildHighlights(timeline: HistoryRoundSummary[]): HistoryHighlight[] {
  const peakRound = timeline.reduce((best, current) =>
    current.netWorth > best.netWorth ? current : best,
  );
  const riskRound = timeline.reduce((best, current) =>
    current.riskScore > best.riskScore ? current : best,
  );
  const cashRound = timeline.reduce((best, current) => (current.cash < best.cash ? current : best));
  const recoveryRound =
    timeline.slice(1).reduce(
      (best, current, index) => {
        const previous = timeline[index];
        const delta = current.netWorth - previous.netWorth;
        return delta > best.delta ? { point: current, delta } : best;
      },
      { point: timeline[0], delta: Number.NEGATIVE_INFINITY },
    ).point ?? timeline[0];

  return [
    {
      id: "peak-net-worth",
      round: peakRound.round,
      tone: "positive",
      title: "净值峰值回合",
      detail: `${peakRound.theme} 阶段把净值推到当前历史高点，适合回看当时的节奏和仓位上限。`,
      metricLabel: "峰值净值",
      metricValue: formatCurrency(peakRound.netWorth),
    },
    {
      id: "highest-risk",
      round: riskRound.round,
      tone: "warning",
      title: "风险拉高回合",
      detail: `${riskRound.theme} 阶段风险分最高，说明那一轮最值得检查集中度和现金缓冲。`,
      metricLabel: "风险分",
      metricValue: `${riskRound.riskScore}`,
    },
    {
      id: "lowest-cash",
      round: cashRound.round,
      tone: "neutral",
      title: "现金最紧回合",
      detail: `${cashRound.theme} 时现金空间最小，适合复查是否过早把缓冲打满。`,
      metricLabel: "可用现金",
      metricValue: formatCurrency(cashRound.cash),
    },
    {
      id: "best-recovery",
      round: recoveryRound.round,
      tone: "positive",
      title: "修复最明显回合",
      detail: `${recoveryRound.theme} 这轮后的净值修复最明显，值得提炼出当时真正起作用的动作。`,
      metricLabel: "净值修复",
      metricValue: formatCurrency(recoveryRound.netWorth),
    },
  ];
}

export function buildFallbackHistoryReview(
  state: SimulationState,
  metrics: HistoryReviewPayload["metrics"],
  timeline: HistoryRoundSummary[],
): HistoryReviewInsight {
  const latest = timeline.at(-1);
  const riskDirection = metrics.riskRange[1] >= 70 ? "明显抬高过" : "大体可控";
  const disciplineDirection =
    metrics.disciplineTrend >= 0 ? "整体在变稳" : "后段回合出现了执行走形";

  return {
    summary: `你已经完成 ${metrics.roundsCompleted} 个回合，目前处在${metrics.stageLabel}。净值从 ${formatCurrency(
      timeline[0]?.netWorth ?? 0,
    )} 走到 ${formatCurrency(metrics.currentNetWorth)}，期间最高到 ${formatCurrency(
      metrics.peakNetWorth,
    )}，说明你已经形成了可复盘的策略轨迹。`,
    analysis: [
      `从净值曲线看，最大回撤约为 ${formatPercentValue(metrics.maxDrawdown)}，这意味着你的组合并不是没有增长，而是节奏控制还在影响最终留存收益。`,
      `从风控表现看，风险分区间在 ${metrics.riskRange[0]} 到 ${metrics.riskRange[1]} 之间，说明仓位曾${riskDirection}；纪律分趋势 ${disciplineDirection}。`,
      `从动作结构看，你累计买入 ${metrics.buyCount} 次、卖出 ${metrics.sellCount} 次、现金管理 ${metrics.cashActions} 次、扩张动作 ${metrics.expansionActions} 次，说明你已经不只是“下单”，而是在试着经营整套资金流。`,
    ],
    nextSteps: [
      latest && latest.cash < latest.netWorth * 0.16
        ? "先把下一回合的现金缓冲拉回安全线，优先给自己留出修正错误的空间，再考虑扩张持仓。"
        : "保持现金缓冲不要被一次性打满，让自己在关键事件轮次里还有二次验证和补位空间。",
      metrics.riskRange[1] >= 70
        ? "优先复查风险最高那一轮的持仓集中度，把“为什么会加到那个位置”写成一条明确规则。"
        : "继续保持分散配置，把每一笔新增仓位都和当轮主题挂钩，避免为了热度而偏离计划。",
      metrics.expansionActions > metrics.cashActions
        ? "下一阶段把房产、创业这类扩张动作和现金管理配对检查，先确认退出节奏，再决定是否继续投入。"
        : "把最近一次做对的节奏提炼成自己的“下一回合清单”，让好习惯可以重复，而不是只靠当时感觉。",
    ],
    provider: "fallback",
  };
}

export function buildHistoryReviewPayload(
  state: SimulationState,
  aiReview?: HistoryReviewInsight,
): HistoryReviewPayload {
  const timeline = buildTimeline(state);
  const metrics = buildMetrics(timeline, state.run.actionLog);
  const payload: HistoryReviewPayload = {
    generatedAt: new Date().toISOString(),
    timeline,
    actionGroups: buildActionGroups(state, timeline),
    metrics,
    highlights: buildHighlights(timeline),
    aiReview: aiReview ?? buildFallbackHistoryReview(state, metrics, timeline),
  };

  return payload;
}

export function buildHistoryReviewAiContext(
  state: SimulationState,
  payload: HistoryReviewPayload,
) {
  const latestGroups = payload.actionGroups
    .slice(0, 3)
    .map((group) => {
      const actionSummary =
        group.items.length > 0
          ? group.items
              .slice(0, 3)
              .map((item) => item.label)
              .join("；")
          : "本回合以观察和承接为主";

      return `R${group.round} ${group.theme}：${actionSummary}`;
    })
    .join(" | ");

  const netWorthPath = payload.timeline
    .map((point) => `R${point.round}:${point.netWorth}`)
    .join(" | ");

  const highlightSummary = payload.highlights
    .map((highlight) => `R${highlight.round} ${highlight.title}(${highlight.metricValue})`)
    .join(" | ");

  return [
    `学生：${state.user.name} / ${state.user.title}`,
    `当前阶段：${payload.metrics.stageLabel}`,
    `已完成回合：${payload.metrics.roundsCompleted}/${state.run.totalRounds}`,
    `净值轨迹：${netWorthPath}`,
    `风险区间：${payload.metrics.riskRange[0]} - ${payload.metrics.riskRange[1]}`,
    `纪律趋势：${payload.metrics.disciplineTrend >= 0 ? "+" : ""}${payload.metrics.disciplineTrend}`,
    `关键节点：${highlightSummary}`,
    `最近动作：${latestGroups}`,
    "请站在学生财商教育和模拟盘复盘的角度，不给保证式荐股结论，只做总结、诊断和下一步建议。",
  ].join("\n");
}
