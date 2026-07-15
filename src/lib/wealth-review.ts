import { buildWealthSummary, type WealthSummary } from "@/lib/allocation";
import type { ActionLog, ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";
import { DomainError } from "@/lib/domain-error";

export type WealthReviewFocus = "safety-buffer" | "diversification" | "debt-control" | "growth-engine";
export type WealthReviewAction = "raise-cash" | "rebalance" | "hold-and-watch" | "reduce-debt" | "link-goal";

export interface WealthReviewInput {
  focus: WealthReviewFocus;
  action: WealthReviewAction;
  confidence: number;
  note: string;
}

export interface WealthReviewEntry {
  id: string;
  round: number;
  focus: WealthReviewFocus;
  focusLabel: string;
  action: WealthReviewAction;
  actionLabel: string;
  confidence: number;
  score: number;
  note: string;
  feedback: string;
  createdAt: string;
}

export interface WealthReviewPayload {
  generatedAt: string;
  planScore: number;
  reviewCount: number;
  recommendedFocus: WealthReviewFocus;
  focusOptions: Array<{ id: WealthReviewFocus; label: string; hint: string }>;
  actionOptions: Array<{ id: WealthReviewAction; label: string; hint: string }>;
  latestReview?: WealthReviewEntry;
  history: WealthReviewEntry[];
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
}

export const wealthFocusOptions: WealthReviewPayload["focusOptions"] = [
  {
    id: "safety-buffer",
    label: "安全垫",
    hint: "先确认现金、储蓄和应急能力，避免被迫卖出。",
  },
  {
    id: "diversification",
    label: "分散度",
    hint: "检查是否把太多资产压在同一个篮子里。",
  },
  {
    id: "debt-control",
    label: "负债压力",
    hint: "把借款成本和现金流压力放进收益判断里。",
  },
  {
    id: "growth-engine",
    label: "成长引擎",
    hint: "观察股票、ETF、创业等弹性资产是否符合你的计划。",
  },
];

export const wealthActionOptions: WealthReviewPayload["actionOptions"] = [
  {
    id: "raise-cash",
    label: "补安全垫",
    hint: "把下一步动作优先放在现金或储蓄缓冲上。",
  },
  {
    id: "rebalance",
    label: "再平衡",
    hint: "降低过高仓位，把组合拉回更舒服的比例。",
  },
  {
    id: "hold-and-watch",
    label: "持有观察",
    hint: "暂不行动，但写清楚下一回合要验证什么。",
  },
  {
    id: "reduce-debt",
    label: "降低负债",
    hint: "先减少利息和杠杆压力，再谈扩张。",
  },
  {
    id: "link-goal",
    label: "连接目标",
    hint: "把持有计划和电脑、研学、备用金等生活目标连起来。",
  },
];

function labelForFocus(focus: WealthReviewFocus) {
  return wealthFocusOptions.find((item) => item.id === focus)?.label ?? "财富复盘";
}

function labelForAction(action: WealthReviewAction) {
  return wealthActionOptions.find((item) => item.id === action)?.label ?? "下一步动作";
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text) return fallback;
  if (/[\uFFFD锛鐧娉璇楼]/.test(text) || text.includes("鈥")) return fallback;
  return text;
}

function wealthReviewEntries(run: ScenarioRun) {
  return run.actionLog
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.type === "wealth_review" && entry.meta?.kind === "wealth_review")
    .sort((left, right) => {
      const leftTime = Date.parse(left.entry.timestamp);
      const rightTime = Date.parse(right.entry.timestamp);
      const timeDelta = (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
      return timeDelta === 0 ? left.index - right.index : timeDelta;
    })
    .map(({ entry }) => entry);
}

function recommendedFocus(summary: WealthSummary): WealthReviewFocus {
  const safety = summary.targetAllocation.find((item) => item.label === "安全垫");
  const growth = summary.targetAllocation.find((item) => item.label === "成长资产");
  if (summary.debt > Math.max(summary.netWorth * 0.12, 1)) return "debt-control";
  if (safety && safety.gap < -8) return "safety-buffer";
  if (summary.diversificationScore < 72) return "diversification";
  if (growth && Math.abs(growth.gap) > 10) return "growth-engine";
  return "diversification";
}

function buildFeedback(input: WealthReviewInput, summary: WealthSummary, score: number) {
  if (input.note.trim().length < 18) {
    return "复盘理由还偏短。可以补一句：为什么这一步比追涨或满仓更重要。";
  }

  if (input.confidence > 85 && summary.riskScore > 65) {
    return "你的信心很高，但组合风险也偏高。成熟的计划会同时写下“如果判断错了怎么办”。";
  }

  if (score >= 84) {
    return "这次持有计划有关照点、有下一步动作，也保留了验证空间，适合进入历史复盘。";
  }

  return "已经形成计划雏形。下一次可以把“触发条件”和“停止条件”写得更具体。";
}

