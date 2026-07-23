import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type FundLabFundId = "index-growth" | "bond-anchor" | "gold-shield" | "global-tech";
export type FundLabPlan = "balanced" | "growth" | "defensive";

export interface FundLabFund {
  id: FundLabFundId;
  name: string;
  type: "指数 ETF" | "债券基金" | "黄金 ETF" | "主题基金";
  risk: number;
  expectedReturn: number;
  maxDrawdown: number;
  concept: string;
  summary: string;
  series: number[];
}

export interface FundLabAllocation {
  fundId: FundLabFundId;
  weight: number;
}

export interface FundLabActionInput {
  plan: FundLabPlan;
  amount: number;
  note?: string;
}

export interface FundLabPayload {
  generatedAt: string;
  funds: FundLabFund[];
  plans: Array<{
    id: FundLabPlan;
    label: string;
    summary: string;
    allocations: FundLabAllocation[];
  }>;
  selectedPlan: {
    id: FundLabPlan;
    label: string;
    amount: number;
    allocations: FundLabAllocation[];
    expectedReturn: number;
    riskScore: number;
    maxDrawdown: number;
    diversificationScore: number;
  };
  history: Array<{
    id: string;
    round: number;
    plan: FundLabPlan;
    planLabel: string;
    amount: number;
    note: string;
    createdAt: string;
  }>;
  coach: {
    title: string;
    nextSteps: string[];
  };
}

export const fundLabFunds: FundLabFund[] = [
  {
    id: "index-growth",
    name: "宽基成长 ETF",
    type: "指数 ETF",
    risk: 62,
    expectedReturn: 7.2,
    maxDrawdown: 18,
    concept: "指数基金买的是一篮子公司，重点是分散和长期。",
    summary: "覆盖较多行业，适合学习“市场平均收益”和长期波动。",
    series: [100, 102, 99, 106, 111, 108, 116, 121],
  },
  {
    id: "bond-anchor",
    name: "稳健债券锚",
    type: "债券基金",
    risk: 28,
    expectedReturn: 3.1,
    maxDrawdown: 5,
    concept: "债券像组合里的压舱石，收益慢，但能降低摇晃。",
    summary: "适合作为现金垫之外的稳健层，帮助理解利率和信用风险。",
    series: [100, 100.5, 101, 101.3, 101.1, 101.8, 102.2, 102.7],
  },
  {
    id: "gold-shield",
    name: "黄金避险伞",
    type: "黄金 ETF",
    risk: 43,
    expectedReturn: 4.2,
    maxDrawdown: 10,
    concept: "黄金不是万能保险，但能在不确定时提供一部分缓冲。",
    summary: "适合观察避险需求、利率变化和汇率之间的关系。",
    series: [100, 98, 101, 104, 102, 107, 106, 109],
  },
  {
    id: "global-tech",
    name: "全球科技主题",
    type: "主题基金",
    risk: 76,
    expectedReturn: 9.4,
    maxDrawdown: 26,
    concept: "主题基金弹性更高，也更容易集中在单一故事里。",
    summary: "适合练习“看懂主题”和“控制集中度”，不适合满仓冲动。",
    series: [100, 107, 104, 113, 125, 119, 128, 135],
  },
];

export const fundLabPlans: FundLabPayload["plans"] = [
  {
    id: "defensive",
    label: "防守底仓",
    summary: "先保护现金流，适合市场波动较大或刚开始学习的阶段。",
    allocations: [
      { fundId: "bond-anchor", weight: 50 },
      { fundId: "gold-shield", weight: 25 },
      { fundId: "index-growth", weight: 20 },
      { fundId: "global-tech", weight: 5 },
    ],
  },
  {
    id: "balanced",
    label: "均衡组合",
    summary: "把增长、稳健和避险放在一起，训练分散投资。",
    allocations: [
      { fundId: "index-growth", weight: 40 },
      { fundId: "bond-anchor", weight: 30 },
      { fundId: "gold-shield", weight: 15 },
      { fundId: "global-tech", weight: 15 },
    ],
  },
  {
    id: "growth",
    label: "成长进攻",
    summary: "提高成长资产比例，但必须承认更大的回撤和情绪压力。",
    allocations: [
      { fundId: "index-growth", weight: 45 },
      { fundId: "global-tech", weight: 35 },
      { fundId: "bond-anchor", weight: 10 },
      { fundId: "gold-shield", weight: 10 },
    ],
  },
];

