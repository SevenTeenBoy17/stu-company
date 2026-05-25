import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { readSession } from "@/lib/auth";
import { getMarketBoardPayload } from "@/lib/market-data";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";

export const dynamic = "force-dynamic";

const marketBoardQuerySchema = z.object({
  symbol: z.string().trim().min(1).max(12).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return apiError("unauthorized", "需要学生账号登录。", 401);
    }

    const query = marketBoardQuerySchema.parse({
      symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
    });
    const symbol = resolveMarketWatchlistSymbol(query.symbol);
    const payload = await getMarketBoardPayload(symbol);

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "市场信息看板暂时不可用。");
  }
}