function toReview(entry: ActionLog): WealthReviewEntry | null {
  const meta = entry.meta ?? {};
  const focus = meta.focus as WealthReviewFocus | undefined;
  const action = meta.action as WealthReviewAction | undefined;
  if (!focus || !action) return null;

  return {
    id: entry.id,
    round: entry.round,
    focus,
    focusLabel: cleanText(meta.focusLabel, labelForFocus(focus)),
    action,
    actionLabel: cleanText(meta.actionLabel, labelForAction(action)),
    confidence: typeof meta.confidence === "number" ? meta.confidence : 50,
    score: typeof meta.score === "number" ? meta.score : 60,
    note: cleanText(meta.note, "这条旧财富复盘记录的文字无法识别，建议重新写一次持有理由。"),
    feedback: cleanText(meta.feedback, "已记录为财富复盘。"),
    createdAt: entry.timestamp,
  };
}

export function buildWealthReviewPayload(run: ScenarioRun, summary = buildWealthSummary(run)): WealthReviewPayload {
  const history = wealthReviewEntries(run).map(toReview).filter((item): item is WealthReviewEntry => Boolean(item));
  const latestReview = history[0];
  const focus = recommendedFocus(summary);
  const baseScore =
    summary.disciplineScore * 0.28 +
    summary.diversificationScore * 0.32 +
    Math.max(0, 100 - summary.riskScore) * 0.18 +
    Math.min(18, history.length * 4);
  const planScore = Math.round(clamp(baseScore, 36, 96));

  return {
    generatedAt: new Date().toISOString(),
    planScore,
    reviewCount: history.length,
    recommendedFocus: focus,
    focusOptions: wealthFocusOptions,
    actionOptions: wealthActionOptions,
    latestReview,
    history: history.slice(0, 6),
    coach: {
      title: latestReview ? `已形成「${latestReview.focusLabel}」计划` : "先把持有理由写下来",
      summary: latestReview
        ? latestReview.feedback
        : "财富页的重点不是再加一个交易按钮，而是训练你看懂当前持有、现金垫和目标之间的关系。",
      nextSteps: [
        focus === "safety-buffer"
          ? "本回合优先检查现金垫，避免行情差时被迫卖出。"
          : "把当前最重要的关注点写成一句可验证的假设。",
        summary.diversificationScore < 72
          ? "若单一资产影响过大，先思考再平衡，不要只因为涨跌而行动。"
          : "分散度基本可用，下一步关注计划执行是否稳定。",
        summary.debt > 0
          ? "任何收益判断都先扣掉负债和利息压力。"
          : "没有明显负债压力时，可以把计划和生活目标账户连接起来。",
      ],
    },
  };
}

export function createWealthReview(run: ScenarioRun, input: WealthReviewInput) {
  const summary = buildWealthSummary(run);
  const confidence = clamp(Math.round(input.confidence), 1, 100);
  const note = input.note.trim();
  if (note.length < 8) {
    throw new DomainError("复盘理由太短，请至少写清楚一个关注点或下一步验证动作。");
  }

  const matchedFocusBonus = input.focus === recommendedFocus(summary) ? 10 : 4;
  const noteScore = Math.min(24, note.length * 0.8);
  const confidencePenalty = confidence > 88 && summary.riskScore > 65 ? 8 : 0;
  const score = Math.round(
    clamp(42 + matchedFocusBonus + noteScore + summary.diversificationScore * 0.12 - confidencePenalty, 38, 96),
  );
  const feedback = buildFeedback({ ...input, confidence, note }, summary, score);

  const entry: ActionLog = {
    id: createId("wealth"),
    round: run.currentRound,
    type: "wealth_review",
    label: `财富复盘：${labelForFocus(input.focus)} / ${labelForAction(input.action)}`,
    amount: 0,
    timestamp: new Date().toISOString(),
    meta: {
      kind: "wealth_review",
      focus: input.focus,
      focusLabel: labelForFocus(input.focus),
      action: input.action,
      actionLabel: labelForAction(input.action),
      confidence,
      score,
      note,
      feedback,
      netWorth: summary.netWorth,
      diversificationScore: summary.diversificationScore,
      riskScore: summary.riskScore,
    },
  };

  const nextRun: ScenarioRun = {
    ...run,
    actionLog: [entry, ...run.actionLog],
  };

  return {
    run: nextRun,
    entry,
    payload: buildWealthReviewPayload(nextRun, buildWealthSummary(nextRun)),
  };
}
