import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  createRoundPredictionForUser: vi.fn(),
  getSimulationStateForUser: vi.fn(),
}));
vi.mock("@/lib/billing/subscription", () => ({ canUserOperate: vi.fn() }));

import { requireUser } from "@/lib/api-guard";
import { apiError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createRoundPredictionForUser, getSimulationStateForUser } from "@/lib/db/repo";

import { makeScenarioRun } from "../../../../../tests/factories/run";
import { POST } from "./route";

function makeRequest(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

const STUDENT = {
  id: "student-1",
  role: "student",
  subscriptionTier: "premium",
  trialExpiresAt: null,
  subscriptionExpiresAt: null,
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;
const asState = (value: unknown) => value as Awaited<ReturnType<typeof getSimulationStateForUser>>;

describe("POST /api/sim/predict", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(canUserOperate).mockReturnValue(true);
    vi.mocked(createRoundPredictionForUser).mockResolvedValue({
      id: "pred-1",
      userId: "student-1",
      runId: "run-1",
      round: 3,
      guess: "up",
      resolved: false,
      correct: false,
      createdAt: "2026-06-18T00:00:00.000Z",
    });
    vi.mocked(getSimulationStateForUser).mockResolvedValue(asState({ run: makeScenarioRun() }));
  });

  it("records a valid prediction for an authorized student", async () => {
    const res = await POST(makeRequest({ guess: "up" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      prediction: { id: "pred-1", guess: "up", resolved: false },
      message: expect.any(String),
    });
    expect(vi.mocked(createRoundPredictionForUser)).toHaveBeenCalledWith("student-1", { guess: "up" });
  });

  it("rejects malformed input as invalid_input", async () => {
    const res = await POST(makeRequest({ guess: "flat" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
    expect(vi.mocked(createRoundPredictionForUser)).not.toHaveBeenCalled();
  });

  it("propagates auth and subscription blocks before writing", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      asRequireUser({ error: apiError("unauthorized", "请先登录后再预测。", 401) }),
    );
    expect((await POST(makeRequest({ guess: "up" }))).status).toBe(401);

    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(canUserOperate).mockReturnValue(false);
    const res = await POST(makeRequest({ guess: "up" }));
    expect(res.status).toBe(403);
    expect(vi.mocked(createRoundPredictionForUser)).not.toHaveBeenCalled();
  });

  it("maps duplicate predictions to invalid_input and DB failures to db_unavailable", async () => {
    vi.mocked(createRoundPredictionForUser).mockRejectedValueOnce(new Error("本回合已经提交过预测。"));
    const duplicate = await POST(makeRequest({ guess: "up" }));
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()).error).toBe("invalid_input");

    vi.mocked(createRoundPredictionForUser).mockRejectedValueOnce(new Error("postgres connection timeout"));
    const dbError = await POST(makeRequest({ guess: "down" }));
    expect(dbError.status).toBe(503);
    expect((await dbError.json()).error).toBe("db_unavailable");
  });
});
