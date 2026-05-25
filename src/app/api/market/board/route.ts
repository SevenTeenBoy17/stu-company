import { NextRequest, NextResponse } from "next/server";

import { readSession } from "@/lib/auth";
import { getMarketBoardPayload } from "@/lib/market-data";
import { resolveMarketWatchlistSymbol } from "@/lib/market-watchlist";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await readSession();
    if (!session || session.role !== "student") {
      return NextResponse.json({ error: "需要学生账户登录。" }, { status: 401 });
    }

    const symbol = resolveMarketWatchlistSymbol(request.nextUrl.searchParams.get("symbol"));
    const payload = await getMarketBoardPayload(symbol);

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "市场信息看板暂时不可用。",
      },
      { status: 400 },
    );
  }
}
