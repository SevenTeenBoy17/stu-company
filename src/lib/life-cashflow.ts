import { buildWealthSummary } from "@/lib/allocation";
import { evaluateRun } from "@/lib/simulation";
import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";
import { DomainError } from "@/lib/domain-error";

export type BudgetPlanId = "shield" | "balanced" | "growth";
export type InsurancePlanId = "none" | "basic" | "plus";

export type BudgetPlan = {
  id: BudgetPlanId;
  title: string;
  tagline: string;
  ratios: {
    essentials: number;
    learning: number;
    social: number;
    saving: number;
  };
  concept: string;
};

export type InsurancePlan = {
  id: InsurancePlanId;
  title: string;
  premium: number;
  coverageRate: number;
  deductible: number;
  covers: Array<"device" | "health" | "family">;
  concept: string;
};

export type LifeCashflowPayload = {
  generatedAt: string;
  selectedPlanId: BudgetPlanId;
  selectedInsuranceId: InsurancePlanId;
  alreadyAppliedThisRound: boolean;
  overview: {
    monthlyIncome: number;
    requiredExpense: number;
    plannedSaving: number;
    savingsRate: number;
    emergencyFund: number;
    emergencyTarget: number;
    emergencyGap: number;
    runwayMonths: number;
    cashflowScore: number;
    stageLabel: string;
  };
  budgetRows: Array<{
    id: keyof BudgetPlan["ratios"];
    label: string;
    amount: number;
    ratio: number;
    hint: string;
  }>;
  insurance: {
    options: InsurancePlan[];
    selected: InsurancePlan;
    coverageScore: number;
    summary: string;
  };
  stressEvents: Array<{
    id: string;
    title: string;
    category: "device" | "health" | "family";
    cost: number;
    outOfPocket: number;
    coveredAmount: number;
    liquidityAfter: number;
    status: "safe" | "watch" | "danger";
    teachingPoint: string;
  }>;
  weeklyPlan: Array<{
    week: number;
    title: string;
    budget: number;
    checkpoint: string;
  }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
  plans: BudgetPlan[];
};

export type LifeCashflowApplicationResult = {
  planId: BudgetPlanId;
  insuranceId: InsurancePlanId;
  monthlyIncome: number;
  requiredExpense: number;
  plannedSaving: number;
  savingTransferred: number;
  debtPaid: number;
  savingsDrawdown: number;
  debtAdded: number;
  cashChange: number;
  savingsChange: number;
  debtChange: number;
  emergencyFundAfter: number;
  cashflowScoreAfter: number;
  stageLabelAfter: string;
  summary: string;
};

export type LifeCashflowApplyInput = {
  planId?: BudgetPlanId;
  insuranceId?: InsurancePlanId;
  now?: Date;
};

export const budgetPlans: BudgetPlan[] = [
  {
    id: "shield",
    title: "防守优先",
    tagline: "先把应急金打厚，再做小额学习实验。",
    ratios: { essentials: 46, learning: 14, social: 12, saving: 28 },
    concept: "预算不是限制自由，而是给突发事件留后路。",
  },
  {
    id: "balanced",
    title: "均衡成长",
    tagline: "保留安全垫，同时给学习、社交和投资试错留空间。",
    ratios: { essentials: 42, learning: 16, social: 18, saving: 24 },
    concept: "好的预算像课程表：每个目标都有固定位置。",
  },
  {
    id: "growth",
    title: "成长冲刺",
    tagline: "提高学习和体验预算，但需要更强自控力。",
    ratios: { essentials: 38, learning: 22, social: 22, saving: 18 },
    concept: "体验型支出可以存在，但不能挤掉安全垫。",
  },
];

export const insurancePlans: InsurancePlan[] = [
  {
    id: "none",
    title: "不配置保险",
    premium: 0,
    coverageRate: 0,
    deductible: 0,
    covers: [],
    concept: "完全自担风险，适合用来观察保险的风险转移作用。",
  },
  {
    id: "basic",
    title: "基础守护",
    premium: 90,
    coverageRate: 0.58,
    deductible: 220,
    covers: ["device", "health"],
    concept: "用小额保费转移手机维修和基础健康支出风险。",
  },
  {
    id: "plus",
    title: "家庭协同守护",
    premium: 160,
    coverageRate: 0.78,
    deductible: 120,
    covers: ["device", "health", "family"],
    concept: "覆盖更广，但每月会牺牲一部分可自由支配现金。",
  },
];

