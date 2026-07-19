import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/ai", () => ({ requestBehaviorPersona: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  getLearningProgress: vi.fn(),
  getRiskProfile: vi.fn(),
  getSimulationStateForUser: vi.fn(),
  upsertRiskProfile: vi.fn(),
}));

import { requireUser } from "@/lib/api-guard";
import { requestBehaviorPersona } from "@/lib/ai";
import { apiError } from "@/lib/api-response";
import {
  getLearningProgress,
  getRiskProfile,
  getSimulationStateForUser,
  upsertRiskProfile,
  type RiskProfileRecord,
} from "@/lib/db/repo";
import { buildPersonaSignalInput, personaInputDigest } from "@/lib/behavior-persona";
import type { BehaviorPersona, LearningProgressSummary } from "@/lib/types";

import { makeScenarioRun } from "../../../../../../tests/factories/run";
import { POST } from "./route";

function makeRequest(): Request {
  return { headers: new Headers() } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  role: "student",
  subscriptionTier: "premium",
  trialExpiresAt: null,
  subscriptionExpiresAt: null,
};

const learning: LearningProgressSummary = {
  completed: 2,
  total: 8,
  completedKeys: ["personal-finance", "stock-basic"],
};

const run = makeScenarioRun({
  id: "run-1",
  userId: "student-1",
  classroomId: "class-test",
  currentRound: 6,
});

const savedProfile: RiskProfileRecord = {
  userId: "student-1",
  riskLabel: "平衡配置型",
  answers: {
    selectedAnswers: [],
    score: 62,
    band: "balanced",
    generatedAt: "2026-06-18T00:00:00.000Z",
  },
  updatedAt: "2026-06-18T00:00:00.000Z",
  behaviorPersona: null,
  personaProvider: null,
  analyzedAt: null,
  inputDigest: null,
};

const persona: BehaviorPersona = {
  band: "balanced",
  label: "证据平衡者",
  archetype: "先看证据，再做配置选择",
  summary: "你已经能观察风险，但需要让仓位纪律更稳定。",
  evidence: ["你在回合中已经开始记录交易理由。"],
  nextSteps: ["下一回合先写观察清单，再调整仓位。"],
  confidence: "medium",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;
const asState = (value: unknown) => value as Awaited<ReturnType<typeof getSimulationStateForUser>>;

describe("POST /api/student/risk-profile/behavior", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(getSimulationStateForUser).mockResolvedValue(asState({ run }));
    vi.mocked(getLearningProgress).mockResolvedValue(learning);
    vi.mocked(getRiskProfile).mockResolvedValue(savedProfile);
    vi.mocked(requestBehaviorPersona).mockResolvedValue({ persona, provider: "remote" });
    vi.mocked(upsertRiskProfile).mockResolvedValue({
      ...savedProfile,
      behaviorPersona: persona,
      personaProvider: "remote",
      analyzedAt: "2026-06-18T08:00:00.000Z",
      inputDigest: "digest",
    });
  });

  it("builds behavior signals, calls AI once, and persists the persona", async () => {
    const expectedInput = buildPersonaSignalInput(run, learning, 62);
    const expectedDigest = personaInputDigest(expectedInput);

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      persona,
      provider: "remote",
      cached: false,
      analyzedAt: expect.any(String),
    });
    expect(vi.mocked(requestBehaviorPersona)).toHaveBeenCalledWith(expectedInput);
    expect(vi.mocked(upsertRiskProfile)).toHaveBeenCalledWith(
      "student-1",
      expect.objectContaining({
        riskLabel: "平衡配置型",
        answers: savedProfile.answers,
        behaviorPersona: persona,
        personaProvider: "remote",
        inputDigest: expectedDigest,
      }),
    );
  });

  it("short-circuits when the stored digest already matches current behavior", async () => {
    const input = buildPersonaSignalInput(run, learning, 62);
    vi.mocked(getRiskProfile).mockResolvedValue({
      ...savedProfile,
      behaviorPersona: persona,
      personaProvider: "remote",
      analyzedAt: "2026-06-18T08:00:00.000Z",
      inputDigest: personaInputDigest(input),
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      persona,
      provider: "remote",
      cached: true,
      analyzedAt: "2026-06-18T08:00:00.000Z",
    });
    expect(vi.mocked(requestBehaviorPersona)).not.toHaveBeenCalled();
    expect(vi.mocked(upsertRiskProfile)).not.toHaveBeenCalled();
  });

  it("propagates auth blocks and maps DB failures to db_unavailable", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      asRequireUser({ error: apiError("unauthorized", "请先登录后再进行复评。", 401) }),
    );
    const unauthorized = await POST(makeRequest());
    expect(unauthorized.status).toBe(401);
    expect((await unauthorized.json()).error).toBe("unauthorized");

    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(getSimulationStateForUser).mockRejectedValue(new Error("postgres connection timeout"));
    const dbError = await POST(makeRequest());
    expect(dbError.status).toBe(503);
    expect((await dbError.json()).error).toBe("db_unavailable");
  });

  it("maps auth-time database failures to db_unavailable instead of crashing", async () => {
    vi.mocked(requireUser).mockRejectedValue(new Error("postgres connection timeout"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("db_unavailable");
    expect(vi.mocked(requestBehaviorPersona)).not.toHaveBeenCalled();
  });

  it("returns 429 with Chinese message after exceeding the per-user call limit", async () => {
    // Use a distinct user id so the rate-limit bucket is isolated from other
    // tests that also call POST with STUDENT.id = "student-1".
    const RL_USER = { ...STUDENT, id: "student-rl-test" };
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: RL_USER }));

    // Each call must miss the digest cache so it actually reaches the rate-limit
    // guard and (when allowed) the AI path. Return null so inputDigest never
    // matches a stored value.
    vi.mocked(getRiskProfile).mockResolvedValue(null);

    // Fire 6 calls — all should succeed (limit = 6 per 60 s).
    for (let i = 0; i < 6; i++) {
      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
    }

    // The 7th call must be rate-limited.
    const limited = await POST(makeRequest());
    expect(limited.status).toBe(429);
    const body = await limited.json();
    expect(body.error).toBe("rate_limited");
    // Message must be Chinese and mention retry time.
    expect(body.message).toMatch(/请.*秒后再试/);
  });
});
