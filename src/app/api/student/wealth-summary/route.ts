import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { buildWealthSummary } from "@/lib/allocation";
import { createWealthReviewForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { buildWealthReviewPayload } from "@/lib/wealth-review";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  focus: z.enum(["safety-buffer", "diversification", "debt-control", "growth-engine"]),
  action: z.enum(["raise-cash", "rebalance", "hold-and-watch", "reduce-debt", "link-goal"]),
  confidence: z.coerce.number().int().min(1).max(100),
  note: z.string().trim().min(8).max(240),
});

export async function GET() {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const state = await getSimulationStateForUser(auth.user.id);
    const summary = buildWealthSummary(state.run);
    return NextResponse.json({
      summary,
      review: buildWealthReviewPayload(state.run, summary),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, "无法读取财富总览，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请完整选择关注点、下一步动作，并写下至少 8 个字的复盘理由。", 400);
    }

    const outcome = await createWealthReviewForUser(auth.user.id, parsed.data);
    const summary = buildWealthSummary(outcome.run);
    return NextResponse.json({
      summary,
      review: outcome.payload,
      entry: outcome.entry,
      message: "财富复盘已记录。它不会改变净值，但会进入历史复盘和学习轨迹。",
    });
  } catch (error) {
    return handleRouteError(error, "财富复盘提交失败，请检查内容后再试。");
  }
}