const budgetLabels: Record<keyof BudgetPlan["ratios"], { label: string; hint: string }> = {
  essentials: {
    label: "必要支出",
    hint: "交通、餐食、学习材料等必须支付的项目。",
  },
  learning: {
    label: "成长预算",
    hint: "课程、书籍、工具和竞赛准备，用来提升长期能力。",
  },
  social: {
    label: "体验社交",
    hint: "同学聚会、兴趣体验和小额娱乐，重点是可控。",
  },
  saving: {
    label: "自动储蓄",
    hint: "先把一部分收入锁进安全垫，减少冲动消费。",
  },
};

const stressEventTemplates = [
  {
    id: "phone-repair",
    title: "手机屏幕维修",
    category: "device" as const,
    cost: 1800,
    teachingPoint: "小概率事件不一定很大，但会立刻消耗现金流。",
  },
  {
    id: "sports-injury",
    title: "运动受伤门诊",
    category: "health" as const,
    cost: 3200,
    teachingPoint: "保险的核心不是赚钱，而是把不可预测的大额支出变得可承受。",
  },
  {
    id: "family-support",
    title: "家庭临时支援",
    category: "family" as const,
    cost: 2600,
    teachingPoint: "真实生活里，家庭责任会影响个人预算，提前预留很重要。",
  },
];

function findBudgetPlan(id: BudgetPlanId) {
  return budgetPlans.find((plan) => plan.id === id) ?? budgetPlans[1];
}

function findInsurancePlan(id: InsurancePlanId) {
  return insurancePlans.find((plan) => plan.id === id) ?? insurancePlans[1];
}

function computeOutOfPocket(cost: number, category: "device" | "health" | "family", insurance: InsurancePlan) {
  if (!insurance.covers.includes(category) || insurance.coverageRate <= 0) {
    return { outOfPocket: cost, coveredAmount: 0 };
  }

  const coveredAmount = Math.max(0, Math.round(cost * insurance.coverageRate) - insurance.deductible);
  return {
    outOfPocket: Math.max(insurance.deductible, cost - coveredAmount),
    coveredAmount,
  };
}

function buildWeeklyPlan(plan: BudgetPlan, monthlyIncome: number): LifeCashflowPayload["weeklyPlan"] {
  const weeklyFlexible = Math.round((monthlyIncome * (plan.ratios.learning + plan.ratios.social)) / 100 / 4);
  return [
    {
      week: 1,
      title: "先记账，不评价",
      budget: weeklyFlexible,
      checkpoint: "只记录钱花到哪里，不急着责备自己。",
    },
    {
      week: 2,
      title: "找出一个冲动触发点",
      budget: weeklyFlexible,
      checkpoint: "观察是同伴影响、折扣刺激，还是情绪补偿。",
    },
    {
      week: 3,
      title: "把一笔消费换成成长预算",
      budget: Math.round(weeklyFlexible * 0.85),
      checkpoint: "把少买一次饮料/皮肤/盲盒，换成一本书或一次课程。",
    },
    {
      week: 4,
      title: "复盘预算是否可持续",
      budget: weeklyFlexible,
      checkpoint: "预算太严格会反弹，太宽松会失效，要找到可坚持的区间。",
    },
  ];
}

function buildCoach(
  plan: BudgetPlan,
  insurance: InsurancePlan,
  overview: LifeCashflowPayload["overview"],
): LifeCashflowPayload["coach"] {
  const nextSteps: string[] = [];

  if (overview.emergencyGap > 0) {
    nextSteps.push(`先补齐约 ${overview.emergencyGap.toLocaleString("zh-CN")} 元应急金，再扩大高波动投入。`);
  } else {
    nextSteps.push("应急金已覆盖当前目标，可以把下一次训练放在“预算复盘”而不是继续囤现金。");
  }

  if (insurance.id === "none") {
    nextSteps.push("尝试切换到基础守护，观察同一突发事件下现金流压力如何变化。");
  } else {
    nextSteps.push("保险不是收益资产，重点比较“少付保费”和“出事少掏钱”之间的取舍。");
  }

  if (plan.id === "growth" && overview.savingsRate < 20) {
    nextSteps.push("成长冲刺方案会牺牲储蓄率，建议设置一个每周消费上限防止失控。");
  } else {
    nextSteps.push("保持每周一次小复盘：本周哪一笔钱最像冲动消费，下一周怎么替换。");
  }

  return {
    title: `${plan.title} · 现金流训练建议`,
    summary: "这张表把生活预算、应急金和保险放到同一个压力测试里，帮助你理解真实理财不只是在市场里买卖。",
    nextSteps,
  };
}

function estimateDebtPayment(run: ScenarioRun, monthlyIncome: number) {
  return Math.round(Math.min(monthlyIncome * 0.18, run.debt * 0.025));
}

