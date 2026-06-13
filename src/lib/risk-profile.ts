import { buildWealthSummary, type WealthSummary } from "@/lib/allocation";
import type { ScenarioRun } from "@/lib/types";
import { clamp } from "@/lib/utils";

export type RiskQuestionOption = {
  id: string;
  label: string;
  detail: string;
  score: number;
  concept: string;
};

export type RiskQuestion = {
  id: string;
  title: string;
  scenario: string;
  options: RiskQuestionOption[];
};

export type RiskProfileAnswer = {
  questionId: string;
  optionId: string;
};

export type RiskProfileBand = "defensive" | "steady" | "balanced" | "growth";

export type RiskProfilePayload = {
  generatedAt: string;
  score: number;
  band: RiskProfileBand;
  label: string;
  archetype: string;
  summary: string;
  learningConcept: string;
  current: {
    netWorth: number;
    riskScore: number;
    disciplineScore: number;
    diversificationScore: number;
    stageLabel: string;
  };
  allocation: Array<{
    id: "safety" | "growth" | "real";
    label: string;
    current: number;
    target: number;
    gap: number;
    tone: "low" | "fit" | "high";
    hint: string;
  }>;
  radar: Array<{
    id: string;
    label: string;
    value: number;
    hint: string;
  }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
  questions: RiskQuestion[];
  selectedAnswers: RiskProfileAnswer[];
};

export const riskProfileQuestions: RiskQuestion[] = [
  {
    id: "drawdown-reaction",
    title: "如果组合一周内回撤 8%，你第一反应是什么？",
    scenario: "市场突然转冷，班级榜单也在波动。你需要先处理情绪，再处理资产。",
    options: [
      {
        id: "exit",
        label: "先退出来观察",
        detail: "保住安全垫，等下一轮事件更清楚再行动。",
        score: 25,
        concept: "回撤承受力",
      },
      {
        id: "review",
        label: "复盘原因再调整",
        detail: "看是基本面变化、仓位过重，还是短期噪声。",
        score: 58,
        concept: "假设复盘",
      },
      {
        id: "add",
        label: "如果逻辑没坏就分批加仓",
        detail: "不一次打满，给后续回合保留选择权。",
        score: 78,
        concept: "分批决策",
      },
    ],
  },
  {
    id: "cash-buffer",
    title: "拿到一笔 5000 元模拟压岁钱，你会怎么安排？",
    scenario: "现金不是躺平，它负责让你在突发事件里不被迫卖出。",
    options: [
      {
        id: "mostly-save",
        label: "大部分放进安全垫",
        detail: "先保证 2-3 回合的现金缓冲。",
        score: 30,
        concept: "安全垫",
      },
      {
        id: "split",
        label: "一半安全垫，一半练配置",
        detail: "既保留流动性，也给自己一个学习仓位。",
        score: 58,
        concept: "资产配置",
      },
      {
        id: "growth",
        label: "主要投入成长资产",
        detail: "希望用更高波动换取更高学习反馈。",
        score: 78,
        concept: "风险收益权衡",
      },
    ],
  },
  {
    id: "peer-pressure",
    title: "同学靠某只股票短期冲到榜首，你会？",
    scenario: "排行榜会刺激行动，但好策略不能只由同伴收益驱动。",
    options: [
      {
        id: "ignore",
        label: "不追，先看自己的计划",
        detail: "不让榜单影响原本的仓位纪律。",
        score: 34,
        concept: "行为偏差",
      },
      {
        id: "small-test",
        label: "小仓位验证，不重仓",
        detail: "把冲动变成受控实验。",
        score: 62,
        concept: "仓位控制",
      },
      {
        id: "follow",
        label: "快速跟上，争取下一回合反超",
        detail: "愿意承受更大波动换竞争机会。",
        score: 86,
        concept: "从众风险",
      },
    ],
  },
  {
    id: "diversification",
    title: "你更喜欢哪种组合？",
    scenario: "真实理财往往不是单点押注，而是在多个目标之间分配注意力。",
    options: [
      {
        id: "cash-bond",
        label: "现金、储蓄、债券为主",
        detail: "低波动，适合先建立稳定感。",
        score: 28,
        concept: "低波动资产",
      },
      {
        id: "basket",
        label: "ETF + 少量股票 + 安全垫",
        detail: "用分散组合训练长期节奏。",
        score: 58,
        concept: "分散投资",
      },
      {
        id: "venture-stock",
        label: "股票、创业、主题资产为主",
        detail: "更像探索型玩家，需要严格止损和复盘。",
        score: 82,
        concept: "集中度风险",
      },
    ],
  },
  {
    id: "time-horizon",
    title: "如果目标是 12 回合后完成毕业挑战，你更看重？",
    scenario: "投资期限越长，越需要把短期刺激放回长期目标里。",
    options: [
      {
        id: "avoid-loss",
        label: "尽量少亏，稳稳完成",
        detail: "用低波动保持心态稳定。",
        score: 32,
        concept: "风险预算",
      },
      {
        id: "steady-growth",
        label: "每 2-3 回合复盘一次",
        detail: "不追求每回合都赢，但要持续优化。",
        score: 60,
        concept: "长期主义",
      },
      {
        id: "top-rank",
        label: "争取高排名，愿意承担波动",
        detail: "竞争目标明确，但更需要纪律护栏。",
        score: 84,
        concept: "收益目标",
      },
    ],
  },
  {
    id: "learning-style",
    title: "遇到一个陌生资产类别，你会如何学习？",
    scenario: "多元理财不是认识更多名词，而是知道什么时候该用、什么时候不用。",
    options: [
      {
        id: "course-first",
        label: "先学课程再模拟",
        detail: "先建立概念框架，减少乱试成本。",
        score: 35,
        concept: "认知负荷",
      },
      {
        id: "small-sim",
        label: "边学边用小仓位实验",
        detail: "用低成本反馈加深理解。",
        score: 63,
        concept: "实验学习",
      },
      {
        id: "scenario-first",
        label: "先进入事件，再倒推学习",
        detail: "通过压力场景快速形成经验。",
        score: 80,
        concept: "情境学习",
      },
    ],
  },
];

