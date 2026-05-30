// @vitest-environment node
// jose's webapi build needs Node's Uint8Array realm; jsdom's differs.
import { describe, expect, it } from "vitest";

import { createEmailVerificationToken } from "@/lib/email-verification";
import {
  createPasswordResetToken,
  verifyPasswordResetToken,
} from "@/lib/password-reset";

describe("password reset token", () => {
  it("round-trips the user id and email", async () => {
    const token = await createPasswordResetToken("user-9", "Teen@Example.com");
    expect(await verifyPasswordResetToken(token)).toEqual({
      userId: "user-9",
      email: "teen@example.com",
    });
  });

  it("returns null for a tampered or missing token", async () => {
    const token = await createPasswordResetToken("user-9", "teen@example.com");
    expect(await verifyPasswordResetToken(`${token}x`)).toBeNull();
    expect(await verifyPasswordResetToken(undefined)).toBeNull();
  });

  it("rejects a token minted for a different purpose (no cross-use)", async () => {
    const emailToken = await createEmailVerificationToken("user-9", "teen@example.com");
    expect(await verifyPasswordResetToken(emailToken)).toBeNull();
  });
});
