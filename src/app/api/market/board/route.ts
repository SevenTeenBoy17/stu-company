import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/lib/api-response";
import { requireUser } from "@/lib/api-guard";
import { getCategoryBoardPayload } from "@/lib/market-data";

export const dynamic = "force-dynamic";

const marketBoardQuerySchema = z.object({
  category: z.enum(["us", "cn", "hk", "fund"]).optional(),
  symbol: z.string().trim().min(1).max(16).optional(),
});

export async function GET(request: NextRequest) {
  // itest5 R3 P2：此前用 readSession() 只验签名/过期，绕过了 H2 令牌版本吊销——登出/改密后
  // 旧 JWT 仍能读看板。改用 requireUser（含 tokenVersion 比对），与其余学生路由同口径。
  const auth = await requireUser("student");
  if (auth.error) return auth.error;

  try {
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
