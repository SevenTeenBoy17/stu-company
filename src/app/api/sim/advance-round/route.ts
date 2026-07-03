import { NextResponse } from "next/server";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { detectAdaptiveEvents } from "@/lib/adaptive-events";
import { canUserOperate } from "@/lib/billing/subscription";
import { advanceRunForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { recomputePowerForUser } from "@/lib/leaderboard/service";

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级到标准版以继续操作沙盘。", 403);
  }

  try {
    // The sandbox is a fixed 12-round game. If it is already on the final round
    // there is nothing to advance — report completion instead of a phantom advance
    // (#4 audit).
    const before = await getSimulationStateForUser(auth.user.id);
    if (before.run.currentRound >= before.run.totalRounds) {
      return NextResponse.json({
        state: before,
        adaptiveEvents: [],
        finished: true,
        message: "本局 12 回合已结束，前往历史复盘查看结算。",
      });
    }

    await advanceRunForUser(auth.user.id);
    const state = await getSimulationStateForUser(auth.user.id);
    const finished = state.run.currentRound >= state.run.totalRounds;
    const adaptiveEvents = detectAdaptiveEvents(state.run);
    // Best-effort: refresh the player's learning progress for the weekly board. Never let
    // a leaderboard hiccup block round advance.
    try {
      await recomputePowerForUser(auth.user.id);
    } catch {
      // swallow — leaderboard is non-critical to gameplay
    }
    return NextResponse.json({
      state,
      adaptiveEvents,
      finished,
      message: finished
        ? "已完成最后一回合，本局结束，可前往历史复盘查看结算。"
        : "已推进到下一回合。",
    });
  } catch (error) {
    return handleRouteError(error, "推进回合失败，请稍后再试。");
  }
}