function fundById(id: FundLabFundId) {
  const fund = fundLabFunds.find((item) => item.id === id);
  if (!fund) throw new Error("基金池数据缺失。");
  return fund;
}

function planById(id: FundLabPlan) {
  return fundLabPlans.find((item) => item.id === id) ?? fundLabPlans[1];
}

function weightedMetric(plan: FundLabPayload["plans"][number], field: "risk" | "expectedReturn" | "maxDrawdown") {
  return plan.allocations.reduce((total, item) => {
    const fund = fundById(item.fundId);
    return total + (fund[field] * item.weight) / 100;
  }, 0);
}

function fundLabEntries(run: ScenarioRun) {
  return run.actionLog.filter((entry) => entry.type === "fund_lab" && entry.meta?.kind === "fund_lab_action");
}

function readableHistoryText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text || /\?{4,}/.test(text) || text.includes("\uFFFD")) return fallback;
  return text.slice(0, 220);
}

function dedupeHistory(history: FundLabPayload["history"]) {
  const seen = new Set<string>();
  return history.filter((entry) => {
    const key = `${entry.round}|${entry.plan}|${entry.amount}|${entry.note}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildFundLabPayload(run: ScenarioRun, selectedPlan: FundLabPlan = "balanced", amount = 6000): FundLabPayload {
  const plan = planById(selectedPlan);
  const riskScore = Math.round(weightedMetric(plan, "risk"));
  const expectedReturn = Number(weightedMetric(plan, "expectedReturn").toFixed(1));
  const maxDrawdown = Number(weightedMetric(plan, "maxDrawdown").toFixed(1));
  const diversificationScore = Math.round(
    clamp(100 - Math.max(...plan.allocations.map((item) => item.weight)) * 0.6 - riskScore * 0.12, 35, 96),
  );
  const history = dedupeHistory(
    fundLabEntries(run).map((entry) => {
      const meta = entry.meta ?? {};
      const planId = (meta.plan as FundLabPlan | undefined) ?? "balanced";
      return {
        id: entry.id,
        round: entry.round,
        plan: planId,
        planLabel: planById(planId).label,
        amount: typeof meta.amount === "number" ? meta.amount : Math.abs(entry.amount),
        note: readableHistoryText(meta.note, "这条旧基金实验记录的文字无法识别，建议重新记录一次配置理由。"),
        createdAt: entry.timestamp,
      };
    }),
  );

  return {
    generatedAt: new Date().toISOString(),
    funds: fundLabFunds,
    plans: fundLabPlans,
    selectedPlan: {
      id: plan.id,
      label: plan.label,
      amount: Math.round(amount),
      allocations: plan.allocations,
      expectedReturn,
      riskScore,
      maxDrawdown,
      diversificationScore,
    },
    history,
    coach: {
      title: "Mr.Brown 的基金实验提示",
      nextSteps: [
        "先选择一个组合，再看最大回撤是否能承受。",
        "比较一次性投入和定投计划，观察平均成本差异。",
        "把配置理由写进历史复盘，下一回合再验证。",
      ],
    },
  };
}

export function createFundLabAction(run: ScenarioRun, input: FundLabActionInput) {
  const plan = planById(input.plan);
  const amount = clamp(Math.round(input.amount), 1000, 120000);
  const note = input.note?.trim() || `${plan.label}：先用模拟组合理解分散和回撤。`;
  const payload = buildFundLabPayload(run, plan.id, amount);
  const nextRun: ScenarioRun = {
    ...run,
    actionLog: [
      {
        id: createId("fund"),
        round: run.currentRound,
        type: "fund_lab",
        label: `基金实验：${plan.label}`,
        amount: 0,
        timestamp: new Date().toISOString(),
        meta: {
          kind: "fund_lab_action",
          plan: plan.id,
          amount,
          note,
          expectedReturn: payload.selectedPlan.expectedReturn,
          riskScore: payload.selectedPlan.riskScore,
          maxDrawdown: payload.selectedPlan.maxDrawdown,
          diversificationScore: payload.selectedPlan.diversificationScore,
        },
      },
      ...run.actionLog,
    ],
  };

  return {
    run: nextRun,
    payload: buildFundLabPayload(nextRun, plan.id, amount),
  };
}
