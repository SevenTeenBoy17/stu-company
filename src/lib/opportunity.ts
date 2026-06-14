import type { ScenarioRun } from "@/lib/types";
import { clamp, createId } from "@/lib/utils";

export type OpportunityThemeId = "ai-infra" | "steady-cashflow" | "green-energy" | "safe-haven";
export type OpportunityReason = "capital" | "policy" | "valuation" | "risk-release" | "learning";

export interface OpportunityCard {
  id: OpportunityThemeId;
  title: string;
  category: "科技成长" | "稳健现金流" | "能源转型" | "避险资产";
  heat: number;
  risk: number;
  concept: string;
  summary: string;
  evidence: string[];
  watchQuestion: string;
}

export interface OpportunityNoteInput {
  cardId: OpportunityThemeId;
  reason: OpportunityReason;
  confidence: number;
  note: string;
}

export interface OpportunityNote {
  id: string;
  cardId: OpportunityThemeId;
  title: string;
  reason: OpportunityReason;
  reasonLabel: string;
  confidence: number;
  score: number;
  note: string;
  createdAt: string;
  round: number;
  feedback: string;
}

export interface OpportunityPayload {
  generatedAt: string;
  overview: {
    stageLabel: string;
    notesCount: number;
    observationScore: number;
    bestTheme: string;
    classroomPrompt: string;
  };
  cards: OpportunityCard[];
  notes: OpportunityNote[];
  reasonOptions: Array<{ id: OpportunityReason; label: string; hint: string }>;
  coach: {
    title: string;
    summary: string;
    nextSteps: string[];
  };
}

export const opportunityCards: OpportunityCard[] = [
  {
    id: "ai-infra",
    title: "AI 算力与基础设施",
    category: "科技成长",
    heat: 88,
    risk: 72,
    concept: "高成长主题通常伴随高波动。先看需求是否真实，再看估值是否过热。",
    summary: "云厂商、芯片和服务器需求仍然强，但短期价格可能被情绪推得太快。",
    evidence: ["算力需求上升", "估值分歧扩大", "供应链集中度高"],
    watchQuestion: "如果热度下降，你还能说清楚它的长期逻辑吗？",
  },
  {
    id: "steady-cashflow",
    title: "稳定现金流资产",
    category: "稳健现金流",
    heat: 64,
    risk: 38,
    concept: "现金流像安全垫，能降低组合在坏天气里的摇晃。",
    summary: "债券、储蓄和部分稳健资产不耀眼，但能保护下一次行动机会。",
    evidence: ["回撤较小", "收益节奏稳定", "适合做组合底仓"],
    watchQuestion: "你的组合里有没有足够的“慢变量”？",
  },
  {
    id: "green-energy",
    title: "能源转型与效率升级",
    category: "能源转型",
    heat: 73,
    risk: 61,
    concept: "政策支持不等于立刻上涨，行业周期和企业现金流同样重要。",
    summary: "新能源、储能和效率升级有长期故事，但价格会被补贴、需求和产能影响。",
    evidence: ["政策主题清晰", "需求阶段波动", "产能扩张带来竞争"],
    watchQuestion: "这是长期趋势，还是短期题材？",
  },
  {
    id: "safe-haven",
    title: "黄金与避险资产",
    category: "避险资产",
    heat: 69,
    risk: 45,
    concept: "避险资产不是永远上涨，而是在不确定时提供组合缓冲。",
    summary: "当市场情绪紧张时，避险资产常被关注，但也会受利率和汇率影响。",
    evidence: ["不确定性上升", "组合对冲需求", "受利率变化影响"],
    watchQuestion: "你关注的是保护，还是追涨？",
  },
];

export const opportunityReasonOptions: OpportunityPayload["reasonOptions"] = [
  { id: "capital", label: "资金流入", hint: "市场的钱正在往这个方向集中，但要小心拥挤交易。" },
  { id: "policy", label: "政策支持", hint: "政策能改变行业预期，但不能替代企业经营质量。" },
  { id: "valuation", label: "估值回落", hint: "价格变便宜不代表风险消失，要看基本逻辑是否还在。" },
  { id: "risk-release", label: "风险释放", hint: "坏消息落地后，市场有时会重新定价。" },
  { id: "learning", label: "课堂概念", hint: "选择它是为了练一个概念，而不是为了立刻模拟买入。" },
];

function reasonLabel(reason: OpportunityReason) {
  return opportunityReasonOptions.find((item) => item.id === reason)?.label ?? "观察理由";
}

function opportunityEntries(run: ScenarioRun) {
  return run.actionLog.filter((entry) => entry.type === "opportunity" && entry.meta?.kind === "opportunity_note");
}

function readableNote(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (!text || /\?{4,}/.test(text) || text.includes("\uFFFD")) return fallback;
  return text.slice(0, 240);
}