const defaultAnswers: RiskProfileAnswer[] = riskProfileQuestions.map((question) => ({
  questionId: question.id,
  optionId: question.options[1]?.id ?? question.options[0]?.id,
}));

function getOption(questionId: string, optionId: string) {
  const question = riskProfileQuestions.find((item) => item.id === questionId);
  const option = question?.options.find((item) => item.id === optionId);
  return { question, option };
}

export function normalizeRiskProfileAnswers(answers: RiskProfileAnswer[] = defaultAnswers) {
  return riskProfileQuestions.map((question) => {
    const submitted = answers.find((answer) => answer.questionId === question.id);
    const option = submitted ? question.options.find((item) => item.id === submitted.optionId) : undefined;
    return {
      questionId: question.id,
      optionId: option?.id ?? question.options[1]?.id ?? question.options[0].id,
    };
  });
}

function bandFromScore(score: number): Pick<RiskProfilePayload, "band" | "label" | "archetype" | "summary" | "learningConcept"> {
  if (score <= 38) {
    return {
      band: "defensive",
      label: "保守守门员",
      archetype: "先守住球门，再找进攻窗口",
      summary: "你对回撤很敏感，优势是不会轻易被热点带跑；短板是可能错过低成本学习机会。",
      learningConcept: "风险承受能力不是胆子大小，而是亏损出现时还能否按计划行动。",
    };
  }

  if (score <= 62) {
    return {
      band: "steady",
      label: "稳健探索者",
      archetype: "一只脚踩安全垫，一只脚试新地图",
      summary: "你愿意学习新资产，但仍重视现金和纪律，适合用小仓位实验建立经验。",
      learningConcept: "稳健不等于不行动，而是先确定损失上限，再让学习发生。",
    };
  }

  if (score <= 76) {
    return {
      band: "balanced",
      label: "均衡成长者",
      archetype: "用分散配置换取长期通关率",
      summary: "你能接受一定波动，也知道不能把全部筹码压在单一主题上。",
      learningConcept: "好的配置像球队阵容：进攻、防守和替补都要有位置。",
    };
  }

  return {
    band: "growth",
    label: "进取挑战者",
    archetype: "敢冲榜，但必须给自己装上刹车",
    summary: "你追求成长和排名反馈，优势是行动力强；短板是容易被短期收益强化冲动。",
    learningConcept: "进取型策略最需要风险预算，否则一次错误就可能吞掉多回合努力。",
  };
}

