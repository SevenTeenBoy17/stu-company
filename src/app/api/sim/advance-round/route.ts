import { NextResponse } from "next/server";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { detectAdaptiveEvents } from "@/lib/adaptive-events";
import { canUserOperate } from "@/lib/billing/subscription";
import { advanceRunForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { recomputePowerForUser } from "@/lib/leaderboard/service";

export async function POST() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级到标准版以继续操作沙盘。", 403);
  }

  try {
    await advanceRunForUser(auth.user.id);
    const state = await getSimulationStateForUser(auth.user.id);
    const adaptiveEvents = detectAdaptiveEvents(state.run);
    // Best-effort: refresh the player's 财商战力 for the weekly board. Never let
    // a leaderboard hiccup block round advance.
    try {
      await recomputePowerForUser(auth.user.id);
    } catch {
      // swallow — leaderboard is non-critical to gameplay
    }
    return NextResponse.json({ state, adaptiveEvents, message: "已推进到下一回合。" });
  } catch (error) {
    return handleRouteError(error, "推进回合失败，请稍后再试。");
  }
}
