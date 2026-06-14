import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createFundLabActionForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildFundLabPayload } from "@/lib/fund-lab";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  intent: z.enum(["simulate", "record"]).default("simulate"),
  plan: z.enum(["balanced", "growth", "defensive"]),
  amount: z.coerce.number().int().min(1000).max(120000),
  note: z.string().trim().max(220).optional(),
});

const querySchema = z.object({
  plan: z.enum(["balanced", "growth", "defensive"]).optional(),
  amount: z.coerce.number().int().min(1000).max(120000).optional(),
});

export async function GET(request: Request) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      plan: searchParams.get("plan") ?? undefined,
      amount: searchParams.get("amount") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("invalid_input", "请选择有效的组合方案和模拟金额。", 400);
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildFundLabPayload(state.run, parsed.data.plan, parsed.data.amount),
    });
  } catch (error) {
    return handleRouteError(error, "基金/ETF 实验室暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续记录基金实验。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请完整选择组合方案和模拟金额。", 400);
    }

    if (parsed.data.intent === "record") {
      const outcome = await createFundLabActionForUser(auth.user.id, parsed.data);
      return NextResponse.json({
        payload: outcome.payload,
        message: "基金实验记录已写入历史。它不会改变净值，只用于训练和复盘。",
      });
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildFundLabPayload(state.run, parsed.data.plan, parsed.data.amount),
    });
  } catch (error) {
    return handleRouteError(error, "基金实验操作失败，请检查参数后再试。");
  }
}