function targetAllocationForScore(score: number) {
  if (score <= 38) return { safety: 58, growth: 26, real: 16 };
  if (score <= 62) return { safety: 48, growth: 34, real: 18 };
  if (score <= 78) return { safety: 38, growth: 42, real: 20 };
  return { safety: 30, growth: 48, real: 22 };
}

function toneForGap(gap: number): "low" | "fit" | "high" {
  if (Math.abs(gap) <= 6) return "fit";
  return gap < 0 ? "low" : "high";
}

function buildAllocation(summary: WealthSummary, score: number): RiskProfilePayload["allocation"] {
  const target = targetAllocationForScore(score);
  const source = new Map(summary.targetAllocation.map((item) => [item.label, item.current]));
  const safety = source.get("安全垫") ?? 0;
  const growth = source.get("成长资产") ?? 0;
  const real = source.get("实物与探索") ?? 0;

  return [
    {
      id: "safety",
      label: "安全垫",
      current: Math.round(safety),
      target: target.safety,
      gap: Math.round(safety - target.safety),
      tone: toneForGap(safety - target.safety),
      hint: "现金、储蓄和低波动资产，负责让你不被迫退出游戏。",
    },
    {
      id: "growth",
      label: "成长资产",
      current: Math.round(growth),
      target: target.growth,
      gap: Math.round(growth - target.growth),
      tone: toneForGap(growth - target.growth),
      hint: "股票和 ETF，负责学习行业、主题和周期，但不能替代纪律。",
    },
    {
      id: "real",
      label: "生活资产",
      current: Math.round(real),
      target: target.real,
      gap: Math.round(real - target.real),
      tone: toneForGap(real - target.real),
      hint: "房产、商品、汇率和创业，帮助你理解生活里的大额决策。",
    },
  ];
}

function buildRadar(score: number, summary: WealthSummary, answers: RiskProfileAnswer[]): RiskProfilePayload["radar"] {
  const optionScore = (questionId: string) => {
    const answer = answers.find((item) => item.questionId === questionId);
    if (!answer) return 58;
    return getOption(answer.questionId, answer.optionId).option?.score ?? 58;
  };

  const safetyScore = clamp(100 - score + summary.disciplineScore * 0.35, 20, 96);
  const growthScore = clamp(score * 0.85 + summary.diversificationScore * 0.15, 20, 96);
  const discipline = clamp(summary.disciplineScore, 20, 96);
  const diversification = clamp(summary.diversificationScore, 20, 96);
  const pressure = clamp(100 - optionScore("peer-pressure") * 0.65 + discipline * 0.25, 20, 96);
  const learning = clamp(optionScore("learning-style") * 0.55 + summary.riskScore * 0.25, 20, 96);

  return [
    {
      id: "safety",
      label: "安全垫意识",
      value: Math.round(safetyScore),
      hint: "能否先保留现金缓冲，而不是每次都满仓。",
    },
    {
      id: "growth",
      label: "成长承受力",
      value: Math.round(growthScore),
      hint: "面对高波动资产时，能否接受合理起伏。",
    },
    {
      id: "discipline",
      label: "交易纪律",
      value: Math.round(discipline),
      hint: "操作是否和原计划一致，是否避免频繁冲动下单。",
    },
    {
      id: "diversification",
      label: "分散配置",
      value: Math.round(diversification),
      hint: "是否把资金分配到不同风险来源里。",
    },
    {
      id: "pressure",
      label: "抗从众压力",
      value: Math.round(pressure),
      hint: "看到同学冲榜时，能否先复盘再行动。",
    },
    {
      id: "learning",
      label: "实验学习",
      value: Math.round(learning),
      hint: "是否愿意用小成本实验理解陌生资产。",
    },
  ];
}

