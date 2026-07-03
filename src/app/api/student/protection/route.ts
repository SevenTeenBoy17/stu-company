import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createProtectionUmbrellaActionForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildProtectionUmbrellaPayload } from "@/lib/protection-umbrella";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  planId: z.enum(["none", "basic", "plus"]),
  stressId: z.string().min(1).optional(),
  note: z.string().trim().max(180).optional(),
});

const querySchema = z.object({
  planId: z.enum(["none", "basic", "plus"]).optional(),
});

export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      planId: searchParams.get("planId") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("invalid_input", "请选择有效的保护方案。", 400);
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildProtectionUmbrellaPayload(state.run, parsed.data.planId),
    });
  } catch (error) {
    return handleRouteError(error, "风险保护伞暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续记录风险保护复盘。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请选择保护方案和压力测试场景。", 400);
    }

    const outcome = await createProtectionUmbrellaActionForUser(auth.user.id, parsed.data);
    return NextResponse.json({
      payload: outcome.payload,
      entry: outcome.entry,
      message: "保护伞复盘已记录。它不会增加收益，但会训练你如何面对坏情况。",
    });
  } catch (error) {
    return handleRouteError(error, "保护伞复盘失败，请稍后再试。");
  }
}
