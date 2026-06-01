import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";

import { env } from "@/lib/env";
import type { BillingIntent } from "@/lib/types";

const PURPOSE = "guest-upgrade";
const INTENT_TTL_SECONDS = 15 * 60;

const billingIntentSchema = z.object({
  purpose: z.literal(PURPOSE),
  userId: z.string().min(1),
  tier: z.enum(["standard", "premium"]),
  exp: z.number().optional(),
});

function getBillingSecret() {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[billing-intent] SESSION_SECRET is required in production");
    }
    return new TextEncoder().encode("brown-zone-development-secret-do-not-use");
  }
  return new TextEncoder().encode(secret);
}

export async function createBillingIntent(input: Pick<BillingIntent, "userId" | "tier">) {
  const expiresAt = new Date(Date.now() + INTENT_TTL_SECONDS * 1000);
  const token = await new SignJWT({
    purpose: PURPOSE,
    userId: input.userId,
    tier: input.tier,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(`${INTENT_TTL_SECONDS}s`)
    .sign(getBillingSecret());

  return {
    token,
    intent: {
      purpose: PURPOSE,
      userId: input.userId,
      tier: input.tier,
      expiresAt: expiresAt.toISOString(),
    } satisfies BillingIntent,
  };
}

export async function verifyBillingIntent(token?: string | null) {
  if (!token) return null;

  try {
    const result = await jwtVerify(token, getBillingSecret());
    const payload = billingIntentSchema.parse(result.payload);
    return {
      purpose: payload.purpose,
      userId: payload.userId,
      tier: payload.tier,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : new Date().toISOString(),
    } satisfies BillingIntent;
  } catch {
    return null;
  }
}
