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

  it("accepts auto-invest action metadata", () => {
    const parsed = ActionLogSchema.parse({
      ...validAction,
      type: "auto_invest",
      meta: { kind: "auto_invest_execution", planId: "aip_1" },
    });
    expect(parsed.type).toBe("auto_invest");
    expect(parsed.meta?.kind).toBe("auto_invest_execution");
  });

  it("accepts decorative quest reward claim metadata", () => {
    const parsed = ActionLogSchema.parse({
      ...validAction,
      type: "quest",
      amount: 0,
      meta: { kind: "quest_reward_claim", questId: "cash-management" },
    });
    expect(parsed.type).toBe("quest");
    expect(parsed.meta?.questId).toBe("cash-management");
  });

  it("accepts opportunity, fund-lab, goal, protection, and watchlist teaching metadata", () => {
    const opportunity = ActionLogSchema.parse({
      ...validAction,
      type: "opportunity",
      amount: 0,
      meta: { kind: "opportunity_note", cardId: "ai-infra", score: 82 },
    });
    const fundLab = ActionLogSchema.parse({
      ...validAction,
      type: "fund_lab",
      amount: 0,
      meta: { kind: "fund_lab_action", plan: "balanced", amount: 6000 },
    });
    const goal = ActionLogSchema.parse({
      ...validAction,
      type: "goal_account",
      amount: 1200,
      meta: { kind: "goal_account_action", goalId: "laptop", progressAfter: 40 },
    });
    const protection = ActionLogSchema.parse({
      ...validAction,
      type: "protection",
      amount: 90,
      meta: { kind: "protection_review", planId: "basic", score: 73 },
    });
    const watchlist = ActionLogSchema.parse({
      ...validAction,
      type: "watchlist",
      amount: 0,
      meta: { kind: "watchlist_action", action: "add", symbol: "NVDA" },
    });
    const wealthReview = ActionLogSchema.parse({
      ...validAction,
      type: "wealth_review",
      amount: 0,
      meta: { kind: "wealth_review", focus: "diversification", action: "rebalance" },
    });
    expect(opportunity.type).toBe("opportunity");
    expect(fundLab.type).toBe("fund_lab");
    expect(goal.type).toBe("goal_account");
    expect(protection.type).toBe("protection");
    expect(watchlist.type).toBe("watchlist");
    expect(wealthReview.type).toBe("wealth_review");
  });

  it("rejects an action type outside the supported enum", () => {
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
