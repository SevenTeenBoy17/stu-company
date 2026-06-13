import { NextResponse } from "next/server";

import { requireUser } from "@/lib/api-guard";
import { readSession } from "@/lib/auth";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import { listSubscriptionTargetsForUser } from "@/lib/db/repo";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({
      tier: "free",
      status: "anonymous",
      canOperate: false,
      canViewHistory: false,
      aiTier: "none",
      bannerMessage: null,
      daysRemaining: null,
      trialMode: null,
      trialDaysRemaining: null,
      subscriptionExpiresAt: null,
      canUsePersonalAiAssessment: false,
      features: {
        maxStudents: 0,
        deepAiReport: false,
        weeklyParentEmail: false,
        seasonReplay: false,
      },
      viewer: null,
      eligibleTargets: [],
    });
  }

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
