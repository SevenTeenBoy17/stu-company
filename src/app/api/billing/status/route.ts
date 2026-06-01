import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import { listSubscriptionTargetsForUser } from "@/lib/db/repo";

export async function GET() {
  const auth = await requireUser();
  if (auth.error) return auth.error;

  const state = resolveSubscriptionState(
    auth.user.subscriptionTier,
    auth.user.trialExpiresAt,
    auth.user.subscriptionExpiresAt,
  );
  const eligibleTargets = await listSubscriptionTargetsForUser(auth.user.id);

  return NextResponse.json({
    ...state,
    viewer: {
      id: auth.user.id,
      role: auth.user.role,
      name: auth.user.name,
      email: auth.user.email,
    },
    eligibleTargets,
  });
}
