import { evaluateRun } from "@/lib/simulation";
import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type CreditScenarioId = "device-installment" | "emergency-loan" | "startup-bridge";
export type CreditLabIntent = "simulate" | "borrow" | "repay";

export interface CreditScenario {
  id: CreditScenarioId;
  title: string;
  purpose: string;
  principal: number;
  annualRate: number;
  months: number;
  difficulty: "入门" | "进阶" | "挑战";
  concept: string;
}

export interface CreditScenarioView extends CreditScenario {
  monthlyPayment: number;
  totalRepayment: number;
  totalInterest: number;
  debtAfter: number;
  debtRatioAfter: number;
  stressLabel: string;
  status: "healthy" | "watch" | "danger";
}

export interface CreditLabPayload {
  generatedAt: string;
  selectedScenarioId: CreditScenarioId;
  overview: {
    creditScore: number;
    stageLabel: string;
    cash: number;
    savings: number;
    debt: number;
    netWorth: number;
    debtToAssets: number;
    emergencyFund: number;
    monthlyInterestEstimate: number;
    repaymentCapacity: number;
  };
  scenarios: CreditScenarioView[];
  selectedScenario: CreditScenarioView;
  repaymentOptions: Array<{
    id: string;
    label: string;
    amount: number;
    interestSavedEstimate: number;
    afterDebt: number;
    disabled: boolean;
  }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
}

export interface CreditLabActionInput {
  intent?: CreditLabIntent;
  scenarioId?: CreditScenarioId;
  amount?: number;
  now?: Date;
}

export interface CreditLabActionResult {
  intent: Exclude<CreditLabIntent, "simulate">;
  amount: number;
  cashAfter: number;
  debtAfter: number;
  creditScoreAfter: number;
  summary: string;
}

export const creditScenarios: CreditScenario[] = [
  {
    id: "device-installment",
    title: "学习设备分期",
    purpose: "把一次性大额消费拆成月供，观察总利息和现金流压力。",
    principal: 3600,
    annualRate: 0.088,
    months: 12,
    difficulty: "入门",
    concept: "分期不是免费，它只是把今天的支出挪到未来，并附带利息。",
  },
  {
    id: "emergency-loan",
    title: "突发维修借款",
    purpose: "当安全垫不足时，用短期借款处理紧急支出，并比较还款节奏。",
    principal: 5200,
    annualRate: 0.118,
    months: 9,
    difficulty: "进阶",
    concept: "应急借款能解决流动性问题，但会抬高未来几个月的固定支出。",
  },
  {
    id: "startup-bridge",
    title: "创业周转额度",
    purpose: "模拟为了项目周转而借入资金，理解杠杆、现金流和失败成本。",
    principal: 9000,
    annualRate: 0.138,
    months: 15,
    difficulty: "挑战",
    concept: "杠杆可以放大行动空间，也会放大犯错成本；先算承受能力再借。",
  },
];

function monthlyPayment(principal: number, annualRate: number, months: number) {
  const monthlyRate = annualRate / 12;
  if (monthlyRate <= 0) return Math.round(principal / months);
  const factor = (monthlyRate * (1 + monthlyRate) ** months) / ((1 + monthlyRate) ** months - 1);
  return Math.round(principal * factor);
}

// Consumer-credit risk is measured against personal repayment capacity, not the
// six-figure investment portfolio. Using net worth made every loan read ~5%
// ("healthy") and the 0.58 leverage guard unreachable (#5 audit).
const CREDIT_CAPACITY_CAP = 6000;
function creditCapacityBase(run: ScenarioRun) {
  return Math.max(0, run.savings + Math.min(run.cash, CREDIT_CAPACITY_CAP));
}

function buildScenarioView(run: ScenarioRun, scenario: CreditScenario, capacityBase: number): CreditScenarioView {
  const payment = monthlyPayment(scenario.principal, scenario.annualRate, scenario.months);
  const totalRepayment = payment * scenario.months;
  const debtAfter = run.debt + scenario.principal;
  const debtRatioAfter = Math.round((debtAfter / Math.max(capacityBase + scenario.principal, 1)) * 100);
  const status = debtRatioAfter >= 45 ? "danger" : debtRatioAfter >= 28 ? "watch" : "healthy";

  return {
    ...scenario,
    monthlyPayment: payment,
    totalRepayment,
    totalInterest: Math.max(0, totalRepayment - scenario.principal),
    debtAfter,
    debtRatioAfter,
    stressLabel:
      status === "danger"
        ? "压力偏高，建议先降低额度"
        : status === "watch"
          ? "可以模拟，但要留还款计划"
          : "压力可控，适合教学观察",
    status,
  };
}

function buildRepaymentOptions(run: ScenarioRun) {
  const options = [
    { id: "small", label: "小额提前还款", ratio: 0.08 },
    { id: "medium", label: "标准提前还款", ratio: 0.16 },
    { id: "large", label: "强力降债", ratio: 0.28 },
  ];
  return options.map((option) => {
    const amount = Math.round(Math.min(run.cash, Math.max(500, run.debt * option.ratio)));
    return {
      id: option.id,
      label: option.label,
      amount,
      interestSavedEstimate: Math.round(amount * 0.09),
      afterDebt: Math.max(0, run.debt - amount),
      disabled: run.debt <= 0 || run.cash < 500 || amount <= 0,
    };
  });
}

