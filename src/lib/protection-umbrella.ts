import { buildWealthSummary } from "@/lib/allocation";
import { buildLifeCashflowPayload, insurancePlans, type InsurancePlanId } from "@/lib/life-cashflow";
import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export interface ProtectionDimension {
  id: "emergency" | "insurance" | "debt" | "income" | "diversification" | "discipline";
  label: string;
  value: number;
  summary: string;
}

export interface ProtectionScenario {
  id: string;
  title: string;
  cost: number;
  outOfPocket: number;
  coveredAmount: number;
  liquidityAfter: number;
  status: "safe" | "watch" | "danger";
  teachingPoint: string;
}

export interface ProtectionUmbrellaPayload {
  generatedAt: string;
  selectedPlanId: InsurancePlanId;
  overview: {
    protectionScore: number;
    stageLabel: string;
    emergencyFund: number;
    runwayMonths: number;
    debt: number;
    monthlyPremium: number;
  };
  dimensions: ProtectionDimension[];
  scenarios: ProtectionScenario[];
  plans: typeof insurancePlans;
  history: Array<{
    id: string;
    planId: InsurancePlanId;
    planTitle: string;
    stressTitle: string;
    score: number;
    note: string;
    round: number;
    createdAt: string;
  }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
}

export interface ProtectionUmbrellaActionInput {
  planId: InsurancePlanId;
  stressId?: string;
  note?: string;
  now?: Date;
}

function findPlan(planId: InsurancePlanId) {
  return insurancePlans.find((plan) => plan.id === planId) ?? insurancePlans[1];
}

function protectionEntries(run: ScenarioRun) {
  return run.actionLog.filter((entry) => entry.type === "protection" || entry.meta?.kind === "protection_review");
}

function readableHistoryText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  // Older demo records may contain mojibake/question-mark placeholders after encoding repairs.
  if (!text || /\?{4,}/.test(text) || text.includes("\uFFFD")) return fallback;
  return text;
}

function toHistoryItem(entry: ScenarioRun["actionLog"][number]): ProtectionUmbrellaPayload["history"][number] | null {
  const planId = entry.meta?.planId as InsurancePlanId | undefined;
  const plan = planId ? insurancePlans.find((item) => item.id === planId) : undefined;
  if (!planId || !plan) return null;
  return {
    id: entry.id,
    planId,
    planTitle: plan.title,
    stressTitle: readableHistoryText(entry.meta?.stressTitle, "保护方案复盘"),
    score: typeof entry.meta?.score === "number" ? entry.meta.score : 60,
    note: readableHistoryText(entry.meta?.note, "这条旧记录的文字无法识别，建议重新记录一条保护复盘。"),
    round: entry.round,
    createdAt: entry.timestamp,
  };
}

function dedupeHistory(items: ProtectionUmbrellaPayload["history"]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.planId}|${item.stressTitle}|${item.note}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDimensions(run: ScenarioRun, planId: InsurancePlanId): ProtectionDimension[] {
  const wealth = buildWealthSummary(run);
  const life = buildLifeCashflowPayload(run, "balanced", planId);
  const plan = findPlan(planId);
  const emergencyScore = Math.round(clamp((life.overview.runwayMonths / 6) * 100, 12, 100));
  const insuranceScore = Math.round(clamp(plan.coverageRate * 86 + plan.covers.length * 7 - plan.premium / 18, 8, 96));
  const debtScore = Math.round(clamp(100 - (run.debt / Math.max(wealth.grossAssets, 1)) * 180, 5, 100));
  const incomeScore = Math.round(clamp(54 + run.currentRound * 3 + life.overview.savingsRate * 0.45, 30, 92));

  return [
    {
      id: "emergency",
      label: "应急金",
      value: emergencyScore,
      summary: `${life.overview.runwayMonths} 个月生活缓冲，先看能不能扛住突发支出。`,
    },
    {
      id: "insurance",
      label: "保险转移",
      value: insuranceScore,
      summary: plan.id === "none" ? "未配置保护，突发支出全部由自己承担。" : `${plan.title} 覆盖 ${plan.covers.length} 类风险。`,
    },
    {
      id: "debt",
      label: "债务压力",
      value: debtScore,
      summary: run.debt > 0 ? "有债务时，现金流比收益率更重要。" : "暂无债务，保护伞的压力主要来自突发支出。",
    },
    {
      id: "income",
      label: "现金流",
      value: incomeScore,
      summary: `本回合计划储蓄率 ${life.overview.savingsRate}%，代表可持续补伞速度。`,
    },
    {
      id: "diversification",
      label: "资产分散",
      value: wealth.diversificationScore,
      summary: "资产越集中，单一事件越容易放大波动。",
    },
    {
      id: "discipline",
      label: "复盘纪律",
      value: wealth.disciplineScore,
      summary: "纪律分越高，越容易在压力下按计划行动。",
    },
  ];
}

