import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { canUserOperate } from "@/lib/billing/subscription";
import { createRoundPredictionForUser, getSimulationStateForUser } from "@/lib/db/repo";

const predictSchema = z.object({
  guess: z.enum(["up", "down"]),
});

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级到标准版后继续参与回合预测。", 403);
  }

  try {
    const body = predictSchema.parse(await request.json());
    const prediction = await createRoundPredictionForUser(auth.user.id, body);
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      prediction,
      state,
      message: "预测已提交。本回合结束时会自动结算，只解锁装饰徽章，不影响净值或学习点。",
    });
  } catch (error) {
    return handleRouteError(error, "预测提交失败，请稍后再试。");
  }
}
