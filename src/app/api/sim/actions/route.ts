import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { detectAdaptiveEvents } from "@/lib/adaptive-events";
import { canUserOperate } from "@/lib/billing/subscription";
import { applyActionForUser, getSimulationStateForUser } from "@/lib/db/repo";

const actionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("trade"),
    assetId: z.string(),
    side: z.enum(["buy", "sell"]),
    quantity: z.number().positive(),
    orderMode: z.enum(["market", "limit"]),
  }),
  z.object({
    type: z.literal("bank"),
    action: z.enum(["deposit", "withdraw", "loan", "repay"]),
    amount: z.number().positive(),
  }),
  z.object({
    type: z.literal("property"),
    action: z.enum(["buy", "sell"]),
  }),
  z.object({
    type: z.literal("venture"),
    action: z.enum(["invest", "exit"]),
    amount: z.number().positive(),
  }),
]);

export async function POST(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级到标准版以继续操作沙盘。", 403);
  }

  try {
    const body = actionSchema.parse(await request.json());
    await applyActionForUser(auth.user.id, body);
    const state = await getSimulationStateForUser(auth.user.id);
    const adaptiveEvents = detectAdaptiveEvents(state.run);
    return NextResponse.json({ state, adaptiveEvents, message: "操作已生效。" });
  } catch (error) {
    return handleRouteError(error, "操作失败，请检查现金、持仓或动作参数。");
  }
}