function buildCoach(score: number, dimensions: ProtectionDimension[]): ProtectionUmbrellaPayload["coach"] {
  const weakest = dimensions.slice().sort((a, b) => a.value - b.value)[0];
  const nextSteps = [
    `优先修复“${weakest.label}”：${weakest.summary}`,
    "选择一个突发事件做压力测试，比较有无保险时现金剩多少。",
    "保护伞不是收益工具，它的价值在于让你遇到坏事时不用被迫卖出资产。",
  ];
  return {
    title: score >= 82 ? "保护伞比较稳" : score >= 64 ? "保护伞正在成形" : "先补安全底座",
    summary: "这张图把应急金、保险、债务和分散度放在一起，帮助你理解真实理财里的“防守”。",
    nextSteps,
  };
}

export function buildProtectionUmbrellaPayload(
  run: ScenarioRun,
  selectedPlanId: InsurancePlanId = "basic",
  now = new Date(),
): ProtectionUmbrellaPayload {
  const life = buildLifeCashflowPayload(run, "balanced", selectedPlanId, now);
  const plan = findPlan(selectedPlanId);
  const dimensions = buildDimensions(run, selectedPlanId);
  const protectionScore = Math.round(clamp(dimensions.reduce((sum, item) => sum + item.value, 0) / dimensions.length, 10, 98));
  const scenarios = life.stressEvents.map((event) => ({
    id: event.id,
    title: event.title,
    cost: event.cost,
    outOfPocket: event.outOfPocket,
    coveredAmount: event.coveredAmount,
    liquidityAfter: event.liquidityAfter,
    status: event.status,
    teachingPoint: event.teachingPoint,
  }));

  return {
    generatedAt: now.toISOString(),
    selectedPlanId: plan.id,
    overview: {
      protectionScore,
      stageLabel: protectionScore >= 82 ? "防守充足" : protectionScore >= 64 ? "可承受小冲击" : "保护不足",
      emergencyFund: life.overview.emergencyFund,
      runwayMonths: life.overview.runwayMonths,
      debt: run.debt,
      monthlyPremium: plan.premium,
    },
    dimensions,
    scenarios,
    plans: insurancePlans,
    history: dedupeHistory(
      protectionEntries(run)
        .map(toHistoryItem)
        .filter((item): item is ProtectionUmbrellaPayload["history"][number] => Boolean(item)),
    ),
    coach: buildCoach(protectionScore, dimensions),
  };
}

export function createProtectionUmbrellaAction(
  run: ScenarioRun,
  input: ProtectionUmbrellaActionInput,
): { run: ScenarioRun; payload: ProtectionUmbrellaPayload; entry: ProtectionUmbrellaPayload["history"][number] } {
  const now = input.now ?? new Date();
  const plan = findPlan(input.planId);
  const payload = buildProtectionUmbrellaPayload(run, plan.id, now);
  const stress = payload.scenarios.find((item) => item.id === input.stressId) ?? payload.scenarios[0];
  const nextRun = structuredClone(run);

  nextRun.actionLog.unshift({
    id: createId("log"),
    round: nextRun.currentRound,
    type: "protection",
    label: `保护伞复盘：${plan.title}`,
    amount: plan.premium,
    timestamp: now.toISOString(),
    meta: {
      kind: "protection_review",
      planId: plan.id,
      stressId: stress.id,
      stressTitle: stress.title,
      score: payload.overview.protectionScore,
      note: input.note?.trim() || "比较突发事件下的现金剩余和风险转移效果。",
    },
  });

  const nextPayload = buildProtectionUmbrellaPayload(nextRun, plan.id, now);
  const entry = toHistoryItem(nextRun.actionLog[0]);
  if (!entry) throw new Error("保护伞记录生成失败。");
  return { run: nextRun, payload: nextPayload, entry };
}
