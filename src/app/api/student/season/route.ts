import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { claimSeasonRewardForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildStudentSeasonChallengePayload } from "@/lib/season-challenges";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  challengeId: z.string().trim().min(3).max(80),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildStudentSeasonChallengePayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "赛季挑战暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续领取赛季奖励。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请选择要领取的赛季奖励。", 400);
    }

    const outcome = await claimSeasonRewardForUser(auth.user.id, parsed.data.challengeId);
    return NextResponse.json({
      payload: outcome.payload,
      claimed: outcome.claimed,
    });
  } catch (error) {
    return handleRouteError(error, "赛季奖励领取失败，请稍后再试。");
  }
}
