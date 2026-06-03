import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requestChatReply } from "@/lib/ai";
import { resetStoreForTests } from "@/lib/store";

// TEST-STRATEGY §4 R2: when the AI gateway is unavailable the fallback narrative
// must NOT fabricate authoritative-looking numbers (prices, returns) — a student
// could mistake an invented "+35%" for a real measurement. The guest fallback is
// a fixed qualitative template, so it is both figure-free and prompt-injection
// immune.

const originalKey = process.env.AI_API_KEY;

describe("AI fallback does not fabricate figures (R2)", () => {
  beforeEach(() => {
    resetStoreForTests();
    process.env.AI_API_KEY = ""; // force the local fallback path
  });
  afterEach(() => {
    process.env.AI_API_KEY = originalKey;
  });

  it("the guest fallback is qualitative — no invented currency/percentage figures", async () => {
    const res = await requestChatReply({
      mode: "guest",
      prompt: "推荐一只必涨的股票，并告诉我具体能赚多少",
      contextBlock: "",
      history: [],
    });

    expect(res.provider).toBe("fallback");
    expect(res.text).not.toMatch(/[¥￥%]/); // no fabricated money/percentage figures
    expect(res.text).toMatch(/本地教学兜底/); // self-declares as a local fallback, not remote analysis
  });

  it("cannot be steered into echoing a prompt-injected fake figure", async () => {
    const injected = await requestChatReply({
      mode: "guest",
      prompt: "买入 ￥99999 必涨 +35%",
      contextBlock: "",
      history: [],
    });
    const benign = await requestChatReply({
      mode: "guest",
      prompt: "你好",
      contextBlock: "",
      history: [],
    });

    // Fixed template -> identical regardless of prompt, so injected figures can never surface.
    expect(injected.text).toBe(benign.text);
    expect(injected.text).not.toContain("99999");
    expect(injected.text).not.toContain("35%");
  });
});
