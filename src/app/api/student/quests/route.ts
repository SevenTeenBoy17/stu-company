import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { claimQuestRewardForUser, getLearningProgress, getSimulationStateForUser } from "@/lib/db/repo";
import { buildStudentQuestPayload } from "@/lib/quests";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  questId: z.string().min(3),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const [state, learning] = await Promise.all([
      getSimulationStateForUser(auth.user.id),
      getLearningProgress(auth.user.id),
    ]);

    return NextResponse.json({
      payload: buildStudentQuestPayload(state.run, learning),
    });
  } catch (error) {
    return handleRouteError(error, "任务中心暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续领取任务学习卡。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请选择要领取的任务学习卡。", 400);
    }

    const outcome = await claimQuestRewardForUser(auth.user.id, parsed.data.questId);
    return NextResponse.json({
      payload: outcome.payload,
      claimed: outcome.claimed,
    });
  } catch (error) {
    return handleRouteError(error, "任务学习卡领取失败，请稍后再试。");
  }
}
