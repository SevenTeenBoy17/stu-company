import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { buildAutoInvestPayload } from "@/lib/auto-invest";
import {
  cancelAutoInvestPlanForUser,
  createAutoInvestPlanForUser,
  getSimulationStateForUser,
} from "@/lib/db/repo";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  intent: z.enum(["simulate", "activate", "cancel"]).default("simulate"),
  assetId: z.string().min(1),
  amountPerRound: z.coerce.number().min(500).max(120000),
  durationRounds: z.coerce.number().int().min(1).max(12),
  strategy: z.enum(["steady", "buyDip", "momentum"]),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildAutoInvestPayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "定投机器人暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("invalid_input", "请完整选择定投标的、金额、期数和策略。", 400);
    }

    if (parsed.data.intent === "activate") {
      const run = await createAutoInvestPlanForUser(auth.user.id, parsed.data);
      return NextResponse.json({
        payload: buildAutoInvestPayload(run),
        message: "定投计划已启动，从下一回合开始自动执行。",
      });
    }

    if (parsed.data.intent === "cancel") {
      const run = await cancelAutoInvestPlanForUser(auth.user.id);
      return NextResponse.json({
        payload: buildAutoInvestPayload(run),
        message: "定投计划已取消，已有持仓会保留在组合中。",
      });
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildAutoInvestPayload(state.run, parsed.data),
    });
  } catch (error) {
    return handleRouteError(error, "定投机器人操作失败，请检查参数后再试。");
  }
}