function refreshLifeSnapshot(run: ScenarioRun) {
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

function applyCashShortfall(run: ScenarioRun) {
  if (run.cash >= 0) {
    return { savingsDrawdown: 0, debtAdded: 0 };
  }

  const shortage = Math.abs(run.cash);
  const savingsDrawdown = Math.min(run.savings, shortage);
  run.savings -= savingsDrawdown;
  run.cash += savingsDrawdown;

  const debtAdded = run.cash < 0 ? Math.abs(run.cash) : 0;
  if (debtAdded > 0) {
    run.debt += debtAdded;
    run.cash = 0;
  }

  return { savingsDrawdown, debtAdded };
}

export function buildLifeCashflowPayload(
  run: ScenarioRun,
  planId: BudgetPlanId = "balanced",
  insuranceId: InsurancePlanId = "basic",
  now = new Date(),
): LifeCashflowPayload {
  const wealth = buildWealthSummary(run);
  const plan = findBudgetPlan(planId);
  const insurance = findInsurancePlan(insuranceId);
  const alreadyAppliedThisRound = run.actionLog.some(
    (entry) => entry.round === run.currentRound && entry.meta?.kind === "life_cashflow_challenge",
  );
  const monthlyIncome = Math.round(1800 + run.currentRound * 120 + clamp(wealth.netWorth / 500, 0, 420));
  const baseExpense = Math.round(monthlyIncome * 0.42);
  const debtPayment = Math.round(Math.min(monthlyIncome * 0.18, run.debt * 0.025));
  const requiredExpense = baseExpense + debtPayment + insurance.premium;
  const plannedSaving = Math.round((monthlyIncome * plan.ratios.saving) / 100);
  // Personal-finance reserve for the budgeting exercise: bank savings plus a
  // personal-scale slice of investable cash. Using the full six-figure sandbox
  // portfolio as the emergency fund made every budget trivially over-funded
  // (runway ~120 months, all stress events safe), defeating the lesson (#5 audit).
  const personalCashReserve = Math.min(run.cash, monthlyIncome);
  const emergencyFund = Math.max(0, Math.round(run.savings + personalCashReserve));
  const emergencyTarget = Math.round((baseExpense + insurance.premium) * 3);
  const emergencyGap = Math.max(0, emergencyTarget - emergencyFund);
  const runwayMonths = Number((emergencyFund / Math.max(baseExpense + insurance.premium, 1)).toFixed(1));
  const savingsRate = Math.round((plannedSaving / Math.max(monthlyIncome, 1)) * 100);

  const coverageScore = Math.round(
    clamp(insurance.coverageRate * 72 + insurance.covers.length * 8 - insurance.premium / 18, 0, 96),
  );
  const cashflowScore = Math.round(
    clamp(
      savingsRate * 1.15 +
        Math.min(runwayMonths, 6) * 9 +
        coverageScore * 0.28 +
        wealth.disciplineScore * 0.18 -
        debtPayment / 90,
      20,
      98,
    ),
  );

  const stageLabel =
    cashflowScore >= 82
      ? "抗风险充足"
      : cashflowScore >= 66
        ? "现金流稳定"
        : emergencyGap > 0
          ? "应急金修复"
          : "预算需校准";

  const overview = {
    monthlyIncome,
    requiredExpense,
    plannedSaving,
    savingsRate,
    emergencyFund,
    emergencyTarget,
    emergencyGap,
    runwayMonths,
    cashflowScore,
    stageLabel,
  };

  const budgetRows = (Object.keys(plan.ratios) as Array<keyof BudgetPlan["ratios"]>).map((id) => ({
    id,
    label: budgetLabels[id].label,
    amount: Math.round((monthlyIncome * plan.ratios[id]) / 100),
    ratio: plan.ratios[id],
    hint: budgetLabels[id].hint,
  }));

  const liquidBase = run.savings + personalCashReserve - plannedSaving - requiredExpense;
  const stressEvents = stressEventTemplates.map((event) => {
    const { outOfPocket, coveredAmount } = computeOutOfPocket(event.cost, event.category, insurance);
    const liquidityAfter = Math.round(liquidBase - outOfPocket);
    return {
      ...event,
      outOfPocket,
      coveredAmount,
      liquidityAfter,
      status: liquidityAfter >= 0 ? ("safe" as const) : liquidityAfter >= -1500 ? ("watch" as const) : ("danger" as const),
    };
  });

  return {
    generatedAt: now.toISOString(),
    selectedPlanId: plan.id,
    selectedInsuranceId: insurance.id,
    alreadyAppliedThisRound,
    overview,
    budgetRows,
    insurance: {
      options: insurancePlans,
      selected: insurance,
      coverageScore,
      summary:
        insurance.id === "none"
          ? "当前方案不转移风险，所有突发支出都会直接消耗现金。"
          : `${insurance.title} 每月保费 ${insurance.premium} 元，覆盖 ${insurance.covers.length} 类常见突发支出。`,
    },
    stressEvents,
    weeklyPlan: buildWeeklyPlan(plan, monthlyIncome),
    coach: buildCoach(plan, insurance, overview),
    plans: budgetPlans,
  };
}

export function applyLifeCashflowChallenge(
  run: ScenarioRun,
  input: LifeCashflowApplyInput = {},
): { run: ScenarioRun; payload: LifeCashflowPayload; result: LifeCashflowApplicationResult } {
  const now = input.now ?? new Date();
  // 回合级幂等（itest4 R3 P1）：每次 apply 都把当月收入加进现金，若同回合可重复执行
  // 即可脚本无限刷现金/净值→喂 power-score 刷战力榜。对齐 auto-invest 的同回合守卫，
  // 本回合已执行过则拒绝，要求先推进回合。
  const alreadyAppliedThisRound = run.actionLog.some(
    (entry) => entry.round === run.currentRound && entry.meta?.kind === "life_cashflow_challenge",
  );
  if (alreadyAppliedThisRound) {
    throw new DomainError("本回合已执行过生活账本，请先推进回合再执行下一次。");
  }
  const selectedPlanId = input.planId ?? "balanced";
  const selectedInsuranceId = input.insuranceId ?? "basic";
  const beforePayload = buildLifeCashflowPayload(run, selectedPlanId, selectedInsuranceId, now);
  const nextRun = structuredClone(run);
  const debtPaid = Math.min(nextRun.debt, estimateDebtPayment(nextRun, beforePayload.overview.monthlyIncome));
  const nonDebtExpense = Math.max(0, beforePayload.overview.requiredExpense - debtPaid);
  const cashBefore = nextRun.cash;
  const savingsBefore = nextRun.savings;
  const debtBefore = nextRun.debt;

  nextRun.cash += beforePayload.overview.monthlyIncome;
  nextRun.cash -= nonDebtExpense;

  if (debtPaid > 0) {
    nextRun.cash -= debtPaid;
    nextRun.debt = Math.max(0, nextRun.debt - debtPaid);
  }

  const savingTransferred = Math.max(0, Math.min(nextRun.cash, beforePayload.overview.plannedSaving));
  nextRun.cash -= savingTransferred;
  nextRun.savings += savingTransferred;

  const { savingsDrawdown, debtAdded } = applyCashShortfall(nextRun);
  refreshLifeSnapshot(nextRun);

  const payload = buildLifeCashflowPayload(nextRun, selectedPlanId, selectedInsuranceId, now);
  const result: LifeCashflowApplicationResult = {
    planId: selectedPlanId,
    insuranceId: selectedInsuranceId,
    monthlyIncome: beforePayload.overview.monthlyIncome,
    requiredExpense: beforePayload.overview.requiredExpense,
    plannedSaving: beforePayload.overview.plannedSaving,
    savingTransferred,
    debtPaid,
    savingsDrawdown,
    debtAdded,
    cashChange: nextRun.cash - cashBefore,
    savingsChange: nextRun.savings - savingsBefore,
    debtChange: nextRun.debt - debtBefore,
    emergencyFundAfter: payload.overview.emergencyFund,
    cashflowScoreAfter: payload.overview.cashflowScore,
    stageLabelAfter: payload.overview.stageLabel,
    summary:
      debtAdded > 0
        ? "本月预算执行后现金垫不足，系统已把缺口记为短期债务。下一步先修复应急金。"
        : savingsDrawdown > 0
          ? "本月动用了部分储蓄来覆盖支出，说明安全垫发挥了作用，但需要在后续回合补回。"
          : "本月预算执行完成，收入、支出、储蓄和保障都已同步到沙盘账本。",
  };

  nextRun.actionLog.unshift({
    id: createId("log"),
    round: nextRun.currentRound,
    type: "bank",
    label: `生活账本执行：${findBudgetPlan(selectedPlanId).title} + ${findInsurancePlan(selectedInsuranceId).title}`,
    amount: savingTransferred,
    timestamp: now.toISOString(),
    meta: {
      kind: "life_cashflow_challenge",
      ...result,
    },
  });

  return { run: nextRun, payload, result };
}
