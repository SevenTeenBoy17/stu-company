import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiError, handleRouteError } from "@/lib/api-response";
import { readSession } from "@/lib/auth";
import { getCategoryBoardPayload } from "@/lib/market-data";

export const dynamic = "force-dynamic";

const marketBoardQuerySchema = z.object({
  category: z.enum(["us", "cn", "hk", "fund"]).optional(),
  symbol: z.string().trim().min(1).max(16).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await readSession();
    if (!session) {
      return apiError("unauthorized", "需要学生账号登录。", 401);
    }
    if (session.role !== "student") {
      return apiError("forbidden", "仅学生账号可访问市场看板。", 403);
    }

    const query = marketBoardQuerySchema.parse({
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      symbol: request.nextUrl.searchParams.get("symbol") ?? undefined,
    });
    // category 缺省时走美股(us)，与历史行为一致；非法 category/symbol 在 data 层收敛兜底。
    const payload = await getCategoryBoardPayload(query.category, query.symbol);

    return NextResponse.json(payload, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "市场信息看板暂时不可用。");
  }
}
