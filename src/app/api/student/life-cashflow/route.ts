import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { applyLifeCashflowChallengeForUser, getSimulationStateForUser } from "@/lib/db/repo";
import {
  budgetPlans,
  buildLifeCashflowPayload,
  insurancePlans,
  type BudgetPlanId,
  type InsurancePlanId,
} from "@/lib/life-cashflow";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  intent: z.enum(["simulate", "apply"]).optional().default("simulate"),
  planId: z.string().min(1),
  insuranceId: z.string().min(1),
});

function parsePlanId(value: string): BudgetPlanId {
  const plan = budgetPlans.find((item) => item.id === value);
  if (!plan) throw new Error("预算方案不存在，请刷新页面后重试。");
  return plan.id;
}

function parseInsuranceId(value: string): InsurancePlanId {
  const plan = insurancePlans.find((item) => item.id === value);
  if (!plan) throw new Error("保险方案不存在，请刷新页面后重试。");
  return plan.id;
}

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildLifeCashflowPayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "生活现金流暂时不可用，请稍后再试。");
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
      return apiError("invalid_input", "请选择预算方案和保险方案后再测算。", 400);
    }

    const planId = parsePlanId(parsed.data.planId);
    const insuranceId = parseInsuranceId(parsed.data.insuranceId);

    if (parsed.data.intent === "apply") {
      const outcome = await applyLifeCashflowChallengeForUser(auth.user.id, {
        planId,
        insuranceId,
      });
      return NextResponse.json({
        payload: outcome.payload,
        applied: outcome.result,
      });
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildLifeCashflowPayload(
        state.run,
        planId,
        insuranceId,
      ),
    });
  } catch (error) {
    return handleRouteError(error, "生活现金流测算失败，请稍后再试。");
  }
}
