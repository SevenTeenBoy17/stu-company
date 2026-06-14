import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createOpportunityNoteForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildOpportunityPayload } from "@/lib/opportunity";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  cardId: z.enum(["ai-infra", "steady-cashflow", "green-energy", "safe-haven"]),
  reason: z.enum(["capital", "policy", "valuation", "risk-release", "learning"]),
  confidence: z.coerce.number().int().min(1).max(100),
  note: z.string().trim().min(8).max(240),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    return NextResponse.json({
      payload: buildOpportunityPayload(state.run),
    });
  } catch (error) {
    return handleRouteError(error, "机会训练场暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续提交机会观察单。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请完整选择主题、观察理由，并写下至少 8 个字的观察说明。", 400);
    }

    const outcome = await createOpportunityNoteForUser(auth.user.id, parsed.data);
    return NextResponse.json({
      payload: outcome.payload,
      note: outcome.note,
      message: "观察单已记录。下一回合可以回来看看证据是否变化。",
    });
  } catch (error) {
    return handleRouteError(error, "观察单提交失败，请检查内容后再试。");
  }
}
