// @vitest-environment node

import { describe, expect, it } from "vitest";

import { createBillingIntent, verifyBillingIntent } from "@/lib/billing/billing-intent";

describe("guest upgrade billing intent", () => {
  it("round-trips a short-lived standard billing intent", async () => {
    const { token, intent } = await createBillingIntent({
      purpose: "guest-upgrade-prepay",
      userId: "user_test_guest_upgrade",
      tier: "standard",
    });

    expect(token.length).toBeGreaterThan(20);
    expect(intent.purpose).toBe("guest-upgrade-prepay");

    const verified = await verifyBillingIntent(token);
    expect(verified).toMatchObject({
      purpose: "guest-upgrade-prepay",
      userId: "user_test_guest_upgrade",
      tier: "standard",
    });
  });

  it("preserves parent-link purpose so it cannot masquerade as guest-upgrade prepay", async () => {
    const { token, intent } = await createBillingIntent({
      purpose: "parent-link-prepay",
      userId: "student_parent_link_owner",
      tier: "standard",
    });

    expect(intent.purpose).toBe("parent-link-prepay");
    await expect(verifyBillingIntent(token)).resolves.toMatchObject({
      purpose: "parent-link-prepay",
      userId: "student_parent_link_owner",
      tier: "standard",
    });
  });

  it("rejects missing or malformed tokens instead of throwing", async () => {
    await expect(verifyBillingIntent()).resolves.toBeNull();
    await expect(verifyBillingIntent("not-a-valid-token")).resolves.toBeNull();
  });
});
