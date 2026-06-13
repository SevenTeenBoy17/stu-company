import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "@/lib/env";

/**
 * A1 (account integrity): signed email-verification tokens. Same HS256 + jose
 * approach as billing-intent. The `purpose` literal prevents a token minted for
 * another flow (e.g. guest-upgrade) from being replayed here.
 */
const PURPOSE = "email-verify";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 3; // 3 days to confirm

/**
 * Gray-launch flag for A1 enforcement. When "true", unverified trial/free users
 * are blocked from the personalized AI assessment (see evaluatePersonalAiAccess).
 * Read at request time (not validated at boot) so it can be toggled without a
 * redeploy. Default off — flip to enable enforcement once email delivery is live.
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}

const tokenSchema = z.object({
  purpose: z.literal(PURPOSE),
  userId: z.string().min(1),
  email: z.string().min(1),
});

function getSecret() {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[email-verification] SESSION_SECRET is required in production");
    }
    return new TextEncoder().encode("brown-zone-development-secret-do-not-use");
  }
  return new TextEncoder().encode(secret);
}

export async function createEmailVerificationToken(userId: string, email: string) {
  return new SignJWT({ purpose: PURPOSE, userId, email: email.trim().toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyEmailVerificationToken(
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