export function buildCreditLabPayload(
  run: ScenarioRun,
  scenarioId: CreditScenarioId = "device-installment",
  now = new Date(),
): CreditLabPayload {
  const evaluated = evaluateRun(run, run.currentRound);
  const totalAssets = Math.max(0, evaluated.netWorth + run.debt);
  const debtToAssets = Math.round((run.debt / Math.max(totalAssets, 1)) * 100);
  const emergencyFund = run.cash + run.savings;
  const repaymentCapacity = Math.round(clamp((run.cash + run.savings * 0.4) / 6, 0, 12_000));
  const monthlyInterestEstimate = Math.round(run.debt * 0.012);
  const creditScore = Math.round(
    clamp(
      88 -
        debtToAssets * 0.9 -
        (monthlyInterestEstimate / Math.max(repaymentCapacity, 1)) * 18 +
        Math.min(emergencyFund / 8_000, 8) +
        evaluated.disciplineScore * 0.1,
      32,
      96,
    ),
  );
  const stageLabel =
    creditScore >= 82
      ? "信用健康"
      : creditScore >= 68
        ? "可控观察"
        : creditScore >= 52
          ? "债务降温"
          : "暂停加杠杆";

  const scenarios = creditScenarios.map((scenario) => buildScenarioView(run, scenario, creditCapacityBase(run)));
  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];
  const repaymentOptions = buildRepaymentOptions(run);
  const nextSteps = [
    "先比较“月供”与“总利息”，不要只看每个月好像付得起。",
    debtToAssets > 35 ? "当前债务率偏高，优先做一次提前还款模拟。" : "债务率可控，但仍要保留至少一回合现金安全垫。",
    "如果要借款，先写下用途、还款来源和最坏情况下的退出方案。",
  ];

  return {
    generatedAt: now.toISOString(),
    selectedScenarioId: selectedScenario.id,
    overview: {
      creditScore,
      stageLabel,
      cash: run.cash,
      savings: run.savings,
      debt: run.debt,
      netWorth: evaluated.netWorth,
      debtToAssets,
      emergencyFund,
      monthlyInterestEstimate,
      repaymentCapacity,
    },
    scenarios,
    selectedScenario,
    repaymentOptions,
    coach: {
      title: creditScore >= 72 ? "信用可以服务目标，但不能替代收入" : "先修复现金流，再考虑借款",
      summary:
        "信用实验室把分期、借款、提前还款放进同一张决策表。目标不是鼓励借钱，而是让学生看见利息、时间和现金流之间的关系。",
      nextSteps,
    },
  };
}

function refreshCreditSnapshot(run: ScenarioRun) {
  const evaluated = evaluateRun(run, run.currentRound);
  const snapshot = {
    round: run.currentRound,
    netWorth: evaluated.netWorth,
    cash: run.cash,
    savings: run.savings,
    debt: run.debt,
    riskScore: evaluated.riskScore,
    disciplineScore: evaluated.disciplineScore,
    reflection: evaluated.reflection,
  };
  const existing = run.snapshots.find((item) => item.round === run.currentRound);
  if (existing) {
    Object.assign(existing, snapshot);
  } else {
    run.snapshots.push(snapshot);
  }
  run.lastInsight = evaluated.reflection;
  run.netWorth = evaluated.netWorth;
}

export function applyCreditLabAction(
  run: ScenarioRun,
  input: CreditLabActionInput = {},
): { run: ScenarioRun; payload: CreditLabPayload; result: CreditLabActionResult } {
  const intent = input.intent ?? "simulate";
  if (intent === "simulate") {
    throw new Error("模拟不需要写入沙盘，请使用 buildCreditLabPayload。");
  }

  const now = input.now ?? new Date();
  const nextRun = structuredClone(run);
  const requestedAmount = input.amount == null ? null : Math.max(500, Math.round(input.amount));
  let amount = requestedAmount ?? 0;
  let summary = "";

  if (intent === "repay") {
    amount = Math.min(requestedAmount ?? Math.round(nextRun.debt * 0.16), nextRun.debt, nextRun.cash);
    if (amount <= 0) throw new Error("当前没有可还款金额，请先检查现金或债务余额。");
    nextRun.cash -= amount;
    nextRun.debt = Math.max(0, nextRun.debt - amount);
    summary = `已提前还款 ${amount.toLocaleString("zh-CN")} 元，净值不变，但未来利息压力下降。`;
  }

  if (intent === "borrow") {
    const selected = buildCreditLabPayload(nextRun, input.scenarioId).selectedScenario;
    amount = Math.min(requestedAmount ?? selected.principal, selected.principal);
    // Leverage is gauged against personal repayment capacity, not the investment
    // portfolio, so the 0.58 guard actually engages on over-borrowing (#5 audit).
    const ratioAfter = (nextRun.debt + amount) / Math.max(creditCapacityBase(nextRun) + amount, 1);
    if (ratioAfter > 0.58) {
      throw new Error("这笔借款会让债务率过高，请先降低金额或先还款。");
    }
    nextRun.cash += amount;
    nextRun.debt += amount;
    summary = `已新增教学借款 ${amount.toLocaleString("zh-CN")} 元。现金增加不代表变富，因为同额债务也同步增加。`;
  }

  refreshCreditSnapshot(nextRun);
  const payload = buildCreditLabPayload(nextRun, input.scenarioId, now);
  const result: CreditLabActionResult = {
    intent,
    amount,
    cashAfter: nextRun.cash,
    debtAfter: nextRun.debt,
    creditScoreAfter: payload.overview.creditScore,
    summary,
  };

  nextRun.actionLog.unshift({
    id: createId("log"),
    round: nextRun.currentRound,
    type: "bank",
    label: intent === "repay" ? `信用实验室还款 ${amount}` : `信用实验室借款 ${amount}`,
    amount: intent === "repay" ? -amount : amount,
    timestamp: now.toISOString(),
    meta: {
      kind: "credit_lab_action",
      scenarioId: input.scenarioId ?? payload.selectedScenarioId,
      ...result,
    },
  });

  return { run: nextRun, payload, result };
}
