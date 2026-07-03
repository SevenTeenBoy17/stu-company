import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createGoalAccountActionForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildGoalAccountsPayload } from "@/lib/goal-accounts";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  goalId: z.enum(["emergency", "laptop", "study-trip", "startup"]),
  amount: z.coerce.number().int().min(100).max(50_000),
  note: z.string().trim().max(180).optional(),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildGoalAccountsPayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "目标账户暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续操作目标账户。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请选择目标账户，并输入 100 元以上的转入金额。", 400);
    }

    const outcome = await createGoalAccountActionForUser(auth.user.id, parsed.data);
    return NextResponse.json({
      payload: outcome.payload,
      entry: outcome.entry,
      message: "目标账户已更新。你正在把生活目标拆成可执行的小步骤。",
    });
  } catch (error) {
    return handleRouteError(error, "目标账户操作失败，请检查现金余额和金额后再试。");
  }
}
