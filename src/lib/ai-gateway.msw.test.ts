import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { requestTutorInsight } from "@/lib/ai";
import { getSimulationStateForUser, resetStoreForTests } from "@/lib/store";

import {
  AI_PRIMARY_BASE,
  AI_PRIMARY_ENDPOINT,
  AI_SECONDARY_BASE,
  AI_SECONDARY_ENDPOINT,
} from "../../tests/msw/handlers";
import { server } from "../../tests/msw/server";

// MSW coverage of the AI gateway's network boundary (src/lib/ai.ts -> POST
// `${base}/v1/messages`). Replaces the brittle vi.spyOn(globalThis,"fetch")
// failover test that previously lived in ai.test.ts. Assertions target BEHAVIOR
// (which base url answered, provider) not mock call-counts (TEST-STRATEGY R9).

const originalEnv = {
  AI_API_KEY: process.env.AI_API_KEY,
  AI_BASE_URL_PRIMARY: process.env.AI_BASE_URL_PRIMARY,
  AI_BASE_URL_SECONDARY: process.env.AI_BASE_URL_SECONDARY,
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  process.env.AI_API_KEY = originalEnv.AI_API_KEY;
  process.env.AI_BASE_URL_PRIMARY = originalEnv.AI_BASE_URL_PRIMARY;
  process.env.AI_BASE_URL_SECONDARY = originalEnv.AI_BASE_URL_SECONDARY;
});
afterAll(() => server.close());

function tutorRequest() {
  const state = getSimulationStateForUser("student-1");
  return requestTutorInsight({
    mode: "round-review",
    state: { user: state.user, market: state.market, run: state.run },
  });
}

describe("ai gateway network boundary (MSW)", () => {
  beforeEach(() => {
    resetStoreForTests();
    process.env.AI_API_KEY = "test-key";
    process.env.AI_BASE_URL_PRIMARY = AI_PRIMARY_BASE;
    process.env.AI_BASE_URL_SECONDARY = AI_SECONDARY_BASE;
  });

  it("fails over to the secondary base url when the primary returns 500", async () => {
    server.use(
      http.post(AI_PRIMARY_ENDPOINT, () => new HttpResponse("upstream error", { status: 500 })),
      http.post(AI_SECONDARY_ENDPOINT, () =>
        HttpResponse.json({ content: [{ type: "text", text: "第二地址返回的 AI 建议" }] }),
      ),
    );

    const response = await tutorRequest();

    expect(response.provider).toBe("remote");
    expect(response.baseUrl).toBe(AI_SECONDARY_BASE);
    expect(response.text).toContain("AI 建议");
  });

  it("uses the primary base url when it answers 200", async () => {
    server.use(
      http.post(AI_PRIMARY_ENDPOINT, () =>
        HttpResponse.json({ content: [{ type: "text", text: "主地址 AI 建议" }] }),
      ),
    );

    const response = await tutorRequest();

    expect(response.provider).toBe("remote");
    expect(response.baseUrl).toBe(AI_PRIMARY_BASE);
  });

  it("falls back to the local narrative when BOTH base urls fail", async () => {
    server.use(
      http.post(AI_PRIMARY_ENDPOINT, () => new HttpResponse(null, { status: 500 })),
      http.post(AI_SECONDARY_ENDPOINT, () => new HttpResponse(null, { status: 503 })),
    );

    const response = await tutorRequest();

    expect(response.provider).toBe("fallback");
    expect(response.text).toContain("Mr.Brown");
  });
});
