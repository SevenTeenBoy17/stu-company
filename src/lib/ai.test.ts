import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestAllocationInsight,
  requestChatReply,
  requestHistoryReviewInsight,
  requestTutorInsight,
  requestTutorRadarPayload,
} from "@/lib/ai";
import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL_PRIMARY: process.env.AI_BASE_URL_PRIMARY,
  AI_BASE_URL_SECONDARY: process.env.AI_BASE_URL_SECONDARY,
};

// NOTE: the primary->secondary failover test was migrated to ai-gateway.msw.test.ts
// (MSW network-boundary mock) and removed from here. The cases below all exercise
// the local-fallback path (no API key -> no network), so they need no HTTP mock.

describe("ai tutor", () => {
  beforeEach(() => {
    resetStoreForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.AI_API_KEY = originalEnv.AI_API_KEY;
    process.env.AI_BASE_URL_PRIMARY = originalEnv.AI_BASE_URL_PRIMARY;
    process.env.AI_BASE_URL_SECONDARY = originalEnv.AI_BASE_URL_SECONDARY;
  });

  it("falls back to local narrative when no key is configured", async () => {
    process.env.AI_API_KEY = "";
    const state = getSimulationStateForUser("student-1");
    const response = await requestTutorInsight({
      mode: "round-review",
      state: {
        user: state.user,
        market: state.market,
        run: state.run,
      },
    });

    expect(response.provider).toBe("fallback");
    expect(response.text).toContain("Mr.Brown");
  });

  it("builds a local chat fallback when no key is configured", async () => {
    process.env.AI_API_KEY = "";

    const response = await requestChatReply({
      mode: "guest",
      prompt: "Brown Zone 是什么？",
      contextBlock: "当前模式：游客通用问答。",
      history: [],
    });

    expect(response.provider).toBe("fallback");
    expect(response.text).toContain("Brown Zone");
  });

  it("builds a local allocation insight when no key is configured", async () => {
    process.env.AI_API_KEY = "";
    const state = getSimulationStateForUser("student-1");

    const response = await requestAllocationInsight({
      state,
      contextBlock: "当前配置：持有资产 42%，可用现金 20%。",
      fallbackText: "本地配置建议：先把流动性补回安全线。",
    });

    expect(response.provider).toBe("fallback");
    expect(response.text).toContain("流动性");
  });

  it("builds a structured history review fallback when no key is configured", async () => {
    process.env.AI_API_KEY = "";
    const state = getSimulationStateForUser("student-1");
    const payload = buildHistoryReviewPayload(state);

    const response = await requestHistoryReviewInsight({
      state,
      contextBlock: buildHistoryReviewAiContext(state, payload),
      fallbackReview: payload.aiReview,
    });

    expect(response.provider).toBe("fallback");
    expect(response.summary).toContain("回合");
    expect(response.analysis.length).toBeGreaterThanOrEqual(3);
    expect(response.nextSteps.length).toBeGreaterThanOrEqual(3);
  });

  it("builds tutor radar metrics when no key is configured", async () => {
    process.env.AI_API_KEY = "";
    const state = getSimulationStateForUser("student-1");

    const response = await requestTutorRadarPayload({
      state,
    });

    expect(response.provider).toBe("fallback");
    expect(response.metrics).toHaveLength(6);
    expect(response.metrics.every((metric) => metric.score >= 0 && metric.score <= 100)).toBe(true);
    expect(response.summary).toContain("当前");
  });
});
