import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { applyCreditLabActionForUser, getSimulationStateForUser } from "@/lib/db/repo";
import {
  buildCreditLabPayload,
  creditScenarios,
  type CreditLabIntent,
  type CreditScenarioId,
} from "@/lib/credit-lab";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  intent: z.enum(["simulate", "borrow", "repay"]).optional().default("simulate"),
  scenarioId: z.string().optional(),
  amount: z.coerce.number().min(500).max(120000).optional(),
});

function parseScenarioId(value: string | undefined): CreditScenarioId {
  if (!value) return "device-installment";
  const scenario = creditScenarios.find((item) => item.id === value);
  if (!scenario) throw new Error("信用场景不存在，请刷新页面后重试。");
  return scenario.id;
}

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildCreditLabPayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "信用实验室暂时不可用，请稍后再试。");
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
      return apiError("invalid_input", "请选择信用场景和金额后再操作。", 400);
    }

    const intent = parsed.data.intent as CreditLabIntent;
    const scenarioId = parseScenarioId(parsed.data.scenarioId);

    if (intent === "borrow" || intent === "repay") {
      const outcome = await applyCreditLabActionForUser(auth.user.id, {
        intent,
        scenarioId,
        amount: parsed.data.amount,
      });
      return NextResponse.json({
        payload: outcome.payload,
        applied: outcome.result,
      });
    }

    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildCreditLabPayload(state.run, scenarioId),
    });
  } catch (error) {
    return handleRouteError(error, "信用实验室操作失败，请检查金额后再试。");
  }
}
