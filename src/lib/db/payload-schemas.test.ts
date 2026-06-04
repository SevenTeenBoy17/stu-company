import { describe, expect, it } from "vitest";

import {
  ActionLogArraySchema,
  ActionLogSchema,
  HoldingSchema,
  PortfolioSnapshotSchema,
} from "@/lib/db/payload-schemas";

// TEST-STRATEGY §4 R8: JSONB boundary schemas must turn malformed data into a
// controlled parse error (-> invalid_input upstream), never a TypeError/500 — and
// must NOT coerce wrong types. AI-written code tends to trust JSONB shape; these
// schemas are the guard, so they get fuzzed directly.

const validAction = { id: "a1", type: "trade", label: "买入", round: 1, amount: 1000 };

describe("payload schemas (R8 — malformed JSONB surfaces as a boundary error)", () => {
  it("accepts a valid action log and passes unknown fields through (.passthrough)", () => {
    const parsed = ActionLogSchema.parse({ ...validAction, extra: "kept" });
    expect(parsed.type).toBe("trade");
    expect((parsed as Record<string, unknown>).extra).toBe("kept");
  });

  it("rejects an action type outside the 6-value enum", () => {
    const res = ActionLogSchema.safeParse({ ...validAction, type: "hack" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((issue) => issue.path.includes("type"))).toBe(true);
    }
  });

  it("rejects wrong field types instead of coercing them", () => {
    expect(ActionLogSchema.safeParse({ ...validAction, amount: "1000" }).success).toBe(false);
    expect(ActionLogSchema.safeParse({ ...validAction, round: "1" }).success).toBe(false);
  });

  it("rejects holdings missing a required field or with a wrong type", () => {
    expect(HoldingSchema.safeParse({ assetId: "x", quantity: 1 }).success).toBe(false); // no averageCost
    expect(HoldingSchema.safeParse({ assetId: "x", quantity: "1", averageCost: 1 }).success).toBe(false);
  });

  it("validates the four numeric snapshot fields", () => {
    expect(
      PortfolioSnapshotSchema.safeParse({ round: 1, netWorth: 1, riskScore: 1, disciplineScore: 1 })
        .success,
    ).toBe(true);
    expect(
      PortfolioSnapshotSchema.safeParse({ round: 1, netWorth: "1", riskScore: 1, disciplineScore: 1 })
        .success,
    ).toBe(false);
  });

  it("array schema rejects a non-array and any malformed element", () => {
    expect(ActionLogArraySchema.safeParse("not-an-array").success).toBe(false);
    expect(ActionLogArraySchema.safeParse([validAction, { ...validAction, type: "nope" }]).success).toBe(
      false,
    );
    expect(ActionLogArraySchema.safeParse([validAction]).success).toBe(true);
  });
});
