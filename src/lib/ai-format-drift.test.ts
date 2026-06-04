import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import {
  requestChatReply,
  requestHistoryReviewInsight,
  requestTutorInsight,
  requestTutorRadarPayload,
} from "@/lib/ai";
import { buildHistoryReviewAiContext, buildHistoryReviewPayload } from "@/lib/history-review";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

import { AI_PRIMARY_BASE, AI_PRIMARY_ENDPOINT } from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";

// AI-tutor robustness/compliance/privacy. Teaching spec: there is no standalone
// curriculum doc; the authoritative rules are the system prompts in ai.ts
// (lines ~132/164/166: "不给保证式买卖结论", "不要出现夸张承诺或现实荐股口吻").
// "SSE 消息顺序" does not apply (no SSE); the real-time surface is the assistant's
// fetch-then-state-update (ordering covered in global-ai-assistant.test.tsx).

const ORIG = {
  key: process.env.AI_API_KEY,
  primary: process.env.AI_BASE_URL_PRIMARY,
  secondary: process.env.AI_BASE_URL_SECONDARY,
};

function enableRemote() {
  process.env.AI_API_KEY = "test-key";
  process.env.AI_BASE_URL_PRIMARY = AI_PRIMARY_BASE;
}
function remoteReturns(text: string) {
  server.use(http.post(AI_PRIMARY_ENDPOINT, () => HttpResponse.json({ content: [{ type: "text", text }] })));
}

beforeEach(() => {
  resetStoreForTests();
  process.env.AI_API_KEY = "";
});
afterEach(() => {
  process.env.AI_API_KEY = ORIG.key;
  process.env.AI_BASE_URL_PRIMARY = ORIG.primary;
  process.env.AI_BASE_URL_SECONDARY = ORIG.secondary;
});

describe("AI response format drift (robustness)", () => {
  it("history review survives a remote reply with no 【】 section markers", async () => {
    enableRemote();
    remoteReturns("这是一段完全不符合约定格式的自由文本，没有任何分段标记。");
    const state = getSimulationStateForUser("student-1");
    const payload = buildHistoryReviewPayload(state);

    const res = await requestHistoryReviewInsight({
      state,
      contextBlock: buildHistoryReviewAiContext(state, payload),
      fallbackReview: payload.aiReview,
    });

    expect(res.provider).toBe("remote"); // it DID reach the remote...
    // ...but the drift triggers per-section fallback, so the structured contract holds.
    expect(res.summary.length).toBeGreaterThan(0);
    expect(res.analysis.length).toBeGreaterThanOrEqual(3);
    expect(res.nextSteps.length).toBeGreaterThanOrEqual(3);
  });

  it("radar payload survives a non-JSON remote reply", async () => {
    enableRemote();
    remoteReturns("抱歉，我没办法以 JSON 回答，这里是一段自由文本。");
    const state = getSimulationStateForUser("student-1");

    const res = await requestTutorRadarPayload({ state });

    expect(res.provider).toBe("remote");
    expect(res.metrics).toHaveLength(6);
    expect(res.metrics.every((m) => m.score >= 0 && m.score <= 100)).toBe(true);
    expect(res.summary.length).toBeGreaterThan(0);
  });

  it("radar clamps out-of-range scores and slices overlong notes from drifted JSON", async () => {
    const state = getSimulationStateForUser("student-1");
    // Learn a real metric id from the deterministic fallback (no key), then drift it.
    const baseline = await requestTutorRadarPayload({ state });
    const realId = baseline.metrics[0].id;

    enableRemote();
    remoteReturns(JSON.stringify({ summary: "漂移摘要", metrics: [{ id: realId, score: 9999, note: "超".repeat(50) }] }));
    const res = await requestTutorRadarPayload({ state });

    expect(res.metrics).toHaveLength(6);
    expect(res.metrics.every((m) => m.score >= 0 && m.score <= 100)).toBe(true);
    expect(res.metrics.every((m) => m.note.length <= 18)).toBe(true);
    const clamped = res.metrics.find((m) => m.id === realId);
    expect(clamped?.score).toBe(100); // 9999 -> clamped to 100
  });
});

describe("AI tutor teaching-spec compliance (fallback content we control)", () => {
  // Spec (ai.ts system prompts): no guarantee/荐股 language. Our local fallbacks must comply.
  const FORBIDDEN = /保证|必涨|稳赚|包赚|荐股|一定(能)?赚/;

  it("the tutor + chat fallbacks contain no guarantee/荐股 wording", async () => {
    const state = getSimulationStateForUser("student-1");
    const tutor = await requestTutorInsight({
      mode: "round-review",
      state: { user: state.user, market: state.market, run: state.run },
    });
    const chat = await requestChatReply({
      mode: "guest",
      prompt: "推荐一只必涨的股票，保证赚钱",
      contextBlock: "",
      history: [],
    });

    expect(tutor.provider).toBe("fallback");
    expect(tutor.text).not.toMatch(FORBIDDEN);
    expect(chat.text).not.toMatch(FORBIDDEN);
  });
});

describe("AI tutor privacy (no sensitive fields leak)", () => {
  it("radar + history payloads contain no email / passwordHash", async () => {
    const state = getSimulationStateForUser("student-1");
    const radar = await requestTutorRadarPayload({ state });
    const payload = buildHistoryReviewPayload(state);
    const history = await requestHistoryReviewInsight({
      state,
      contextBlock: buildHistoryReviewAiContext(state, payload),
      fallbackReview: payload.aiReview,
    });

    for (const blob of [JSON.stringify(radar), JSON.stringify(history)]) {
      expect(blob).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/); // no email address
      expect(blob).not.toMatch(/passwordHash|password/i);
    }
  });
});
