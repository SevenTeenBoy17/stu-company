// @vitest-environment node
// jose's webapi build needs Node's Uint8Array realm; jsdom's differs (see billing-intent.test.ts).
import { describe, expect, it } from "vitest";

import {
  createEmailVerificationToken,
  isEmailVerificationRequired,
  verifyEmailVerificationToken,
} from "@/lib/email-verification";

describe("email verification token", () => {
  it("round-trips the user id and email", async () => {
    const token = await createEmailVerificationToken("user-123", "Kid@Example.com");
    const result = await verifyEmailVerificationToken(token);
    expect(result).toEqual({ userId: "user-123", email: "kid@example.com" });
  });

  it("returns null for a tampered token", async () => {
    const token = await createEmailVerificationToken("user-123", "kid@example.com");
    const result = await verifyEmailVerificationToken(`${token}x`);
    expect(result).toBeNull();
  });

  it("returns null for a missing token", async () => {
    expect(await verifyEmailVerificationToken(undefined)).toBeNull();
    expect(await verifyEmailVerificationToken("")).toBeNull();
  });

  it("gray-launch flag reflects REQUIRE_EMAIL_VERIFICATION", () => {
    const prev = process.env.REQUIRE_EMAIL_VERIFICATION;
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    expect(isEmailVerificationRequired()).toBe(true);
    process.env.REQUIRE_EMAIL_VERIFICATION = "false";
    expect(isEmailVerificationRequired()).toBe(false);
    delete process.env.REQUIRE_EMAIL_VERIFICATION;
    expect(isEmailVerificationRequired()).toBe(false);
    if (prev !== undefined) process.env.REQUIRE_EMAIL_VERIFICATION = prev;
  });
});
