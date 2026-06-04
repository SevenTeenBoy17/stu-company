import { beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

// Dependency overrides (the FastAPI dependency_overrides analog): the route's
// auth guard, repo (DB), and subscription gate are mocked; handleRouteError,
// detectAdaptiveEvents and the zod schema run for real so we test the real
// validation + error-contract behaviour of the endpoint itself.
vi.mock("@/lib/api-guard", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/db/repo", () => ({
  applyActionForUser: vi.fn(),
  getSimulationStateForUser: vi.fn(),
}));
vi.mock("@/lib/billing/subscription", () => ({ canUserOperate: vi.fn() }));

import { requireUser } from "@/lib/api-guard";
import { apiError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { applyActionForUser, getSimulationStateForUser } from "@/lib/db/repo";

import { makeScenarioRun } from "../../../../../tests/factories/run";
import { POST } from "./route";

// The handler only ever reads request.json(), so a tiny stub is enough and avoids
// jsdom/undici Request incompatibilities.
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

const validTrade = {
  type: "trade",
  assetId: "asset-stock-1",
  side: "buy",
  quantity: 10,
  orderMode: "market",
};

const asRequireUser = (value: unknown) => value as Awaited<ReturnType<typeof requireUser>>;
const asState = (value: unknown) => value as Awaited<ReturnType<typeof getSimulationStateForUser>>;

describe("POST /api/sim/actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Happy defaults: authenticated student, allowed to operate, real-shaped run.
    vi.mocked(requireUser).mockResolvedValue(asRequireUser({ user: STUDENT }));
    vi.mocked(canUserOperate).mockReturnValue(true);
    vi.mocked(getSimulationStateForUser).mockResolvedValue(asState({ run: makeScenarioRun() }));
  });

  // --- happy path / CRUD ---
  it("applies a valid trade for an authorized student (200)", async () => {
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe("操作已生效。");
    expect(Array.isArray(json.adaptiveEvents)).toBe(true);
    expect(vi.mocked(applyActionForUser)).toHaveBeenCalledWith("student-1", validTrade);
  });

  it("accepts a valid bank action", async () => {
    const res = await POST(makeRequest({ type: "bank", action: "deposit", amount: 5000 }));
    expect(res.status).toBe(200);
  });

  // --- authentication / authorization ---
  it("propagates the guard's 401 when unauthenticated", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      asRequireUser({ error: apiError("unauthorized", "请先登录后再访问这个接口。", 401) }),
    );
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("unauthorized");
    expect(vi.mocked(applyActionForUser)).not.toHaveBeenCalled();
  });

  it("propagates the guard's 403 for a non-student role", async () => {
    vi.mocked(requireUser).mockResolvedValue(
      asRequireUser({ error: apiError("forbidden", "当前账号没有该接口权限。", 403) }),
    );
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
  });

  it("returns 403 when the subscription/trial may not operate", async () => {
    vi.mocked(canUserOperate).mockReturnValue(false);
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe("forbidden");
    expect(json.message).toMatch(/试用/);
    expect(vi.mocked(applyActionForUser)).not.toHaveBeenCalled();
  });

  // --- input validation (zod = "Pydantic") ---
  it.each([
    ["empty object", {}],
    ["unknown action type", { type: "hack" }],
    ["trade missing fields", { type: "trade", assetId: "a" }],
    ["non-positive quantity", { type: "trade", assetId: "a", side: "buy", quantity: -5, orderMode: "market" }],
    ["string amount (no coercion)", { type: "bank", action: "deposit", amount: "100" }],
    ["bad enum", { type: "bank", action: "transfer", amount: 100 }],
  ])("rejects %s as invalid_input (400, never 500)", async (_label, body) => {
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
    expect(vi.mocked(applyActionForUser)).not.toHaveBeenCalled();
  });

  // --- error-contract mapping (front-end contract consistency) ---
  it("maps a business error to invalid_input (400)", async () => {
    vi.mocked(applyActionForUser).mockRejectedValue(new Error("现金不足，无法买入。"));
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
  });

  it("maps a database error to db_unavailable (503)", async () => {
    vi.mocked(applyActionForUser).mockRejectedValue(new Error("postgres connection timeout"));
    const res = await POST(makeRequest(validTrade));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("db_unavailable");
  });

  // --- property-based (Hypothesis analog): no malformed input ever 500s ---
  it("never 500s on arbitrary malformed bodies (always invalid_input/400)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant({}),
          fc.record({ type: fc.constantFrom("hack", "evil", "trade2", "") }),
          // right type, missing/invalid fields:
          fc.record({ type: fc.constant("trade"), quantity: fc.integer() }),
          fc.record({ type: fc.constant("bank"), action: fc.constant("deposit"), amount: fc.constant(-1) }),
        ),
        async (body) => {
          const res = await POST(makeRequest(body));
          expect(res.status).toBe(400);
          expect((await res.json()).error).toBe("invalid_input");
        },
      ),
      { numRuns: 50 },
    );
  });
});
