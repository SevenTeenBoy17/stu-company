import { eventIdForRound } from "@/lib/event-engine";
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

  if (entry.type === "opportunity") {
    return "这不是买卖动作，而是一次机会观察训练：重点看理由是否有证据、风险和下一步验证。";
  }

  if (entry.type === "fund_lab") {
    return "这次基金实验用于比较分散、回撤和长期节奏，不会直接改变净值。";
  }

  if (entry.type === "goal_account") {
    return "这次目标转入把现金变成有用途的储蓄，训练延迟满足和目标优先级。";
  }

  if (entry.type === "protection") {
    return "这次保护伞复盘用于观察坏情况里的现金流韧性，不是收益动作。";
  }

  if (entry.type === "watchlist") {
    return "这次自选观察把行情阅读变成了可复盘的学习记录，重点看理由是否能被后续数据验证。";
  }

  if (entry.type === "wealth_review") {
    return "这次财富复盘没有改变净值，但把持有理由、风险关注点和下一步动作写成了可回看的计划。";
  }

  if (entry.type === "quest") {
    return "这次任务奖励代表你把某个学习动作完成并领取了反馈，重点不在金额，而在习惯是否能重复。";
  }

  return "这一步改变了你的回合节奏，适合结合前后两轮净值一起回看。";
}

function getDirection(entry: ActionLog): HistoryActionGroupItem["direction"] {
  if (
    [
      "quest",
      "opportunity",
      "fund_lab",
      "goal_account",
      "protection",
      "watchlist",
      "wealth_review",
    ].includes(entry.type)
  ) {
    return "neutral";
  }
  if (entry.amount > 0) return "inflow";
  if (entry.amount < 0) return "outflow";
  return "neutral";
}

function buildTimeline(state: SimulationState): HistoryRoundSummary[] {
  return [...state.run.snapshots]
    .sort((left, right) => left.round - right.round)
    .map((snapshot) => {
      const round = getRoundMeta(snapshot.round);
      // Resolve the actual per-round event from the run's seeded timeline (mirrors
      // buildSimulationState); round.eventId is only the legacy fallback when a run
      // predates eventTimeline. Using the static script here showed wrong events in
      // replay and fed them to the AI review.
      const eventId = eventIdForRound(state.run.eventTimeline, snapshot.round, round.eventId);
      const event = getEventCard(eventId);

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
  const learningActions = actionLog.filter((entry) =>
    [
      "quest",
      "opportunity",
      "fund_lab",
      "goal_account",
      "protection",
      "watchlist",
      "wealth_review",
    ].includes(entry.type),
  ).length;
  const reviewActions = actionLog.filter((entry) =>
    ["quest", "watchlist", "wealth_review"].includes(entry.type),
  ).length;

  let peak = timeline[0]?.netWorth ?? 0;
  let maxDrawdown = 0;
  for (const point of timeline) {
    peak = Math.max(peak, point.netWorth);
    if (peak > 0) {
      // 与 run-power 同口径：回撤封顶 100%，避免净值为负时向学生展示 141% 这类无意义读数。
      maxDrawdown = Math.min(100, Math.max(maxDrawdown, ((peak - point.netWorth) / peak) * 100));
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
    learningActions,
    reviewActions,
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

function buildLearningSignals(actionLog: ActionLog[]): HistoryReviewPayload["learningSignals"] {
  const signalConfigs: Array<{
    id: ActionLog["type"];
    label: string;
    tone: HistoryReviewPayload["learningSignals"][number]["tone"];
    activeDetail: (count: number, latestRound?: number) => string;
  }> = [
    {
      id: "opportunity",
      label: "机会观察",
      tone: "observe",
      activeDetail: (count, latestRound) =>
        `已写下 ${count} 张机会观察单${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "fund_lab",
      label: "基金实验",
      tone: "build",
      activeDetail: (count, latestRound) =>
        `完成 ${count} 次基金/ETF实验${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "goal_account",
      label: "目标账户",
      tone: "build",
      activeDetail: (count, latestRound) =>
        `累计 ${count} 次目标账户动作${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "protection",
      label: "保护伞",
      tone: "protect",
      activeDetail: (count, latestRound) =>
        `完成 ${count} 次风险保护复盘${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "watchlist",
      label: "自选观察",
      tone: "observe",
      activeDetail: (count, latestRound) =>
        `留下 ${count} 条自选股观察记录${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "wealth_review",
      label: "持有复盘",
      tone: "review",
      activeDetail: (count, latestRound) =>
        `提交 ${count} 次持有计划复盘${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
    {
      id: "quest",
      label: "任务奖励",
      tone: "review",
      activeDetail: (count, latestRound) =>
        `领取 ${count} 次装饰奖励${latestRound ? `，最近出现在第 ${latestRound} 回合` : ""}。`,
    },
  ];

  return signalConfigs
    .map((config) => {
      const entries = actionLog.filter((entry) => entry.type === config.id);
      const latestRound = entries.length > 0 ? Math.max(...entries.map((entry) => entry.round)) : undefined;

      return {
        id: config.id,
        label: config.label,
        count: entries.length,
        latestRound,
        tone: config.tone,
        detail: config.activeDetail(entries.length, latestRound),
      };
    })
    .filter((signal) => signal.count > 0);
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
      metrics.learningActions > 0
        ? `从学习轨迹看，你留下 ${metrics.learningActions} 条机会、基金、目标、保护或复盘类记录，其中 ${metrics.reviewActions} 条更偏复盘沉淀，说明你开始把“做了什么”转成“为什么这么做”。`
        : "从学习轨迹看，目前复盘记录还偏少，下一步可以先写下一条机会观察或持有计划，让决策留下证据。",
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
    learningSignals: buildLearningSignals(state.run.actionLog),
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
  const learningSummary =
    payload.learningSignals.length > 0
      ? payload.learningSignals
          .map((signal) => `${signal.label}×${signal.count}${signal.latestRound ? `(最近R${signal.latestRound})` : ""}`)
          .join(" | ")
      : "尚未形成明显学习信号";

  return [
    `学生：${state.user.name} / ${state.user.title}`,
    `当前阶段：${payload.metrics.stageLabel}`,
    `已完成回合：${payload.metrics.roundsCompleted}/${state.run.totalRounds}`,
    `净值轨迹：${netWorthPath}`,
    `风险区间：${payload.metrics.riskRange[0]} - ${payload.metrics.riskRange[1]}`,
    `纪律趋势：${payload.metrics.disciplineTrend >= 0 ? "+" : ""}${payload.metrics.disciplineTrend}`,
    `关键节点：${highlightSummary}`,
    `学习信号：${learningSummary}`,
    `最近动作：${latestGroups}`,
    "请站在学生财商教育和模拟盘复盘的角度，不给保证式荐股结论，只做总结、诊断和下一步建议。",
  ].join("\n");
}
