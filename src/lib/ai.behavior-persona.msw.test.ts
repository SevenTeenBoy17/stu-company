import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http } from "msw";

import { buildBehaviorPersonaSystemPrompt, requestBehaviorPersona } from "@/lib/ai";
import { ruleFallbackPersona, type PersonaSignalInput } from "@/lib/behavior-persona";
import type { BehaviorPersona } from "@/lib/types";

import {
  AI_PRIMARY_BASE,
  AI_PRIMARY_ENDPOINT,
  aiMessage,
} from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";

const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL_PRIMARY: process.env.AI_BASE_URL_PRIMARY,
  AI_BASE_URL_SECONDARY: process.env.AI_BASE_URL_SECONDARY,
  BROWN_AGENT_API_KEY: process.env.BROWN_AGENT_API_KEY,
  BROWN_AGENT_BASE_URL: process.env.BROWN_AGENT_BASE_URL,
  BROWN_AGENT_FALLBACK_BASE_URL: process.env.BROWN_AGENT_FALLBACK_BASE_URL,
};

const personaInput: PersonaSignalInput = {
  currentRound: 6,
  totalRounds: 12,
  adaptiveEvents: [
    {
      id: "overtrade",
      title: "频繁追涨",
      teachingPoint: "连续追涨会放大回撤，先验证理由再行动。",
      confidence: "high",
      tone: "warning",
      riskDirection: "up",
    },
  ],
  radar: [
    { id: "risk-control", label: "风险控制", score: 44 },
    { id: "diversification", label: "分散配置", score: 52 },
    { id: "position-discipline", label: "仓位纪律", score: 48 },
  ],
  wealth: {
    riskScore: 72,
    disciplineScore: 48,
    diversificationScore: 52,
    netWorth: 118_400,
    stageLabel: "波动放大期",
  },
  actionCounts: {
    trade: 9,
    bank: 1,
    learning_completed: 3,
  },
  netWorthTrend: [100_000, 104_200, 111_300, 108_900, 116_200, 118_400],
  questionnaireScore: 62,
  coachNextSteps: ["先写下交易理由，再决定是否下单。", "把单一资产仓位压回可承受区间。"],
};

function restoreEnv() {
  process.env.AI_API_KEY = originalEnv.AI_API_KEY;
  process.env.AI_BASE_URL_PRIMARY = originalEnv.AI_BASE_URL_PRIMARY;
  process.env.AI_BASE_URL_SECONDARY = originalEnv.AI_BASE_URL_SECONDARY;
  process.env.BROWN_AGENT_API_KEY = originalEnv.BROWN_AGENT_API_KEY;
  process.env.BROWN_AGENT_BASE_URL = originalEnv.BROWN_AGENT_BASE_URL;
  process.env.BROWN_AGENT_FALLBACK_BASE_URL = originalEnv.BROWN_AGENT_FALLBACK_BASE_URL;
}

function clearAiEnv() {
  delete process.env.AI_API_KEY;
  delete process.env.AI_BASE_URL_PRIMARY;
  delete process.env.AI_BASE_URL_SECONDARY;
  delete process.env.BROWN_AGENT_API_KEY;
  delete process.env.BROWN_AGENT_BASE_URL;
  delete process.env.BROWN_AGENT_FALLBACK_BASE_URL;
}

describe("buildBehaviorPersonaSystemPrompt band-judgment rules", () => {
  it("contains band-judgment rules for overtrade/leverage/concentration → not below balanced", () => {
    const prompt = buildBehaviorPersonaSystemPrompt();
    expect(prompt).toContain("过度交易");
    expect(prompt).toContain("杠杆");
    expect(prompt).toContain("集中");
    expect(prompt).toContain("不低于 balanced");
    // The phrase "不低于" must not precede "defensive" as the target threshold
    expect(prompt).not.toContain("不低于 defensive");
  });

  it("contains rule that high diversification should not be judged defensive", () => {
    const prompt = buildBehaviorPersonaSystemPrompt();
    expect(prompt).toContain("高分散");
    expect(prompt).toMatch(/高分散.*不要判 defensive/);
  });

  it("contains rule that low activity + cash hoarding → defensive", () => {
    const prompt = buildBehaviorPersonaSystemPrompt();
    expect(prompt).toContain("囤现金");
    expect(prompt).toMatch(/囤现金.*应判 defensive|应判 defensive/);
  });

  it("contains the full band enum", () => {
    const prompt = buildBehaviorPersonaSystemPrompt();
    expect(prompt).toContain("defensive");
    expect(prompt).toContain("steady");
    expect(prompt).toContain("balanced");
    expect(prompt).toContain("growth");
  });

  it("contains rule that cash buffer with diversified holdings is not cash hoarding", () => {
    const prompt = buildBehaviorPersonaSystemPrompt();
    expect(prompt).toContain("现金安全垫");
    expect(prompt).toContain("不等于囤现金");
  });
});

describe("requestBehaviorPersona AI gateway boundary (MSW)", () => {
  beforeEach(() => {
    clearAiEnv();
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns a remote behavior persona when the provider returns valid JSON", async () => {
    const remotePersona: BehaviorPersona = {
      band: "balanced",
      label: "证据平衡者",
      archetype: "先看证据，再做配置选择",
      summary: "你已经能观察风险，但需要让仓位纪律更稳定。",
      evidence: ["频繁追涨提示你容易被短期波动带走。"],
      nextSteps: ["下一回合先写观察清单，再调整仓位。"],
      confidence: "medium",
    };

    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL_PRIMARY = AI_PRIMARY_BASE;
    server.use(http.post(AI_PRIMARY_ENDPOINT, () => aiMessage(JSON.stringify(remotePersona))));

    const result = await requestBehaviorPersona(personaInput);

    expect(result.provider).toBe("remote");
    expect(result.persona).toMatchObject(remotePersona);
  });

  it("returns the rule fallback persona when AI is not configured", async () => {
    const fallback = ruleFallbackPersona(personaInput);

    const result = await requestBehaviorPersona(personaInput);

    expect(result.provider).toBe("fallback");
    expect(result.persona).toEqual(fallback);
  });

  it("repairs garbage provider text to the rule fallback and never throws", async () => {
    const fallback = ruleFallbackPersona(personaInput);

    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL_PRIMARY = AI_PRIMARY_BASE;
    server.use(http.post(AI_PRIMARY_ENDPOINT, () => aiMessage("not-json-at-all")));

    await expect(requestBehaviorPersona(personaInput)).resolves.toEqual({
      persona: fallback,
      provider: "remote",
    });
  });
});
