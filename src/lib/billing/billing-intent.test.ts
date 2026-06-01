// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createBillingIntent, verifyBillingIntent } from "@/lib/billing/billing-intent";

describe("guest upgrade billing intent", () => {
  it("round-trips a short-lived standard billing intent", async () => {
    const { token, intent } = await createBillingIntent({
      userId: "user_test_guest_upgrade",
      tier: "standard",
    });

    expect(token.length).toBeGreaterThan(20);
    expect(intent.purpose).toBe("guest-upgrade");

    const verified = await verifyBillingIntent(token);
    expect(verified).toMatchObject({
      purpose: "guest-upgrade",
      userId: "user_test_guest_upgrade",
      tier: "standard",
    });
  });

  it("rejects missing or malformed tokens instead of throwing", async () => {
    await expect(verifyBillingIntent()).resolves.toBeNull();
    await expect(verifyBillingIntent("not-a-valid-token")).resolves.toBeNull();
  });
});
