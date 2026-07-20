import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError, rateLimitedError } from "@/lib/api-response";
import { claimQuestRewardForUser, getLearningProgress, getSimulationStateForUser } from "@/lib/db/repo";
import { buildRateLimitMessage, rateLimit, rateLimitKey } from "@/lib/rate-limit";
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

  // 合规（未成年人）：任务奖励纯装饰（claimQuestReward 只追加 amount:0 的日志行），
  // 不做订阅门控——否则等于在领取按钮的即时反馈位向学生推送付费（评审会 P1）。
  // 实质功能（沙盘操作/AI）仍由各自路由的 canUserOperate 把守。
  const rl = rateLimit(rateLimitKey("quest-claim", auth.user.id, request), 20, 60_000);
  if (!rl.ok) {
    return rateLimitedError(buildRateLimitMessage(rl), rl.retryAfterMs);
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
