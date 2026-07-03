import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { resolveSubscriptionState } from "@/lib/billing/subscription";
import { getSimulationStateForUser, replayRunForUser } from "@/lib/db/repo";

/**
 * Premium "season replay": reset the sandbox to a fresh seed so the 12 rounds
 * play out with a different event sequence. Gated by features.seasonReplay.
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  const subscription = resolveSubscriptionState(
    auth.user.subscriptionTier,
    auth.user.trialExpiresAt,
    auth.user.subscriptionExpiresAt,
  );
  if (!subscription.features.seasonReplay) {
    return apiError(
      "forbidden",
      "赛季重玩是高级版功能，升级后即可用全新行情重新开局。",
      403,
    );
  }

  try {
    await replayRunForUser(auth.user.id);
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({ state, message: "新赛季已开启，行情已刷新。" });
  } catch (error) {
    return handleRouteError(error, "开启新赛季失败，请稍后重试。");
  }
}
