import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/api-guard";
import { apiError, checkOrigin, handleRouteError } from "@/lib/api-response";
import { canUserOperate } from "@/lib/billing/subscription";
import { createStudentWatchlistActionForUser, getSimulationStateForUser } from "@/lib/db/repo";
import { getMarketBoardPayload } from "@/lib/market-data";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";
import { buildStudentWatchlistPayload } from "@/lib/student-watchlist";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  symbol: z.string().trim().min(1).max(12),
  action: z.enum(["add", "remove"]),
  reason: z.string().trim().max(120).optional(),
});

async function buildPayloadForUser(userId: string, symbol?: string) {
  const state = await getSimulationStateForUser(userId);
  const board = await getMarketBoardPayload(resolveMarketWatchlistSymbol(symbol));
  return buildStudentWatchlistPayload(state.run, board);
}

export async function GET(request: NextRequest) {
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const payload = await buildPayloadForUser(auth.user.id, request.nextUrl.searchParams.get("symbol") ?? undefined);
    return NextResponse.json({ payload });
  } catch (error) {
    return handleRouteError(error, "自选观察暂时不可用，请稍后再试。");
  }
}

export async function POST(request: Request) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  if (!canUserOperate(auth.user.subscriptionTier, auth.user.trialExpiresAt, auth.user.subscriptionExpiresAt)) {
    return apiError("forbidden", "试用已结束，请升级后继续记录自选观察。", 403);
  }

  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return apiError("invalid_input", "请选择一只观察标的，并写下不超过 120 字的观察理由。", 400);
    }

    const input = {
      ...parsed.data,
      symbol: resolveMarketWatchlistSymbol(parsed.data.symbol),
    };
    const outcome = await createStudentWatchlistActionForUser(auth.user.id, input);
    const board = await getMarketBoardPayload(input.symbol);
    return NextResponse.json({
      payload: buildStudentWatchlistPayload(outcome.run, board),
      entry: outcome.entry,
      message: input.action === "add" ? "已加入我的自选观察。" : "已从自选观察移除。",
    });
  } catch (error) {
    return handleRouteError(error, "自选观察更新失败，请稍后再试。");
  }
}

export async function DELETE(request: NextRequest) {
  const originBlock = checkOrigin(request);
  if (originBlock) return originBlock;

  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
    const symbol = resolveMarketWatchlistSymbol(request.nextUrl.searchParams.get("symbol"));
    const outcome = await createStudentWatchlistActionForUser(auth.user.id, {
      symbol,
      action: "remove",
      reason: "从自选观察移除，后续可以重新加入并补充观察理由。",
    });
    const board = await getMarketBoardPayload(symbol);
    return NextResponse.json({
      payload: buildStudentWatchlistPayload(outcome.run, board),
      entry: outcome.entry,
      message: "已从自选观察移除。",
    });
  } catch (error) {
    return handleRouteError(error, "自选观察移除失败，请稍后再试。");
  }
}