function coachNextSteps(
  band: RiskProfileBand,
  allocation: RiskProfilePayload["allocation"],
  summary: WealthSummary,
) {
  const steps: string[] = [];
  const safety = allocation.find((item) => item.id === "safety");
  const growth = allocation.find((item) => item.id === "growth");
  const real = allocation.find((item) => item.id === "real");

  if (safety && safety.tone === "low") {
    steps.push("先把安全垫补到建议区间附近，再考虑扩大股票、ETF 或创业投入。");
  } else if (safety && safety.tone === "high") {
    steps.push("现金比例偏高时，可以用 1-2 个小仓位做学习实验，而不是一次性投入。");
  } else {
    steps.push("当前安全垫接近建议区间，可以把注意力放到复盘质量和资产分散上。");
  }

  if (growth && growth.tone === "high") {
    steps.push("成长资产偏高，下一次交易前先写下买入理由和最大可接受回撤。");
  } else if (growth && growth.tone === "low" && band !== "defensive") {
    steps.push("成长资产偏低，可以从 ETF 或小额股票观察仓开始，不急着重仓。");
  } else {
    steps.push("成长资产比例基本可控，继续用分批和复盘来替代情绪化追涨。");
  }

  if (real && real.tone === "high") {
    steps.push("房产、商品或创业占比偏高时，要特别检查流动性，避免下一回合现金紧张。");
  } else if (summary.riskScore >= 68) {
    steps.push("沙盘风险分偏高，本回合最值得练的是降集中度，而不是追求更高收益。");
  } else {
    steps.push("下一回合选择一个概念复盘：安全垫、分散、回撤或从众偏差，不要同时学太多。");
  }

  return steps.slice(0, 3);
}

export function buildRiskProfilePayload(
  run: ScenarioRun,
  answers: RiskProfileAnswer[] = defaultAnswers,
  now = new Date(),
): RiskProfilePayload {
  const selectedAnswers = normalizeRiskProfileAnswers(answers);
  const scores = selectedAnswers.map((answer) => getOption(answer.questionId, answer.optionId).option?.score ?? 58);
  const rawScore = scores.reduce((sum, value) => sum + value, 0) / Math.max(scores.length, 1);
  const summary = buildWealthSummary(run);
  const score = Math.round(clamp(rawScore * 0.78 + summary.riskScore * 0.14 + summary.diversificationScore * 0.08, 20, 96));
  const band = bandFromScore(score);
  const allocation = buildAllocation(summary, score);
  const radar = buildRadar(score, summary, selectedAnswers);

  return {
    generatedAt: now.toISOString(),
    score,
    ...band,
    current: {
      netWorth: summary.netWorth,
      riskScore: summary.riskScore,
      disciplineScore: summary.disciplineScore,
      diversificationScore: summary.diversificationScore,
      stageLabel: summary.stageLabel,
    },
    allocation,
    radar,
    coach: {
      title: `${band.label}的下一回合训练`,
      summary: "这份画像只用于教育模拟，目的是让你看懂自己的决策习惯，而不是给出真实买卖指令。",
      nextSteps: coachNextSteps(band.band, allocation, summary),
    },
    questions: riskProfileQuestions,
    selectedAnswers,
  };
}
