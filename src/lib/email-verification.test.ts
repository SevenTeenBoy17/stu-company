// @vitest-environment node
// jose's webapi build needs Node's Uint8Array realm; jsdom's differs (see billing-intent.test.ts).
import { describe, expect, it } from "vitest";

import {
  createEmailVerificationToken,
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
});
