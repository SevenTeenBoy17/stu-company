import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { resolveSubscriptionState } from "@/lib/billing/subscription";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const state = resolveSubscriptionState(
    auth.user.subscriptionTier,
    auth.user.trialExpiresAt,
  );

  return NextResponse.json(state);
}