function buildFeedback(input: OpportunityNoteInput, card: OpportunityCard, score: number) {
  if (input.note.trim().length < 18) {
    return "观察单还偏短。可以补一句：这个主题的风险在哪里，以及下一步要验证什么。";
  }
  if (input.confidence > 80 && card.risk > 65) {
    return "你很有信心，但这个主题波动较高。把“如果判断错了怎么办”写清楚，会更像成熟投资者。";
  }
  if (score >= 82) {
    return "这张观察单有证据、有风险、有下一步验证动作，可以进入后续复盘。";
  }
  return "方向是对的。下一步把理由从“感觉不错”升级为“哪条证据支持它”。";
}

function toNote(entry: ScenarioRun["actionLog"][number]): OpportunityNote | null {
  const meta = entry.meta ?? {};
  const cardId = meta.cardId as OpportunityThemeId | undefined;
  const card = opportunityCards.find((item) => item.id === cardId);
  if (!card) return null;
  const reason = (meta.reason as OpportunityReason | undefined) ?? "learning";
  return {
    id: entry.id,
    cardId: card.id,
    title: card.title,
    reason,
    reasonLabel: typeof meta.reasonLabel === "string" ? meta.reasonLabel : reasonLabel(reason),
    confidence: typeof meta.confidence === "number" ? meta.confidence : 50,
    score: typeof meta.score === "number" ? meta.score : 60,
    note: readableNote(meta.note, "这条旧观察单的文字无法识别，建议重新记录一次证据和风险。"),
    createdAt: entry.timestamp,
    round: entry.round,
    feedback: readableNote(meta.feedback, "已记录为课堂观察。下一步请补充证据、风险和验证动作。"),
  };
}

function dedupeNotes(notes: OpportunityNote[]) {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.round}|${note.cardId}|${note.reason}|${note.confidence}|${note.note}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildOpportunityPayload(run: ScenarioRun): OpportunityPayload {
  const notes = dedupeNotes(opportunityEntries(run).map(toNote).filter((item): item is OpportunityNote => Boolean(item)));
  const latest = run.snapshots.at(-1);
  const observationScore = clamp(
    56 + notes.length * 8 + (latest?.disciplineScore ?? 70) * 0.18 - (latest?.riskScore ?? 50) * 0.08,
    38,
    96,
  );
  const bestTheme =
    notes.length > 0
      ? notes.slice().sort((a, b) => b.score - a.score)[0]?.title ?? "尚未形成主题"
      : "尚未形成主题";

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      stageLabel: notes.length >= 3 ? "形成观察习惯" : notes.length >= 1 ? "开始建立证据链" : "等待第一张观察单",
      notesCount: notes.length,
      observationScore: Math.round(observationScore),
      bestTheme,
      classroomPrompt: "本周目标：先写观察单，再决定是否进入模拟配置。",
    },
    cards: opportunityCards,
    notes,
    reasonOptions: opportunityReasonOptions,
    coach: {
      title: "Mr.Brown 的机会训练提示",
      summary:
        "机会不是“立刻行动”的同义词。对 14-19 岁学生来说，更重要的是练习看见证据、说清风险、写下验证动作。",
      nextSteps: [
        "选择一个主题，写下至少 20 个字的观察理由。",
        "给信心打分时保留一点余地，避免把热度当确定性。",
        "下一回合回来看看：证据有没有变，风险有没有被放大。",
      ],
    },
  };
}

export function createOpportunityNote(run: ScenarioRun, input: OpportunityNoteInput) {
  const card = opportunityCards.find((item) => item.id === input.cardId);
  if (!card) {
    throw new Error("未找到对应的机会主题。");
  }

  const confidence = clamp(Math.round(input.confidence), 1, 100);
  const note = input.note.trim();
  if (note.length < 8) {
    throw new Error("观察理由太短，请至少写清楚一条证据或风险。");
  }

  const evidenceScore = Math.min(24, note.length * 0.9);
  const balanceBonus = confidence <= 78 || card.risk <= 55 ? 12 : 4;
  const score = Math.round(clamp(42 + evidenceScore + balanceBonus + (100 - card.risk) * 0.14, 40, 96));
  const feedback = buildFeedback({ ...input, confidence, note }, card, score);
  const nextRun: ScenarioRun = {
    ...run,
    actionLog: [
      {
        id: createId("opp"),
        round: run.currentRound,
        type: "opportunity",
        label: `机会观察：${card.title}`,
        amount: 0,
        timestamp: new Date().toISOString(),
        meta: {
          kind: "opportunity_note",
          cardId: card.id,
          reason: input.reason,
          reasonLabel: reasonLabel(input.reason),
          confidence,
          note,
          score,
          feedback,
        },
      },
      ...run.actionLog,
    ],
  };

  return {
    run: nextRun,
    note: toNote(nextRun.actionLog[0])!,
    payload: buildOpportunityPayload(nextRun),
  };
}
