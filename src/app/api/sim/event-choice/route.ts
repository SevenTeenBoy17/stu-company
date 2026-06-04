import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { detectAdaptiveEvents } from "@/lib/adaptive-events";
import { canUserOperate } from "@/lib/billing/subscription";
import { applyEventChoiceForUser, getSimulationStateForUser } from "@/lib/db/repo";

const choiceSchema = z.object({
  choiceId: z.string().min(1).max(64),
});

/**
 * E3: a student responds to a decision-card event. One choice per round; the
 * outcome applies a seeded cash consequence (see applyEventChoice).
 */
export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级到标准版以继续操作沙盘。", 403);
  }

  try {
    const body = choiceSchema.parse(await request.json());
    await applyEventChoiceForUser(auth.user.id, body.choiceId);
    const state = await getSimulationStateForUser(auth.user.id);
    const adaptiveEvents = detectAdaptiveEvents(state.run);
    return NextResponse.json({ state, adaptiveEvents, message: "你的选择已生效。" });
  } catch (error) {
    return handleRouteError(error, "事件决策失败，请稍后重试。");
  }
}
