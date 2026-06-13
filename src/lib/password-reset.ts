import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "@/lib/env";

/**
 * A2 (self-service password reset): signed reset tokens. Short TTL and a distinct
 * `purpose` literal so a token minted for another flow (email-verify, guest-upgrade)
 * cannot be replayed to reset a password.
 */
const PURPOSE = "password-reset";
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

const tokenSchema = z.object({
  purpose: z.literal(PURPOSE),
  userId: z.string().min(1),
  email: z.string().min(1),
});

function getSecret() {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[password-reset] SESSION_SECRET is required in production");
    }
    return new TextEncoder().encode("brown-zone-development-secret-do-not-use");
  }
  return new TextEncoder().encode(secret);
}

export async function createPasswordResetToken(userId: string, email: string) {
  return new SignJWT({ purpose: PURPOSE, userId, email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyPasswordResetToken(
  token?: string | null,
): Promise<{ userId: string; email: string } | null> {
  if (!token) return null;
  try {
    const result = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    const payload = tokenSchema.parse(result.payload);
    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}
